import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { SparkLoopService } from '@/lib/sparkloop-client'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

// Default publication ID for AI Pro Daily
const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, refCodes, source } = body
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

    const service = new SparkLoopService()

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
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
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
    const subscribeResult = await service.subscribeToNewsletters({
      subscriber_email: email,
      subscriber_uuid: subscriberUuid || undefined,
      country_code: countryCode,
      recommendations: activeRefCodes.join(','),
      utm_source: submissionSource,
    })

    // Record the SparkLoop API confirmation as a server-side event
    try {
      await supabaseAdmin.from('sparkloop_events').insert({
        publication_id: DEFAULT_PUBLICATION_ID,
        event_type: 'api_subscribe_confirmed',
        subscriber_email: email,
        raw_payload: {
          source: 'server',
          submission_source: submissionSource,
          subscriber_uuid: subscriberUuid,
          country_code: countryCode,
          ref_codes: activeRefCodes,
          filtered_out: filteredOut.length > 0 ? filteredOut : undefined,
          sparkloop_response: subscribeResult.response,
          ip_hash: ipAddress ? createHash('sha256').update(ipAddress).digest('hex').slice(0, 16) : null,
          selected_count: activeRefCodes.length,
          shown_count: 5,
        },
        event_timestamp: new Date().toISOString(),
      })
    } catch (eventError) {
      console.error('[SparkLoop Subscribe] Failed to record API confirmation event:', eventError)
    }

    // Record submissions in our metrics (increments submissions and pending counts)
    try {
      await supabaseAdmin.rpc('increment_sparkloop_submissions', {
        p_publication_id: DEFAULT_PUBLICATION_ID,
        p_ref_codes: activeRefCodes,
      })
      console.log(`[SparkLoop Subscribe] Recorded ${activeRefCodes.length} submissions`)
    } catch (metricsError) {
      console.error('[SparkLoop Subscribe] Failed to record metrics:', metricsError)
      // Don't fail the request for metrics errors
    }

    // Record referral rows in sparkloop_referrals (one per ref_code)
    try {
      const referralRows = activeRefCodes.map((refCode: string) => ({
        publication_id: DEFAULT_PUBLICATION_ID,
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
        // Increment our_total_subscribes and our_pending on recommendations
        const { error: aggError } = await supabaseAdmin.rpc('increment_our_subscribes', {
          p_publication_id: DEFAULT_PUBLICATION_ID,
          p_ref_codes: activeRefCodes,
        })
        if (aggError) {
          console.error('[SparkLoop Subscribe] Failed to increment aggregates:', aggError)
        }
        console.log(`[SparkLoop Subscribe] Recorded ${activeRefCodes.length} referral rows`)
      }
    } catch (referralError) {
      console.error('[SparkLoop Subscribe] Failed to record referrals:', referralError)
      // Don't fail the request for referral tracking errors
    }

    // Update MailerLite subscriber field to mark as SparkLoop participant
    // Use retry with delay since subscriber might not be fully created yet
    try {
      const mailerlite = new MailerLiteService()
      let result = await mailerlite.updateSubscriberField(email, 'sparkloop', 'true')

      // If subscriber not found, wait and retry (timing issue with new subscribers)
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
    } catch (mailerliteError) {
      console.error('[SparkLoop Subscribe] MailerLite update error:', mailerliteError)
      // Don't fail the request for MailerLite errors
    }

    console.log(`[SparkLoop Subscribe] Successfully subscribed ${email} to ${activeRefCodes.length} newsletters${filteredOut.length > 0 ? ` (${filteredOut.length} filtered out as paused/excluded)` : ''}`)

    return NextResponse.json({
      success: true,
      subscribedCount: activeRefCodes.length,
    })
  } catch (error) {
    console.error('[SparkLoop Subscribe] Failed:', error)

    return NextResponse.json(
      {
        error: 'Failed to subscribe to newsletters',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
