import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import { createHash } from 'crypto'
import { createSparkLoopServiceForPublication } from '@/lib/sparkloop-client'
import { supabaseAdmin } from '@/lib/supabase'
import { checkUserAgent } from '@/lib/bot-detection'
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils'
import { PUBLICATION_ID } from '@/lib/config'

const inputSchema = z.object({
  email: z.string().email(),
  ref_code: z.string().min(1),
  issue_id: z.string().optional(),
})

/**
 * POST /api/sparkloop/recommend-subscribe
 *
 * Called from the recommendation landing page when user clicks "Subscribe".
 * Subscribes via SparkLoop API and tracks with source='newsletter_module'.
 */
export const POST = withApiHandler(
  {
    authTier: 'public',
    inputSchema,
    logContext: 'sparkloop-recommend-subscribe',
  },
  async ({ input, request, logger }) => {
    const { email, ref_code: refCode, issue_id: issueId } = input

    // Resolve publication from issue (trust anchor) or fall back to default
    let publicationId = PUBLICATION_ID
    if (issueId) {
      const { data: issue } = await supabaseAdmin
        .from('publication_issues')
        .select('publication_id')
        .eq('id', issueId)
        .single()
      if (issue?.publication_id) publicationId = issue.publication_id
    }

    // Check for MailerLite merge variable not being replaced
    if (email === '{$email}' || email.includes('{$')) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
    }

    // Extract request metadata
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    const userAgent = request.headers.get('user-agent') || undefined
    const countryCode = request.headers.get('x-vercel-ip-country') || 'US'

    // Bot detection
    const uaCheck = checkUserAgent(userAgent || null)

    // IP exclusion check (fail-open)
    let ipExcluded = false
    try {
      const { data: exclusions } = await supabaseAdmin
        .from('excluded_ips')
        .select('ip_address, is_range, cidr_prefix')
        .eq('publication_id', publicationId)

      if (exclusions && ipAddress) {
        ipExcluded = isIPExcluded(ipAddress, exclusions as IPExclusion[])
      }
    } catch (exErr) {
      console.error('[SparkLoop Recommend Subscribe] IP exclusion check failed (fail-open):', exErr)
    }

    const shouldBlock = uaCheck.isBot || ipExcluded

    // Record click (fire-and-forget)
    const clickRecordId = crypto.randomUUID()
    supabaseAdmin
      .from('sparkloop_module_clicks')
      .insert({
        id: clickRecordId,
        publication_id: publicationId,
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
        if (error) console.error('[SparkLoop Recommend Subscribe] Failed to record click:', error)
      })

    // If blocked, return success without calling SparkLoop
    if (shouldBlock) {
      const reason = uaCheck.isBot ? `bot_ua: ${uaCheck.reason}` : 'ip_excluded'
      console.log(`[SparkLoop Recommend Subscribe] Blocked ${email} (${reason})`)
      return NextResponse.json({ success: true })
    }

    // Verify ref_code is active and non-excluded
    const { data: rec } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('ref_code, publication_name, status, excluded')
      .eq('publication_id', publicationId)
      .eq('ref_code', refCode)
      .single()

    if (!rec || rec.status !== 'active' || rec.excluded) {
      return NextResponse.json({ error: 'unavailable' }, { status: 404 })
    }

    const service = await createSparkLoopServiceForPublication(publicationId)
    if (!service) {
      return NextResponse.json({ error: 'SparkLoop not configured' }, { status: 500 })
    }

    // Create or fetch subscriber (need UUID for attribution)
    let subscriberUuid: string | null = null
    try {
      const subscriber = await service.createOrFetchSubscriber({
        email,
        country_code: countryCode,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      subscriberUuid = subscriber.uuid
      console.log(`[SparkLoop Recommend Subscribe] Subscriber ready: ${subscriberUuid}`)
    } catch (subError) {
      console.error('[SparkLoop Recommend Subscribe] Create/fetch subscriber failed:', subError)
    }

    // Subscribe with UUID for proper referral attribution
    await service.subscribeToNewsletters({
      subscriber_email: email,
      subscriber_uuid: subscriberUuid || undefined,
      country_code: countryCode,
      recommendations: refCode,
      utm_source: 'newsletter_module',
    })

    // Update click record (fire-and-forget)
    supabaseAdmin
      .from('sparkloop_module_clicks')
      .update({ sparkloop_called: true, sparkloop_success: true })
      .eq('id', clickRecordId)
      .then(({ error }) => {
        if (error) console.error('[SparkLoop Recommend Subscribe] Failed to update click record:', error)
      })

    // Record referral
    try {
      await supabaseAdmin
        .from('sparkloop_referrals')
        .upsert({
          publication_id: publicationId,
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
      console.error('[SparkLoop Recommend Subscribe] Failed to record referral:', refErr)
    }

    // Record event
    try {
      await supabaseAdmin.from('sparkloop_events').insert({
        publication_id: publicationId,
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
      console.error('[SparkLoop Recommend Subscribe] Failed to record event:', eventErr)
    }

    // Increment aggregates
    try {
      await supabaseAdmin.rpc('increment_our_subscribes', {
        p_publication_id: publicationId,
        p_ref_codes: [refCode],
      })
    } catch (aggErr) {
      console.error('[SparkLoop Recommend Subscribe] Failed to increment aggregates:', aggErr)
    }

    console.log(`[SparkLoop Recommend Subscribe] ${email} subscribed to ${rec.publication_name} via landing page`)

    return NextResponse.json({
      success: true,
      publication_name: rec.publication_name,
    })
  }
)
