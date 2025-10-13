import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('=== CHECKING INACTIVE EVENTS ===')

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '2025-09-22'
    const endDate = searchParams.get('endDate') || '2025-09-30'

    // Get inactive events in date range
    const { data: inactiveEvents, error: inactiveEventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .gte('start_date', startDate)
      .lte('start_date', endDate + 'T23:59:59')
      .eq('active', false)
      .order('start_date', { ascending: true })
      .limit(50)

    // Get all events in date range
    const { data: allEventsInRange, error: allEventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .gte('start_date', startDate)
      .lte('start_date', endDate + 'T23:59:59')
      .order('start_date', { ascending: true })

    return NextResponse.json({
      debug: 'Inactive Events Check',
      dateRange: { startDate, endDate },
      counts: {
        allInRange: allEventsInRange?.length || 0,
        inactiveInRange: inactiveEvents?.length || 0,
        activeInRange: (allEventsInRange?.length || 0) - (inactiveEvents?.length || 0)
      },
      inactiveEvents: inactiveEvents?.map(event => ({
        id: event.id,
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        venue: event.venue,
        active: event.active,
        created_at: event.created_at
      })) || [],
      errors: {
        inactive: inactiveEventsError?.message || null,
        all: allEventsError?.message || null
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Inactive events check error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}