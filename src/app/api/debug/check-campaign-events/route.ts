import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id') || 'b7ece1ff-14f9-48ae-b32d-9c1c9e8d2961' // Today's campaign

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Calculate expected 3-day range
    const newsletterDate = new Date(campaign.date + 'T00:00:00')
    const dates = []
    for (let i = 0; i <= 2; i++) {
      const date = new Date(newsletterDate)
      date.setDate(newsletterDate.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }

    // Get campaign events grouped by date
    const { data: campaignEvents, error: eventsError } = await supabaseAdmin
      .from('campaign_events')
      .select(`
        id,
        event_date,
        is_selected,
        is_featured,
        display_order,
        event:events(
          id,
          title,
          start_date,
          venue
        )
      `)
      .eq('campaign_id', campaignId)
      .order('event_date')
      .order('display_order')

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 })
    }

    // Group events by date
    const eventsByDate: { [key: string]: any[] } = {}
    campaignEvents?.forEach(ce => {
      if (!eventsByDate[ce.event_date]) {
        eventsByDate[ce.event_date] = []
      }
      eventsByDate[ce.event_date].push(ce)
    })

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        date: campaign.date,
        status: campaign.status,
        subject_line: campaign.subject_line
      },
      expectedDates: dates,
      actualEventDates: Object.keys(eventsByDate).sort(),
      eventsByDate: Object.keys(eventsByDate).reduce((acc, date) => {
        acc[date] = {
          count: eventsByDate[date].length,
          selected: eventsByDate[date].filter(e => e.is_selected).length,
          featured: eventsByDate[date].filter(e => e.is_featured).length,
          events: eventsByDate[date].map(e => ({
            title: e.event.title,
            is_selected: e.is_selected,
            is_featured: e.is_featured,
            display_order: e.display_order
          }))
        }
        return acc
      }, {} as any),
      summary: {
        totalEvents: campaignEvents?.length || 0,
        selectedEvents: campaignEvents?.filter(e => e.is_selected).length || 0,
        datesWithEvents: Object.keys(eventsByDate).length,
        expectedDates: dates.length
      }
    })

  } catch (error) {
    console.error('Debug campaign events error:', error)
    return NextResponse.json({
      error: 'Failed to check campaign events',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}