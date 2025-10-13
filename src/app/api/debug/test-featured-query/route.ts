import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Test the exact query used in event population for Oct 9
    const startDate = '2025-10-09'
    const endDate = '2025-10-09'

    console.log('Testing featured event query for date:', startDate)

    const { data: availableEvents, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .gte('start_date', startDate)
      .lte('start_date', endDate + 'T23:59:59')
      .eq('active', true)
      .order('start_date', { ascending: true })

    if (eventsError) {
      return NextResponse.json({
        error: 'Query failed',
        details: eventsError
      }, { status: 500 })
    }

    // Filter for featured events (same logic as line 1287)
    const featuredEvents = availableEvents?.filter(e => e.featured) || []
    const nonFeaturedEvents = availableEvents?.filter(e => !e.featured) || []

    // Get detailed info about submitted events
    const submittedEvents = availableEvents?.filter(e =>
      e.external_id?.startsWith('submitted_')
    ) || []

    return NextResponse.json({
      query: {
        startDate,
        endDate,
        filter: 'active=true'
      },
      results: {
        total: availableEvents?.length || 0,
        featured: featuredEvents.length,
        nonFeatured: nonFeaturedEvents.length,
        submitted: submittedEvents.length
      },
      featuredEventDetails: featuredEvents.map(e => ({
        id: e.id,
        title: e.title,
        featured: e.featured,
        paid_placement: e.paid_placement,
        external_id: e.external_id,
        created_at: e.created_at,
        updated_at: e.updated_at
      })),
      submittedEventDetails: submittedEvents.map(e => ({
        id: e.id,
        title: e.title,
        featured: e.featured,
        paid_placement: e.paid_placement,
        external_id: e.external_id,
        active: e.active,
        created_at: e.created_at,
        updated_at: e.updated_at
      })),
      allEventsBasicInfo: availableEvents?.map(e => ({
        title: e.title,
        featured: e.featured,
        active: e.active,
        external_id: e.external_id?.substring(0, 20)
      }))
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
