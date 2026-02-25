import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'
import type { SparkLoopPopupEvent } from '@/types/sparkloop'

/**
 * POST /api/sparkloop/track
 *
 * Track popup interaction events for analytics
 * Stores events in sparkloop_events table
 * Also updates recommendation metrics (impressions, selections)
 */
export const POST = withApiHandler(
  { authTier: 'public', logContext: 'sparkloop-track' },
  async ({ request, logger }) => {
    const event: SparkLoopPopupEvent & { source?: string } = await request.json()

    if (!event.event_type || !event.subscriber_email) {
      return NextResponse.json(
        { error: 'event_type and subscriber_email are required' },
        { status: 400 }
      )
    }

    const eventType = event.event_type

    // Extract IP hash for subscription events
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    const ipHash = ipAddress ? createHash('sha256').update(ipAddress).digest('hex').slice(0, 16) : null

    // Build metadata for raw_payload
    const metadata: Record<string, unknown> = {
      source: event.source || 'custom_popup',
      event_type: event.event_type,
      recommendation_count: event.recommendation_count,
      selected_count: event.selected_count,
      ref_codes: event.ref_codes,
      error_message: event.error_message,
      client_timestamp: event.timestamp,
      ...(eventType === 'subscriptions_success' && { ip_hash: ipHash }),
    }

    // Store event in sparkloop_events table
    const { error } = await supabaseAdmin
      .from('sparkloop_events')
      .insert({
        publication_id: PUBLICATION_ID,
        event_type: eventType,
        subscriber_email: event.subscriber_email,
        raw_payload: metadata,
        event_timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
      })

    if (error && error.code !== '23505') {
      console.error('[SparkLoop Track] Failed to store event:', error)
    }

    // Update recommendation metrics based on event type
    if (event.ref_codes && event.ref_codes.length > 0) {
      try {
        if (eventType === 'popup_opened') {
          // Record impressions -- route to popup or page column based on source
          const isRecsPage = event.source === 'recs_page'
          const rpcName = isRecsPage
            ? 'increment_sparkloop_page_impressions'
            : 'increment_sparkloop_impressions'
          await supabaseAdmin.rpc(rpcName, {
            p_publication_id: PUBLICATION_ID,
            p_ref_codes: event.ref_codes,
          })
          console.log(`[SparkLoop Track] Recorded ${event.ref_codes.length} ${isRecsPage ? 'page' : 'popup'} impressions`)
        } else if (eventType === 'recommendation_selected') {
          // Record selection for the selected recommendation
          await supabaseAdmin.rpc('increment_sparkloop_selections', {
            p_publication_id: PUBLICATION_ID,
            p_ref_codes: event.ref_codes,
          })
          console.log(`[SparkLoop Track] Recorded selection for ${event.ref_codes[0]}`)
        }
      } catch (metricsError) {
        console.error('[SparkLoop Track] Failed to update metrics:', metricsError)
        // Don't fail the request for metrics errors
      }
    }

    console.log(`[SparkLoop Track] Recorded: ${eventType} for ${event.subscriber_email}`)

    return NextResponse.json({ success: true })
  }
)
