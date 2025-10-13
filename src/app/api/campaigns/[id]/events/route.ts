import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params

    // Get campaign events with event details
    const { data: campaignEvents, error } = await supabaseAdmin
      .from('campaign_events')
      .select(`
        *,
        event:events(*)
      `)
      .eq('campaign_id', campaignId)
      .order('event_date, display_order')

    if (error) {
      throw error
    }

    return NextResponse.json({
      campaign_events: campaignEvents || []
    })

  } catch (error) {
    console.error('Failed to fetch campaign events:', error)
    return NextResponse.json({
      error: 'Failed to fetch campaign events',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params
    const body = await request.json()
    const { event_date, selected_events, featured_event } = body

    if (!event_date || !Array.isArray(selected_events)) {
      return NextResponse.json({
        error: 'event_date and selected_events array are required'
      }, { status: 400 })
    }

    // Validate max 8 events per day
    if (selected_events.length > 8) {
      return NextResponse.json({
        error: 'Maximum 8 events can be selected per day'
      }, { status: 400 })
    }

    // Delete existing campaign events for this date
    const { error: deleteError } = await supabaseAdmin
      .from('campaign_events')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('event_date', event_date)

    if (deleteError) {
      throw deleteError
    }

    // Insert new campaign events
    const campaignEventsData = selected_events.map((eventId, index) => ({
      campaign_id: campaignId,
      event_id: eventId,
      event_date,
      is_selected: true,
      is_featured: eventId === featured_event,
      display_order: index + 1
    }))

    if (campaignEventsData.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('campaign_events')
        .insert(campaignEventsData)

      if (insertError) {
        throw insertError
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${selected_events.length} events for ${event_date}`,
      event_date,
      selected_count: selected_events.length,
      featured_event
    })

  } catch (error) {
    console.error('Failed to update campaign events:', error)
    return NextResponse.json({
      error: 'Failed to update campaign events',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}