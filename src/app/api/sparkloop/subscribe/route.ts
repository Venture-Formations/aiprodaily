import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { createHash } from 'crypto'
import { cookies } from 'next/headers'
import { createSparkLoopServiceForPublication } from '@/lib/sparkloop-client'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'
import { PUBLICATION_ID } from '@/lib/config'
import { getEmailProviderSettings } from '@/lib/publication-settings'
import { updateBeehiivSubscriberField } from '@/lib/beehiiv'
import {
  attributeByVisitor,
  attributeBySubscriberEmail,
  recordEvent,
  VISITOR_COOKIE,
} from '@/lib/ab-tests'

/**
 * POST /api/sparkloop/subscribe
 *
 * Subscribe a user to selected newsletter recommendations
 * Follows SparkLoop's 3-step Upscribe flow:
 *   1. Get recommendations (already done client-side via /api/sparkloop/recommendations)
 *   2. Create/fetch subscriber in SparkLoop
 *   3. Subscribe to selected newsletters
 *
 * Country code is detected server-side from Vercel's x-vercel-ip-country header.
 */
export const POST = withApiHandler(
  { authTier: 'public', logContext: 'sparkloop-subscribe' },
  async ({ request, logger }) => {
    const body = await request.json()
    const { email, refCodes, source, publicationId: bodyPublicationId } = body
    const submissionSource = source === 'recs_page' ? 'recs_page' : 'custom_popup'

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    if (!refCodes || !Array.isArray(refCodes) || refCodes.length === 0) {
      return NextResponse.json(
        { error: 'At least one recommendation must be selected' },
        { status: 400 }
      )
    }

    // Resolve publication from request body, fall back to default
    const publicationId = bodyPublicationId || PUBLICATION_ID

    const service = await createSparkLoopServiceForPublication(publicationId)
    if (!service) {
      return NextResponse.json({ error: 'SparkLoop not configured' }, { status: 500 })
    }

    // Detect country from Vercel geo header (fallback: 'US')
    const countryCode = request.headers.get('x-vercel-ip-country') || 'US'
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    const userAgent = request.headers.get('user-agent') || undefined

    console.log(`[SparkLoop Subscribe] Detected country: ${countryCode}, IP: ${ipAddress ? 'present' : 'none'}`)

    // Validate: only subscribe to active, non-excluded recommendations
    // This prevents stale popup selections from subscribing to paused/excluded recs
    const { data: activeRecs } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('ref_code')
      .eq('publication_id', publicationId)
      .eq('status', 'active')
      .or('excluded.is.null,excluded.eq.false')
      .in('ref_code', refCodes)

    const activeRefCodes = activeRecs?.map(r => r.ref_code) || []
    const filteredOut = refCodes.filter((rc: string) => !activeRefCodes.includes(rc))

    if (filteredOut.length > 0) {
      console.log(`[SparkLoop Subscribe] Filtered out ${filteredOut.length} paused/excluded recs: ${filteredOut.join(', ')}`)
    }

    if (activeRefCodes.length === 0) {
      console.log('[SparkLoop Subscribe] No active recommendations to subscribe to after filtering')
      return NextResponse.json({
        success: true,
        subscribedCount: 0,
        filtered: filteredOut,
      })
    }

    // Step 2: Create or fetch subscriber in SparkLoop (non-blocking)
    let subscriberUuid: string | null = null
    try {
      const subscriber = await service.createOrFetchSubscriber({
        email,
        country_code: countryCode,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      subscriberUuid = subscriber.uuid
      console.log(`[SparkLoop Subscribe] Subscriber ready: ${subscriberUuid}`)
    } catch (subError) {
      // Non-blocking: log but continue with subscribe
      console.error('[SparkLoop Subscribe] Step 2 (create/fetch subscriber) failed:', subError)
    }

    // Step 3: Subscribe to selected newsletters (only active ones)
    // subscriber_uuid is required for proper referral tracking attribution
    // Non-blocking: if this fails (e.g. SparkLoop API outage), we still want to record the
    // attempt and flip the MailerLite/Beehiiv `sparkloop` field so our system stays consistent.
    let subscribeResult: { success: boolean; response?: unknown; error?: string } = { success: false }
    try {
      subscribeResult = await service.subscribeToNewsletters({
        subscriber_email: email,
        subscriber_uuid: subscriberUuid || undefined,
        country_code: countryCode,
        recommendations: activeRefCodes.join(','),
        utm_source: submissionSource,
      })
    } catch (subscribeError) {
      const errMsg = subscribeError instanceof Error ? subscribeError.message : String(subscribeError)
      console.error('[SparkLoop Subscribe] Step 3 (subscribe to newsletters) failed:', errMsg)
      subscribeResult = { success: false, error: errMsg }
    }

    // Record the SparkLoop API attempt as a server-side event (confirmed or failed)
    try {
      await supabaseAdmin.from('sparkloop_events').insert({
        publication_id: publicationId,
        event_type: subscribeResult.success ? 'api_subscribe_confirmed' : 'api_subscribe_failed',
        subscriber_email: email,
        raw_payload: {
          source: 'server',
          submission_source: submissionSource,
          subscriber_uuid: subscriberUuid,
          country_code: countryCode,
          ref_codes: activeRefCodes,
          filtered_out: filteredOut.length > 0 ? filteredOut : undefined,
          sparkloop_response: subscribeResult.response,
          sparkloop_error: subscribeResult.error,
          ip_hash: ipAddress ? createHash('sha256').update(ipAddress).digest('hex').slice(0, 16) : null,
          selected_count: activeRefCodes.length,
          shown_count: 5,
        },
        event_timestamp: new Date().toISOString(),
      })
    } catch (eventError) {
      console.error('[SparkLoop Subscribe] Failed to record API event:', eventError)
    }

    // Only record submissions metrics and referrals when the SparkLoop subscribe actually succeeded.
    // If Step 3 failed, the user wasn't subscribed to anything — our metrics should not say otherwise.
    if (subscribeResult.success) {
      try {
        const submissionRpc = submissionSource === 'recs_page'
          ? 'increment_sparkloop_page_submissions'
          : 'increment_sparkloop_submissions'
        await supabaseAdmin.rpc(submissionRpc, {
          p_publication_id: publicationId,
          p_ref_codes: activeRefCodes,
        })
        console.log(`[SparkLoop Subscribe] Recorded ${activeRefCodes.length} ${submissionSource === 'recs_page' ? 'page' : 'popup'} submissions`)
      } catch (metricsError) {
        console.error('[SparkLoop Subscribe] Failed to record metrics:', metricsError)
      }

      try {
        const referralRows = activeRefCodes.map((refCode: string) => ({
          publication_id: publicationId,
          subscriber_email: email,
          ref_code: refCode,
          source: submissionSource,
          status: 'subscribed',
          subscribed_at: new Date().toISOString(),
        }))

        const { error: refError } = await supabaseAdmin
          .from('sparkloop_referrals')
          .upsert(referralRows, { onConflict: 'publication_id,subscriber_email,ref_code', ignoreDuplicates: true })

        if (refError) {
          console.error('[SparkLoop Subscribe] Failed to record referrals:', refError)
        } else {
          const { error: aggError } = await supabaseAdmin.rpc('increment_our_subscribes', {
            p_publication_id: publicationId,
            p_ref_codes: activeRefCodes,
          })
          if (aggError) {
            console.error('[SparkLoop Subscribe] Failed to increment aggregates:', aggError)
          }
          console.log(`[SparkLoop Subscribe] Recorded ${activeRefCodes.length} referral rows`)
        }
      } catch (referralError) {
        console.error('[SparkLoop Subscribe] Failed to record referrals:', referralError)
      }
    }

    // Update email provider subscriber field to mark as SparkLoop participant
    // Use retry with delay since subscriber might not be fully created yet
    try {
      const providerSettings = await getEmailProviderSettings(publicationId)

      if (providerSettings.provider === 'beehiiv') {
        const { beehiivPublicationId, beehiivApiKey } = providerSettings
        if (beehiivPublicationId && beehiivApiKey) {
          let result = await updateBeehiivSubscriberField(email, 'sparkloop', 'true', beehiivPublicationId, beehiivApiKey)
          if (!result.success && result.error === 'Subscriber not found') {
            console.log(`[SparkLoop Subscribe] Subscriber ${email} not found in Beehiiv, waiting 2s and retrying...`)
            await new Promise(resolve => setTimeout(resolve, 2000))
            result = await updateBeehiivSubscriberField(email, 'sparkloop', 'true', beehiivPublicationId, beehiivApiKey)
          }
          if (result.success) {
            console.log(`[SparkLoop Subscribe] Updated Beehiiv SparkLoop field for ${email}`)
          } else {
            console.error('[SparkLoop Subscribe] Failed to update Beehiiv field:', result.error)
          }
        }
      } else {
        const mailerlite = new MailerLiteService()
        let result = await mailerlite.updateSubscriberField(email, 'sparkloop', 'true')
        if (!result.success && result.error === 'Subscriber not found') {
          console.log(`[SparkLoop Subscribe] Subscriber ${email} not found, waiting 2s and retrying...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          result = await mailerlite.updateSubscriberField(email, 'sparkloop', 'true')
        }
        if (result.success) {
          console.log(`[SparkLoop Subscribe] Updated MailerLite SparkLoop field for ${email}`)
        } else {
          console.error('[SparkLoop Subscribe] Failed to update MailerLite field:', result.error)
        }
      }
    } catch (providerError) {
      console.error('[SparkLoop Subscribe] Email provider update error:', providerError)
      // Don't fail the request for email provider errors
    }

    // Record A/B sparkloop_signup conversion only on actual SparkLoop success.
    // Cookie may or may not be present (user can land on /subscribe/recommendations
    // without going through /subscribe first) — fall back to email-based lookup.
    if (subscribeResult.success) {
      try {
        const cookieStore = await cookies()
        const visitorId = cookieStore.get(VISITOR_COOKIE)?.value || null

        const attribution = visitorId
          ? await attributeByVisitor(publicationId, visitorId)
          : await attributeBySubscriberEmail(publicationId, email)

        if (attribution) {
          await recordEvent(attribution.testId, attribution.variantId, 'sparkloop_signup', {
            publicationId,
            visitorId,
            subscriberEmail: email,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            metadata: {
              ref_codes: activeRefCodes,
              submission_source: submissionSource,
            },
          })
        }
      } catch (abError) {
        console.error('[SparkLoop Subscribe] A/B sparkloop_signup event failed:', abError)
      }
    }

    if (subscribeResult.success) {
      console.log(`[SparkLoop Subscribe] Successfully subscribed ${email} to ${activeRefCodes.length} newsletters${filteredOut.length > 0 ? ` (${filteredOut.length} filtered out as paused/excluded)` : ''}`)
    } else {
      console.error(`[SparkLoop Subscribe] SparkLoop subscribe failed for ${email}; MailerLite field still updated. Error: ${subscribeResult.error}`)
    }

    return NextResponse.json({
      success: subscribeResult.success,
      subscribedCount: subscribeResult.success ? activeRefCodes.length : 0,
      error: subscribeResult.success ? undefined : subscribeResult.error,
    })
  }
)
