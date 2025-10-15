import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

// GET /api/campaigns/[id]/events - Fetch campaign events
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    // Fetch campaign events with event details
    const { data: campaignEvents, error } = await supabaseAdmin
      .from('campaign_events')
      .select(`
        id,
        campaign_id,
        event_id,
        event_date,
        is_featured,
        created_at,
        events (
          id,
          title,
          start_date,
          end_date,
          location,
          description,
          event_summary,
          image_url,
          url,
          category
        )
      `)
      .eq('campaign_id', id)
      .order('event_date', { ascending: true })

    if (error) {
      console.error('Failed to fetch campaign events:', error)
      return NextResponse.json(
        { error: 'Failed to fetch campaign events', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      campaign_events: campaignEvents || []
    })

  } catch (error) {
    console.error('Error in GET /api/campaigns/[id]/events:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PATCH /api/campaigns/[id]/events - Update event selections for a specific date
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: campaignId } = await context.params
    const body = await request.json()
    const { event_date, selected_events, featured_event } = body

    if (!event_date || !Array.isArray(selected_events)) {
      return NextResponse.json(
        { error: 'event_date and selected_events array are required' },
        { status: 400 }
      )
    }

    console.log(`Updating events for campaign ${campaignId}, date ${event_date}`)
    console.log(`Selected events: ${selected_events.length}`)
    console.log(`Featured event: ${featured_event || 'none'}`)

    // Delete existing events for this date
    const { error: deleteError } = await supabaseAdmin
      .from('campaign_events')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('event_date', event_date)

    if (deleteError) {
      console.error('Failed to delete existing events:', deleteError)
      return NextResponse.json(
        { error: 'Failed to update events', details: deleteError.message },
        { status: 500 }
      )
    }

    // Insert new event selections
    if (selected_events.length > 0) {
      const newEvents = selected_events.map(eventId => ({
        campaign_id: campaignId,
        event_id: eventId,
        event_date: event_date,
        is_featured: eventId === featured_event
      }))

      const { error: insertError } = await supabaseAdmin
        .from('campaign_events')
        .insert(newEvents)

      if (insertError) {
        console.error('Failed to insert new events:', insertError)
        return NextResponse.json(
          { error: 'Failed to update events', details: insertError.message },
          { status: 500 }
        )
      }
    }

    console.log('Events updated successfully')

    // Fetch updated campaign events
    const { data: campaignEvents, error: fetchError } = await supabaseAdmin
      .from('campaign_events')
      .select(`
        id,
        campaign_id,
        event_id,
        event_date,
        is_featured,
        created_at,
        events (
          id,
          title,
          start_date,
          end_date,
          location,
          description,
          event_summary,
          image_url,
          url,
          category
        )
      `)
      .eq('campaign_id', campaignId)
      .order('event_date', { ascending: true })

    if (fetchError) {
      console.error('Failed to fetch updated events:', fetchError)
      // Don't fail the request, just return success without updated data
      return NextResponse.json({
        success: true,
        message: 'Events updated successfully'
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Events updated successfully',
      campaign_events: campaignEvents || []
    })

  } catch (error) {
    console.error('Error in PATCH /api/campaigns/[id]/events:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
