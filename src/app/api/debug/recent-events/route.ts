import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get events ordered by creation date (most recent first)
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, end_date, created_at, updated_at, active')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      throw error
    }

    // Group by creation date for analysis
    const eventsByCreationDate: Record<string, any[]> = {}
    events?.forEach(event => {
      const creationDate = event.created_at?.split('T')[0] || 'unknown'
      if (!eventsByCreationDate[creationDate]) {
        eventsByCreationDate[creationDate] = []
      }
      eventsByCreationDate[creationDate].push({
        id: event.id,
        title: event.title,
        start_date: event.start_date,
        created_at: event.created_at,
        active: event.active
      })
    })

    // Get creation date stats
    const creationDates = Object.keys(eventsByCreationDate).sort().reverse()
    const latestCreationDate = creationDates[0]
    const totalEvents = events?.length || 0

    return NextResponse.json({
      summary: {
        total_events_returned: totalEvents,
        latest_creation_date: latestCreationDate,
        creation_dates_found: creationDates.slice(0, 5), // Top 5 dates
        events_by_latest_date: eventsByCreationDate[latestCreationDate]?.length || 0
      },
      events_by_creation_date: eventsByCreationDate,
      raw_events: events?.slice(0, 5) || [] // First 5 for inspection
    })

  } catch (error) {
    console.error('Recent events check failed:', error)
    return NextResponse.json({
      error: 'Failed to check recent events',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}