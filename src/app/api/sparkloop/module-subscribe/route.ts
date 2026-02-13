import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { SparkLoopService } from '@/lib/sparkloop-client'
import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'
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

  try {
    // Verify ref_code is active and non-excluded
    const { data: rec } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('ref_code, publication_name, status, excluded')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .eq('ref_code', refCode)
      .single()

    if (!rec || rec.status !== 'active' || rec.excluded) {
      return NextResponse.redirect(
        `${BASE_URL}/website/subscribe/module-confirmed?error=unavailable`
      )
    }

    const service = new SparkLoopService()
    const countryCode = request.headers.get('x-vercel-ip-country') || 'US'
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    const userAgent = request.headers.get('user-agent') || undefined

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

    // Record referral in sparkloop_referrals
    try {
      await supabaseAdmin
        .from('sparkloop_referrals')
        .upsert({
          publication_id: DEFAULT_PUBLICATION_ID,
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
        publication_id: DEFAULT_PUBLICATION_ID,
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
        p_publication_id: DEFAULT_PUBLICATION_ID,
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
    return NextResponse.redirect(
      `${BASE_URL}/website/subscribe/module-confirmed?error=failed`
    )
  }
}
