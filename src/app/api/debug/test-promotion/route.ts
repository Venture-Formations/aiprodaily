import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const existingEventId = searchParams.get('existing_event_id')

  if (!existingEventId) {
    return NextResponse.json({
      error: 'Please provide existing_event_id parameter',
      example: '/api/debug/test-promotion?existing_event_id=YOUR_EVENT_ID'
    }, { status: 400 })
  }

  try {
    // Check if event exists
    const { data: existingEvent, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', existingEventId)
      .single()

    if (fetchError || !existingEvent) {
      return NextResponse.json({
        error: 'Event not found',
        event_id: existingEventId
      }, { status: 404 })
    }

    console.log(`[Test Promotion] Found existing event: ${existingEvent.title}`)

    // Simulate the webhook promotion logic
    console.log(`[Test Promotion] Marking original event ${existingEventId} as inactive`)

    const { error: deactivateError } = await supabaseAdmin
      .from('events')
      .update({ active: false })
      .eq('id', existingEventId)

    if (deactivateError) {
      console.error('[Test Promotion] Error deactivating:', deactivateError)
      return NextResponse.json({
        error: 'Failed to deactivate original event',
        details: deactivateError
      }, { status: 500 })
    }

    // Create promoted version
    const { data: promotedEvent, error: insertError } = await supabaseAdmin
      .from('events')
      .insert({
        external_id: `promoted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: existingEvent.title,
        description: existingEvent.description,
        start_date: existingEvent.start_date,
        end_date: existingEvent.end_date,
        venue: existingEvent.venue,
        address: existingEvent.address,
        url: existingEvent.url,
        image_url: existingEvent.image_url,
        submitter_name: 'Test User',
        submitter_email: 'test@example.com',
        submission_status: 'approved',
        paid_placement: true, // Promoted as paid placement
        featured: false,
        active: true,
        payment_status: 'completed',
        payment_intent_id: 'test_promotion',
        payment_amount: 5.00,
        raw_data: { promoted_from: existingEventId },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Test Promotion] Error creating promoted event:', insertError)
      return NextResponse.json({
        error: 'Failed to create promoted event',
        details: insertError
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully promoted event',
      original_event: {
        id: existingEvent.id,
        title: existingEvent.title,
        active: false,
        was_active: existingEvent.active
      },
      promoted_event: {
        id: promotedEvent.id,
        title: promotedEvent.title,
        active: true,
        paid_placement: true
      }
    })

  } catch (error) {
    console.error('[Test Promotion] Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
