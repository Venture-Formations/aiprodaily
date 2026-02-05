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

    // Map popup events to database event types
    const eventType = `popup_${event.event_type}`

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

    const { error } = await supabaseAdmin
      .from('sparkloop_events')
      .insert({
        publication_id: DEFAULT_PUBLICATION_ID,
        event_type: eventType,
        subscriber_email: event.subscriber_email,
        raw_payload: metadata,
        event_timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
      })

    if (error) {
      // Ignore duplicate constraint violations
      if (error.code === '23505') {
        console.log(`[SparkLoop Track] Duplicate event ignored: ${eventType}`)
        return NextResponse.json({ success: true, duplicate: true })
      }
      console.error('[SparkLoop Track] Failed to store event:', error)
      throw error
    }

    console.log(`[SparkLoop Track] Recorded: ${eventType} for ${event.subscriber_email}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SparkLoop Track] Error:', error)

    // Don't fail the user experience for tracking errors
    return NextResponse.json({ success: false, error: 'Tracking failed' })
  }
}
