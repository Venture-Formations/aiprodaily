import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const venue = searchParams.get('venue')

    // Only show active events with end_date in the future
    let query = supabaseAdmin
      .from('events')
      .select('id, title, description, start_date, end_date, venue, address, url, image_url, cropped_image_url, featured, paid_placement')
      .eq('active', true)
      .gte('end_date', new Date().toISOString())
      .order('start_date', { ascending: true })

    // Filter by venue if specified
    if (venue && venue !== 'all') {
      query = query.eq('venue', venue)
    }

    const { data: events, error } = await query

    if (error) throw error

    return NextResponse.json({ events: events || [] })

  } catch (error) {
    console.error('Failed to load public events:', error)
    return NextResponse.json({
      error: 'Failed to load events',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
