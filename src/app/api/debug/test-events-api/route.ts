import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Test the exact same logic as the main events API
    const startDate = '2025-09-19'
    const endDate = '2025-09-21'
    const active = 'true'

    console.log('Testing events API with:', { startDate, endDate, active })

    let query = supabaseAdmin
      .from('events')
      .select('*')
      .order('start_date', { ascending: true })

    // Apply the same simplified date filtering
    if (startDate) {
      query = query.gte('start_date', startDate)
    }
    if (endDate) {
      const endDateInclusive = new Date(endDate)
      endDateInclusive.setDate(endDateInclusive.getDate() + 1)
      const endDateStr = endDateInclusive.toISOString().split('T')[0]
      console.log('End date filter:', endDateStr)
      query = query.lt('start_date', endDateStr)
    }

    // Filter by active status
    if (active !== null && active !== undefined) {
      query = query.eq('active', active === 'true')
    }

    const { data: events, error } = await query

    if (error) {
      console.error('Test events query error:', error)
      throw error
    }

    console.log(`Test events API returning ${events?.length || 0} events`)

    // Group events by date
    const eventsByDate: { [date: string]: any[] } = {}
    events?.forEach(event => {
      const eventDate = event.start_date.split('T')[0]
      if (!eventsByDate[eventDate]) {
        eventsByDate[eventDate] = []
      }
      eventsByDate[eventDate].push({
        title: event.title,
        start_date: event.start_date
      })
    })

    return NextResponse.json({
      test_params: { startDate, endDate, active },
      total_events: events?.length || 0,
      events_by_date: eventsByDate,
      debug_info: {
        date_logic: `gte('start_date', '${startDate}') AND lt('start_date', '${new Date(endDate).setDate(new Date(endDate).getDate() + 1)}')`
      }
    })

  } catch (error) {
    console.error('Test events API failed:', error)
    return NextResponse.json({
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}