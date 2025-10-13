import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetDate = searchParams.get('date') || '2025-09-28' // Default to Sept 28

    console.log('Checking events for date:', targetDate)

    // Get events for the specific date
    const { data: eventsForDate, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, end_date, venue, active')
      .gte('start_date', targetDate)
      .lte('start_date', targetDate + 'T23:59:59')
      .eq('active', true)
      .order('start_date')

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 })
    }

    // Get events in a broader range around the target date for comparison
    const dayBefore = new Date(targetDate)
    dayBefore.setDate(dayBefore.getDate() - 1)
    const dayAfter = new Date(targetDate)
    dayAfter.setDate(dayAfter.getDate() + 1)

    const startRange = dayBefore.toISOString().split('T')[0]
    const endRange = dayAfter.toISOString().split('T')[0]

    const { data: nearbyEvents, error: nearbyError } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, end_date, venue, active')
      .gte('start_date', startRange)
      .lte('start_date', endRange + 'T23:59:59')
      .eq('active', true)
      .order('start_date')

    if (nearbyError) {
      return NextResponse.json({ error: nearbyError.message }, { status: 500 })
    }

    // Group nearby events by date
    const eventsByDate: { [key: string]: any[] } = {}
    nearbyEvents?.forEach(event => {
      const eventDate = event.start_date.split('T')[0]
      if (!eventsByDate[eventDate]) {
        eventsByDate[eventDate] = []
      }
      eventsByDate[eventDate].push({
        id: event.id,
        title: event.title,
        startTime: event.start_date.split('T')[1]?.split('.')[0] || 'unknown',
        venue: event.venue
      })
    })

    // Also check if there are multi-day events that span this date
    const { data: spanningEvents, error: spanningError } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, end_date, venue, active')
      .lte('start_date', targetDate + 'T00:00:00')
      .gte('end_date', targetDate + 'T23:59:59')
      .eq('active', true)
      .order('start_date')

    return NextResponse.json({
      targetDate: targetDate,
      dayOfWeek: new Date(targetDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
      directMatches: {
        count: eventsForDate?.length || 0,
        events: eventsForDate?.map(e => ({
          id: e.id,
          title: e.title,
          startDate: e.start_date,
          venue: e.venue
        })) || []
      },
      nearbyDates: {
        dateRange: `${startRange} to ${endRange}`,
        eventsByDate: eventsByDate
      },
      spanningEvents: {
        count: spanningEvents?.length || 0,
        events: spanningEvents?.map(e => ({
          id: e.id,
          title: e.title,
          startDate: e.start_date,
          endDate: e.end_date,
          venue: e.venue
        })) || []
      },
      summary: {
        hasDirectMatches: (eventsForDate?.length || 0) > 0,
        hasNearbyEvents: Object.keys(eventsByDate).length > 0,
        hasSpanningEvents: (spanningEvents?.length || 0) > 0
      }
    })

  } catch (error) {
    console.error('Debug events by date error:', error)
    return NextResponse.json({
      error: 'Failed to check events by date',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}