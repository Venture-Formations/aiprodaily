import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || '2025-09-19'

    // Get total events count
    const { data: allEvents, error: allError } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, end_date, active')
      .order('start_date', { ascending: true })

    if (allError) {
      throw allError
    }

    // Get events for specific date
    const { data: dateEvents, error: dateError } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, end_date, active')
      .gte('start_date', date)
      .lt('start_date', date + 'T23:59:59')
      .order('start_date', { ascending: true })

    if (dateError) {
      throw dateError
    }

    // Get active events for specific date
    const { data: activeDateEvents, error: activeError } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, end_date, active')
      .gte('start_date', date)
      .lt('start_date', date + 'T23:59:59')
      .eq('active', true)
      .order('start_date', { ascending: true })

    if (activeError) {
      throw activeError
    }

    return NextResponse.json({
      debug_info: {
        requested_date: date,
        total_events_in_db: allEvents?.length || 0,
        events_on_date: dateEvents?.length || 0,
        active_events_on_date: activeDateEvents?.length || 0,
        sample_events_on_date: dateEvents?.slice(0, 5) || [],
        sample_active_events_on_date: activeDateEvents?.slice(0, 5) || []
      }
    })

  } catch (error) {
    console.error('Debug events count failed:', error)
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}