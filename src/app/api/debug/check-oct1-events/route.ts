import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Check for active events on Oct 1
    const { data: oct1Events, error } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, end_date, active')
      .gte('start_date', '2025-10-01T00:00:00')
      .lt('start_date', '2025-10-02T00:00:00')
      .eq('active', true)
      .order('start_date', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      count: oct1Events?.length || 0,
      events: oct1Events || [],
      message: `Found ${oct1Events?.length || 0} active events for October 1st`
    })

  } catch (error) {
    console.error('Error checking Oct 1 events:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}