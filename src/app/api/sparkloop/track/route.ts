import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { SparkLoopPopupEvent } from '@/types/sparkloop'

// Default publication ID for AI Pro Daily
const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

/**
 * POST /api/sparkloop/track
 *
 * Track popup interaction events for analytics
 * Stores events in sparkloop_events table
 * Also updates recommendation metrics (impressions, selections)
 */
export async function POST(request: NextRequest) {
  try {
    const event: SparkLoopPopupEvent = await request.json()

    if (!event.event_type || !event.subscriber_email) {
      return NextResponse.json(
        { error: 'event_type and subscriber_email are required' },
        { status: 400 }
      )
    }

    const eventType = event.event_type

    // Build metadata for raw_payload
    const metadata: Record<string, unknown> = {
      source: 'custom_popup',
      event_type: event.event_type,
      recommendation_count: event.recommendation_count,
      selected_count: event.selected_count,
      ref_codes: event.ref_codes,
      error_message: event.error_message,
      client_timestamp: event.timestamp,
    }

    // Store event in sparkloop_events table
    const { error } = await supabaseAdmin
      .from('sparkloop_events')
      .insert({
        publication_id: DEFAULT_PUBLICATION_ID,
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
          // Record impressions for all shown recommendations
          await supabaseAdmin.rpc('increment_sparkloop_impressions', {
            p_publication_id: DEFAULT_PUBLICATION_ID,
            p_ref_codes: event.ref_codes,
          })
          console.log(`[SparkLoop Track] Recorded ${event.ref_codes.length} impressions`)
        } else if (eventType === 'recommendation_selected') {
          // Record selection for the selected recommendation
          await supabaseAdmin.rpc('increment_sparkloop_selections', {
            p_publication_id: DEFAULT_PUBLICATION_ID,
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
  } catch (error) {
    console.error('[SparkLoop Track] Error:', error)

    // Don't fail the user experience for tracking errors
    return NextResponse.json({ success: false, error: 'Tracking failed' })
  }
}
