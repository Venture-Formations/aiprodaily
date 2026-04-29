import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { createHash } from 'crypto'
import { createSparkLoopServiceForPublication, fireMakeWebhook } from '@/lib/sparkloop-client'
import { supabaseAdmin } from '@/lib/supabase'
import { checkUserAgent } from '@/lib/bot-detection'
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils'
import { PUBLICATION_ID } from '@/lib/config'
import { MailerLiteService } from '@/lib/mailerlite'
import { getEmailProviderSettings, getPublicationSetting } from '@/lib/publication-settings'
import { updateBeehiivSubscriberField } from '@/lib/beehiiv'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.com'

/**
 * GET /api/sparkloop/module-subscribe?email=X&ref_code=Y&issue_id=Z
 *
 * One-click subscribe from newsletter email. Email links can't POST,
 * so this is a GET that performs the subscribe and redirects to confirmation.
 */
export const GET = withApiHandler(
  { authTier: 'public', logContext: 'sparkloop-module-subscribe' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const refCode = searchParams.get('ref_code')
    const issueId = searchParams.get('issue_id')

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
        .eq('publication_id', publicationId)

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
        .eq('publication_id', publicationId)
        .eq('ref_code', refCode)
        .single()

      const confirmUrl = new URL(`${BASE_URL}/website/subscribe/module-confirmed`)
      if (rec) confirmUrl.searchParams.set('name', rec.publication_name)
      return NextResponse.redirect(confirmUrl.toString())
    }

    // Verify ref_code is active and non-excluded
    const { data: rec } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('ref_code, publication_name, status, excluded')
      .eq('publication_id', publicationId)
      .eq('ref_code', refCode)
      .single()

    if (!rec || rec.status !== 'active' || rec.excluded) {
      return NextResponse.redirect(
        `${BASE_URL}/website/subscribe/module-confirmed?error=unavailable`
      )
    }

    const service = await createSparkLoopServiceForPublication(publicationId)
    if (!service) {
      return NextResponse.json({ error: 'SparkLoop not configured' }, { status: 500 })
    }

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

    // Step 3: Subscribe with UUID for proper referral attribution (non-blocking)
    let sparkloopSuccess = false
    let sparkloopError: string | undefined
    try {
      await service.subscribeToNewsletters({
        subscriber_email: email,
        subscriber_uuid: subscriberUuid || undefined,
        country_code: countryCode,
        recommendations: refCode,
        utm_source: 'newsletter_module',
      })
      sparkloopSuccess = true
    } catch (subscribeErr) {
      sparkloopError = subscribeErr instanceof Error ? subscribeErr.message : String(subscribeErr)
      console.error('[SparkLoop Module Subscribe] SparkLoop subscribe failed:', sparkloopError)
    }

    // Update click record with actual success state (fire-and-forget)
    supabaseAdmin
      .from('sparkloop_module_clicks')
      .update({ sparkloop_called: true, sparkloop_success: sparkloopSuccess })
      .eq('id', clickRecordId)
      .then(({ error }) => {
        if (error) console.error('[SparkLoop Module Subscribe] Failed to update click record:', error)
      })

    // Only write referral + aggregates when the subscribe actually succeeded
    if (sparkloopSuccess) {
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
        console.error('[SparkLoop Module Subscribe] Failed to record referral:', refErr)
      }

      try {
        await supabaseAdmin.rpc('increment_our_subscribes', {
          p_publication_id: publicationId,
          p_ref_codes: [refCode],
        })
      } catch (aggErr) {
        console.error('[SparkLoop Module Subscribe] Failed to increment aggregates:', aggErr)
      }
    }

    // Record event regardless (attempt is real even if SparkLoop failed)
    try {
      await supabaseAdmin.from('sparkloop_events').insert({
        publication_id: publicationId,
        event_type: sparkloopSuccess ? 'newsletter_module_subscribe' : 'newsletter_module_subscribe_failed',
        subscriber_email: email,
        raw_payload: {
          source: 'newsletter_module',
          ref_code: refCode,
          issue_id: issueId || null,
          subscriber_uuid: subscriberUuid,
          country_code: countryCode,
          sparkloop_error: sparkloopError,
          ip_hash: ipAddress ? createHash('sha256').update(ipAddress).digest('hex').slice(0, 16) : null,
        },
        event_timestamp: new Date().toISOString(),
      })
    } catch (eventErr) {
      console.error('[SparkLoop Module Subscribe] Failed to record event:', eventErr)
    }

    if (sparkloopSuccess) {
      console.log(`[SparkLoop Module Subscribe] ${email} subscribed to ${rec.publication_name} via newsletter module`)
    }

    // Update email provider subscriber field to mark as SparkLoop participant.
    // Fires regardless of SparkLoop API success — the user's click is the intent.
    // Retry once on "Subscriber not found" since the subscriber row may not be live yet.
    try {
      const providerSettings = await getEmailProviderSettings(publicationId)

      if (providerSettings.provider === 'beehiiv') {
        const { beehiivPublicationId, beehiivApiKey } = providerSettings
        if (beehiivPublicationId && beehiivApiKey) {
          let result = await updateBeehiivSubscriberField(email, 'sparkloop', 'true', beehiivPublicationId, beehiivApiKey)
          if (!result.success && result.error === 'Subscriber not found') {
            console.log(`[SparkLoop Module Subscribe] Subscriber ${email} not found in Beehiiv, waiting 2s and retrying...`)
            await new Promise(resolve => setTimeout(resolve, 2000))
            result = await updateBeehiivSubscriberField(email, 'sparkloop', 'true', beehiivPublicationId, beehiivApiKey)
          }
          if (result.success) {
            console.log(`[SparkLoop Module Subscribe] Updated Beehiiv SparkLoop field for ${email}`)
          } else {
            console.error('[SparkLoop Module Subscribe] Failed to update Beehiiv field:', result.error)
          }
        }
      } else {
        const mailerlite = new MailerLiteService()
        let result = await mailerlite.updateSubscriberField(email, 'sparkloop', 'true')
        if (!result.success && result.error === 'Subscriber not found') {
          console.log(`[SparkLoop Module Subscribe] Subscriber ${email} not found, waiting 2s and retrying...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          result = await mailerlite.updateSubscriberField(email, 'sparkloop', 'true')
        }
        if (result.success) {
          console.log(`[SparkLoop Module Subscribe] Updated MailerLite SparkLoop field for ${email}`)
        } else {
          console.error('[SparkLoop Module Subscribe] Failed to update MailerLite field:', result.error)
        }
      }
    } catch (providerError) {
      console.error('[SparkLoop Module Subscribe] Email provider update error:', providerError)
    }

    // Fire direct Make.com webhook (replaces the MailerLite-segment-triggered path).
    if (subscriberUuid) {
      const webhookUrl = await getPublicationSetting(publicationId, 'sparkloop_webhook_url')
      await fireMakeWebhook(
        webhookUrl,
        { subscriber_email: email, subscriber_id: subscriberUuid },
        { publicationId }
      )
    } else {
      console.log('[SparkLoop Module Subscribe] Skipping Make webhook: no subscriber_uuid available')
    }

    // Redirect to confirmation page
    const confirmUrl = new URL(`${BASE_URL}/website/subscribe/module-confirmed`)
    confirmUrl.searchParams.set('name', rec.publication_name)
    return NextResponse.redirect(confirmUrl.toString())
  }
)
