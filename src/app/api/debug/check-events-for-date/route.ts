import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || '2025-09-26' // Default to Sept 26

    console.log(`Checking events available for date: ${date}`)

    // Get events for the specific date
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, end_date, venue, active')
      .gte('start_date', date + 'T00:00:00')
      .lte('start_date', date + 'T23:59:59')
      .eq('active', true)
      .order('start_date', { ascending: true })

    if (error) {
      throw error
    }

    // Also check events that span into this date
    const { data: spanningEvents, error: spanError } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, end_date, venue, active')
      .lte('start_date', date + 'T00:00:00')
      .gte('end_date', date + 'T00:00:00')
      .eq('active', true)
      .order('start_date', { ascending: true })

    if (spanError) {
      throw spanError
    }

    // Combine and deduplicate
    const allEvents = [...(events || []), ...(spanningEvents || [])]
    const uniqueEvents = allEvents.filter((event, index, self) =>
      index === self.findIndex(e => e.id === event.id)
    )

    return NextResponse.json({
      success: true,
      date,
      dayOfWeek: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
      eventsCount: uniqueEvents.length,
      events: uniqueEvents.map(event => ({
        id: event.id,
        title: event.title,
        venue: event.venue,
        start_date: event.start_date,
        end_date: event.end_date
      }))
    })

  } catch (error) {
    console.error('Check events error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}