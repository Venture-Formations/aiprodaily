import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('=== CHECKING EVENTS BY DATE ===')

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '2025-09-23'
    const endDate = searchParams.get('endDate') || '2025-09-25'

    // Get all active events in date range
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, active')
      .gte('start_date', startDate)
      .lte('start_date', endDate + 'T23:59:59')
      .eq('active', true)
      .order('start_date', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch events: ${error.message}`)
    }

    // Group events by date
    const eventsByDate: Record<string, any[]> = {}
    events?.forEach(event => {
      const eventDate = event.start_date.split('T')[0]
      if (!eventsByDate[eventDate]) {
        eventsByDate[eventDate] = []
      }
      eventsByDate[eventDate].push(event)
    })

    // Create date range
    const dates = []
    const start = new Date(startDate)
    const end = new Date(endDate)

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    const summary = dates.map(date => ({
      date,
      count: eventsByDate[date]?.length || 0,
      events: eventsByDate[date]?.map(e => ({ id: e.id, title: e.title })) || []
    }))

    return NextResponse.json({
      debug: 'Events by Date',
      dateRange: { startDate, endDate },
      totalEvents: events?.length || 0,
      eventsByDate: summary,
      rawEventsByDate: eventsByDate,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Events by date check error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}