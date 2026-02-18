import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { SparkLoopService } from '@/lib/sparkloop-client'
import { supabaseAdmin } from '@/lib/supabase'
import { checkUserAgent } from '@/lib/bot-detection'
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils'
import { PUBLICATION_ID } from '@/lib/config'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.com'

/**
 * GET /api/sparkloop/module-subscribe?email=X&ref_code=Y&issue_id=Z
 *
 * One-click subscribe from newsletter email. Email links can't POST,
 * so this is a GET that performs the subscribe and redirects to confirmation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const refCode = searchParams.get('ref_code')
  const issueId = searchParams.get('issue_id')

  // Validate required params
  if (!email || !refCode) {
    return NextResponse.redirect(
      `${BASE_URL}/website/subscribe/module-confirmed?error=missing_params`
    )
  }

  // Check for MailerLite merge variable not being replaced (link opened in browser directly)
  if (email === '{$email}' || email.includes('{$')) {
    return NextResponse.redirect(
      `${BASE_URL}/website/subscribe/module-confirmed?error=invalid_email`
    )
  }

  // Extract request metadata early (needed for bot detection + tracking)
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
  const userAgent = request.headers.get('user-agent') || undefined
  const countryCode = request.headers.get('x-vercel-ip-country') || 'US'

  // Bot detection
  const uaCheck = checkUserAgent(userAgent || null)

  // IP exclusion check (fail-open: if check fails, allow the subscribe)
  let ipExcluded = false
  try {
    const { data: exclusions } = await supabaseAdmin
      .from('excluded_ips')
      .select('ip_address, is_range, cidr_prefix')
      .eq('publication_id', PUBLICATION_ID)

    if (exclusions && ipAddress) {
      ipExcluded = isIPExcluded(ipAddress, exclusions as IPExclusion[])
    }
  } catch (exErr) {
    console.error('[SparkLoop Module Subscribe] IP exclusion check failed (fail-open):', exErr)
  }

  const shouldBlock = uaCheck.isBot || ipExcluded

  // Record every click attempt (fire-and-forget)
  const clickRecordId = crypto.randomUUID()
  supabaseAdmin
    .from('sparkloop_module_clicks')
    .insert({
      id: clickRecordId,
      publication_id: PUBLICATION_ID,
      subscriber_email: email,
      ref_code: refCode,
      issue_id: issueId || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      country_code: countryCode,
      is_bot_ua: uaCheck.isBot,
      bot_ua_reason: uaCheck.reason,
      is_ip_excluded: ipExcluded,
      sparkloop_called: false,
    })
    .then(({ error }) => {
      if (error) console.error('[SparkLoop Module Subscribe] Failed to record click:', error)
    })

  // If blocked, redirect to confirmation but skip SparkLoop API calls
  if (shouldBlock) {
    const reason = uaCheck.isBot ? `bot_ua: ${uaCheck.reason}` : 'ip_excluded'
    console.log(`[SparkLoop Module Subscribe] Blocked ${email} (${reason}) - redirecting without SparkLoop call`)

    // Still redirect to confirmation page (don't break UX)
    const { data: rec } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('publication_name')
      .eq('publication_id', PUBLICATION_ID)
      .eq('ref_code', refCode)
      .single()

    const confirmUrl = new URL(`${BASE_URL}/website/subscribe/module-confirmed`)
    if (rec) confirmUrl.searchParams.set('name', rec.publication_name)
    return NextResponse.redirect(confirmUrl.toString())
  }

  try {
    // Verify ref_code is active and non-excluded
    const { data: rec } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('ref_code, publication_name, status, excluded')
      .eq('publication_id', PUBLICATION_ID)
      .eq('ref_code', refCode)
      .single()

    if (!rec || rec.status !== 'active' || rec.excluded) {
      return NextResponse.redirect(
        `${BASE_URL}/website/subscribe/module-confirmed?error=unavailable`
      )
    }

    const service = new SparkLoopService()

    // Step 2: Create or fetch subscriber (CRITICAL: need UUID for attribution)
    let subscriberUuid: string | null = null
    try {
      const subscriber = await service.createOrFetchSubscriber({
        email,
        country_code: countryCode,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      subscriberUuid = subscriber.uuid
      console.log(`[SparkLoop Module Subscribe] Subscriber ready: ${subscriberUuid}`)
    } catch (subError) {
      console.error('[SparkLoop Module Subscribe] Create/fetch subscriber failed:', subError)
    }

    // Step 3: Subscribe with UUID for proper referral attribution
    await service.subscribeToNewsletters({
      subscriber_email: email,
      subscriber_uuid: subscriberUuid || undefined,
      country_code: countryCode,
      recommendations: refCode,
      utm_source: 'newsletter_module',
    })

    // Update click record: SparkLoop was called successfully (fire-and-forget)
    supabaseAdmin
      .from('sparkloop_module_clicks')
      .update({ sparkloop_called: true, sparkloop_success: true })
      .eq('id', clickRecordId)
      .then(({ error }) => {
        if (error) console.error('[SparkLoop Module Subscribe] Failed to update click record:', error)
      })

    // Record referral in sparkloop_referrals
    try {
      await supabaseAdmin
        .from('sparkloop_referrals')
        .upsert({
          publication_id: PUBLICATION_ID,
          subscriber_email: email,
          ref_code: refCode,
          source: 'newsletter_module',
          status: 'subscribed',
          subscribed_at: new Date().toISOString(),
        }, {
          onConflict: 'publication_id,subscriber_email,ref_code',
          ignoreDuplicates: true,
        })
    } catch (refErr) {
      console.error('[SparkLoop Module Subscribe] Failed to record referral:', refErr)
    }

    // Record event in sparkloop_events
    try {
      await supabaseAdmin.from('sparkloop_events').insert({
        publication_id: PUBLICATION_ID,
        event_type: 'newsletter_module_subscribe',
        subscriber_email: email,
        raw_payload: {
          source: 'newsletter_module',
          ref_code: refCode,
          issue_id: issueId || null,
          subscriber_uuid: subscriberUuid,
          country_code: countryCode,
          ip_hash: ipAddress ? createHash('sha256').update(ipAddress).digest('hex').slice(0, 16) : null,
        },
        event_timestamp: new Date().toISOString(),
      })
    } catch (eventErr) {
      console.error('[SparkLoop Module Subscribe] Failed to record event:', eventErr)
    }

    // Increment our_total_subscribes
    try {
      await supabaseAdmin.rpc('increment_our_subscribes', {
        p_publication_id: PUBLICATION_ID,
        p_ref_codes: [refCode],
      })
    } catch (aggErr) {
      console.error('[SparkLoop Module Subscribe] Failed to increment aggregates:', aggErr)
    }

    console.log(`[SparkLoop Module Subscribe] ${email} subscribed to ${rec.publication_name} via newsletter module`)

    // Redirect to confirmation page
    const confirmUrl = new URL(`${BASE_URL}/website/subscribe/module-confirmed`)
    confirmUrl.searchParams.set('name', rec.publication_name)
    return NextResponse.redirect(confirmUrl.toString())

  } catch (error) {
    console.error('[SparkLoop Module Subscribe] Failed:', error)

    // Update click record on error (fire-and-forget)
    supabaseAdmin
      .from('sparkloop_module_clicks')
      .update({ sparkloop_called: true, sparkloop_success: false })
      .eq('id', clickRecordId)
      .then(({ error: updateErr }) => {
        if (updateErr) console.error('[SparkLoop Module Subscribe] Failed to update click error record:', updateErr)
      })

    return NextResponse.redirect(
      `${BASE_URL}/website/subscribe/module-confirmed?error=failed`
    )
  }
}
