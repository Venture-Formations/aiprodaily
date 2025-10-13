import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id parameter required' }, { status: 400 })
    }

    console.log('Testing events HTML generation for campaign:', campaignId)

    // Get campaign with events data
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        campaign_events(
          id,
          event_date,
          is_selected,
          is_featured,
          display_order,
          event:events(
            id,
            title,
            description,
            start_date,
            end_date,
            venue,
            address,
            url,
            image_url
          )
        )
      `)
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    console.log('Campaign found:', campaign.date)
    console.log('Campaign events count:', campaign.campaign_events?.length || 0)

    // Test the private generateLocalEventsSection method by calling the MailerLite service
    const mailerLiteService = new MailerLiteService()

    // We need to call the method indirectly since it's private
    // Let's simulate the same logic here for debugging

    // Calculate 3-day range starting from the newsletter date (campaign.date)
    const newsletterDate = new Date(campaign.date + 'T00:00:00')

    const dates = []
    for (let i = 0; i <= 2; i++) {
      const date = new Date(newsletterDate)
      date.setDate(newsletterDate.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }

    console.log('Calculated dates:', dates)

    // Fetch events for the calculated date range
    const startDate = dates[0]
    const endDate = dates[dates.length - 1]

    const { data: availableEvents } = await supabaseAdmin
      .from('events')
      .select('*')
      .gte('start_date', startDate)
      .lte('start_date', endDate + 'T23:59:59')
      .eq('active', true)
      .order('start_date', { ascending: true })

    console.log(`Found ${availableEvents?.length || 0} available events for date range ${startDate} to ${endDate}`)

    // Get the campaign events to determine which are selected and featured
    const { data: campaignEvents } = await supabaseAdmin
      .from('campaign_events')
      .select('*')
      .eq('campaign_id', campaign.id)

    console.log(`Found ${campaignEvents?.length || 0} campaign events`)

    const campaignEventsMap = new Map()
    campaignEvents?.forEach(ce => {
      const key = `${ce.event_id}_${ce.event_date}`
      campaignEventsMap.set(key, ce)
      console.log(`Campaign event map key: ${key}, is_selected: ${ce.is_selected}, is_featured: ${ce.is_featured}`)
    })

    // Filter events by date and selection status
    const eventsByDate: { [key: string]: any[] } = {}
    const debugInfo: { [key: string]: any } = {}

    dates.forEach(date => {
      debugInfo[date] = {
        availableEvents: [],
        selectedEvents: [],
        filteredOut: []
      }

      // Filter events that occur on this date
      const dateStart = new Date(date + 'T00:00:00-05:00')
      const dateEnd = new Date(date + 'T23:59:59-05:00')

      const eventsForDate = availableEvents?.filter(event => {
        const eventStart = new Date(event.start_date)
        const eventEnd = event.end_date ? new Date(event.end_date) : eventStart
        return (eventStart <= dateEnd && eventEnd >= dateStart)
      }) || []

      debugInfo[date].availableEvents = eventsForDate.map(e => ({
        id: e.id,
        title: e.title,
        start_date: e.start_date
      }))

      // Only include events that are selected for the campaign
      const selectedEvents = eventsForDate
        .map(event => {
          const campaignEvent = campaignEventsMap.get(`${event.id}_${date}`)
          if (campaignEvent && campaignEvent.is_selected) {
            debugInfo[date].selectedEvents.push({
              id: event.id,
              title: event.title,
              campaignEventId: campaignEvent.id,
              is_selected: campaignEvent.is_selected,
              is_featured: campaignEvent.is_featured,
              display_order: campaignEvent.display_order
            })
            return {
              ...event,
              is_featured: campaignEvent.is_featured,
              display_order: campaignEvent.display_order
            }
          } else {
            debugInfo[date].filteredOut.push({
              id: event.id,
              title: event.title,
              campaignEventFound: !!campaignEvent,
              campaignEventSelected: campaignEvent?.is_selected || false,
              lookupKey: `${event.id}_${date}`
            })
          }
          return null
        })
        .filter(Boolean)
        .sort((a, b) => (a.display_order || 999) - (b.display_order || 999))

      if (selectedEvents.length > 0) {
        eventsByDate[date] = selectedEvents
      }
    })

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        date: campaign.date
      },
      dateRange: {
        start: startDate,
        end: endDate,
        dates: dates
      },
      availableEventsCount: availableEvents?.length || 0,
      campaignEventsCount: campaignEvents?.length || 0,
      eventsByDateCount: Object.keys(eventsByDate).length,
      willShowEventsSection: Object.keys(eventsByDate).length > 0,
      debugInfo: debugInfo,
      eventsByDate: Object.keys(eventsByDate).reduce((acc, date) => {
        acc[date] = eventsByDate[date].map(e => ({
          id: e.id,
          title: e.title,
          is_featured: e.is_featured,
          display_order: e.display_order
        }))
        return acc
      }, {} as any)
    })

  } catch (error) {
    console.error('Events HTML test error:', error)
    return NextResponse.json({
      error: 'Failed to test events HTML generation',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}