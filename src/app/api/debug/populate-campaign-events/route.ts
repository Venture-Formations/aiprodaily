import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id parameter required' }, { status: 400 })
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    console.log(`Populating events for campaign ${campaignId} (${campaign.date})`)

    // Calculate 3-day range starting from the newsletter date (campaign.date)
    const newsletterDate = new Date(campaign.date + 'T00:00:00') // Parse as local date

    const dates = []
    for (let i = 0; i <= 2; i++) {
      const date = new Date(newsletterDate)
      date.setDate(newsletterDate.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }

    console.log('Event population date range:', dates)

    // Get available events for the date range
    const startDate = dates[0]
    const endDate = dates[dates.length - 1]

    const { data: availableEvents, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .gte('start_date', startDate)
      .lte('start_date', endDate + 'T23:59:59')
      .eq('active', true)
      .order('start_date', { ascending: true })

    if (eventsError) {
      return NextResponse.json({ error: `Failed to fetch events: ${eventsError.message}` }, { status: 500 })
    }

    console.log(`Found ${availableEvents?.length || 0} available events for population`)

    if (!availableEvents || availableEvents.length === 0) {
      return NextResponse.json({
        error: 'No events found for date range',
        dateRange: `${startDate} to ${endDate}`,
        dates: dates
      }, { status: 404 })
    }

    // Clear existing campaign events
    const { error: deleteError } = await supabaseAdmin
      .from('campaign_events')
      .delete()
      .eq('campaign_id', campaignId)

    if (deleteError) {
      console.warn('Warning: Failed to clear existing campaign events:', deleteError)
    }

    // Group events by date and auto-select up to 8 events per day
    const eventsByDate: { [key: string]: any[] } = {}

    dates.forEach(date => {
      const dateStart = new Date(date + 'T00:00:00-05:00')
      const dateEnd = new Date(date + 'T23:59:59-05:00')

      const eventsForDate = availableEvents.filter(event => {
        const eventStart = new Date(event.start_date)
        const eventEnd = event.end_date ? new Date(event.end_date) : eventStart
        return (eventStart <= dateEnd && eventEnd >= dateStart)
      })

      if (eventsForDate.length > 0) {
        // Auto-select up to 8 events per day, randomly selected
        const shuffled = [...eventsForDate].sort(() => Math.random() - 0.5)
        eventsByDate[date] = shuffled.slice(0, Math.min(8, eventsForDate.length))
      }
    })

    // Insert campaign events
    const campaignEventsData: any[] = []
    let totalSelected = 0

    Object.entries(eventsByDate).forEach(([date, events]) => {
      events.forEach((event, index) => {
        campaignEventsData.push({
          campaign_id: campaignId,
          event_id: event.id,
          event_date: date,
          is_selected: true,
          is_featured: index === 0, // First event of each day is featured
          display_order: index + 1
        })
        totalSelected++
      })
    })

    if (campaignEventsData.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('campaign_events')
        .insert(campaignEventsData)

      if (insertError) {
        return NextResponse.json({ error: `Failed to insert events: ${insertError.message}` }, { status: 500 })
      }

      console.log(`Successfully populated ${totalSelected} events across ${Object.keys(eventsByDate).length} dates`)
    }

    return NextResponse.json({
      success: true,
      message: 'Events populated successfully',
      campaign: {
        id: campaign.id,
        date: campaign.date,
        status: campaign.status
      },
      population: {
        dateRange: dates,
        availableEvents: availableEvents.length,
        selectedEvents: totalSelected,
        datesWithEvents: Object.keys(eventsByDate).length,
        eventsByDate: Object.keys(eventsByDate).reduce((acc, date) => {
          acc[date] = eventsByDate[date].length
          return acc
        }, {} as any)
      }
    })

  } catch (error) {
    console.error('Event population error:', error)
    return NextResponse.json({
      error: 'Failed to populate events',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}