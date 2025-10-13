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

    console.log('Refreshing event selection for campaign:', campaignId)

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('id, date')
      .eq('id', campaignId)
      .single()

    if (campaignError) {
      console.error('Campaign query error:', campaignError)
      throw new Error(`Campaign not found: ${campaignError.message}`)
    }

    if (!campaign) {
      throw new Error('Campaign not found - no data returned')
    }

    // Calculate 3-day range from campaign date
    const campaignDate = new Date(campaign.date + 'T00:00:00')
    const dates = []
    for (let i = 0; i <= 2; i++) {
      const date = new Date(campaignDate)
      date.setDate(campaignDate.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }

    console.log('Campaign date range:', dates)

    // Clear existing event selections
    const { error: deleteError } = await supabaseAdmin
      .from('campaign_events')
      .delete()
      .eq('campaign_id', campaignId)

    if (deleteError) {
      console.error('Error clearing existing events:', deleteError)
    } else {
      console.log('Cleared existing event selections')
    }

    let totalEventsAdded = 0

    // For each date, select events
    for (const dateStr of dates) {
      console.log(`\nProcessing events for ${dateStr}...`)

      // Get events for this date (events that occur on this date)
      const dateStart = new Date(dateStr + 'T00:00:00-05:00')
      const dateEnd = new Date(dateStr + 'T23:59:59-05:00')

      console.log(`Querying events between ${dateStart.toISOString()} and ${dateEnd.toISOString()}`)

      const { data: availableEvents, error: eventsError } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('active', true)
        .lte('start_date', dateEnd.toISOString())
        .or(`end_date.gte.${dateStart.toISOString()},end_date.is.null`)
        .order('start_date', { ascending: true })
        .limit(8)

      if (eventsError) {
        console.error(`Error fetching events for ${dateStr}:`, eventsError)
        continue
      }

      if (!availableEvents || availableEvents.length === 0) {
        console.log(`No events found for ${dateStr}`)
        continue
      }

      console.log(`Found ${availableEvents.length} events for ${dateStr}`)

      // Create campaign_events entries
      const campaignEvents = availableEvents.map((event, index) => ({
        campaign_id: campaignId,
        event_id: event.id,
        event_date: dateStr,
        is_selected: true,
        is_featured: index === 0, // First event is featured
        display_order: index + 1
      }))

      const { error: insertError } = await supabaseAdmin
        .from('campaign_events')
        .insert(campaignEvents)

      if (insertError) {
        console.error(`Error inserting campaign events for ${dateStr}:`, insertError)
      } else {
        console.log(`Added ${campaignEvents.length} events for ${dateStr}`)
        totalEventsAdded += campaignEvents.length
      }
    }

    return NextResponse.json({
      success: true,
      message: `Refreshed event selection for campaign`,
      campaign_id: campaignId,
      date_range: dates,
      total_events_added: totalEventsAdded
    })

  } catch (error) {
    console.error('Error refreshing campaign events:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}