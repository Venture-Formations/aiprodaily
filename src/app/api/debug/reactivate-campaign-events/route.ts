import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({
        error: 'campaign_id parameter required'
      }, { status: 400 })
    }

    console.log('Reactivating events for campaign:', campaignId)

    // Get all event IDs for this campaign
    const { data: campaignEvents, error: fetchError } = await supabaseAdmin
      .from('campaign_events')
      .select('event_id')
      .eq('campaign_id', campaignId)
      .eq('is_selected', true)

    if (fetchError) {
      throw fetchError
    }

    const eventIds = campaignEvents?.map(ce => ce.event_id) || []

    if (eventIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No events to reactivate',
        campaign_id: campaignId,
        events_reactivated: 0
      })
    }

    console.log(`Found ${eventIds.length} events to reactivate:`, eventIds)

    // Reactivate all these events
    const { error: updateError } = await supabaseAdmin
      .from('events')
      .update({ active: true, updated_at: new Date().toISOString() })
      .in('id', eventIds)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      message: `Reactivated ${eventIds.length} events for campaign`,
      campaign_id: campaignId,
      events_reactivated: eventIds.length,
      event_ids: eventIds
    })

  } catch (error) {
    console.error('Error reactivating campaign events:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}