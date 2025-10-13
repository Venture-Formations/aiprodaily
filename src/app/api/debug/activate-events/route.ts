import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    console.log('=== ACTIVATING EVENTS ===')

    const body = await request.json().catch(() => ({}))
    const { eventIds, startDate, endDate, count } = body

    let eventsToActivate = []

    if (eventIds && Array.isArray(eventIds)) {
      // Activate specific events by ID
      eventsToActivate = eventIds
    } else if (startDate && endDate) {
      // Find events in date range to activate
      const { data: inactiveEvents, error } = await supabaseAdmin
        .from('events')
        .select('id, title, start_date')
        .gte('start_date', startDate)
        .lte('start_date', endDate + 'T23:59:59')
        .eq('active', false)
        .order('start_date', { ascending: true })
        .limit(count || 10)

      if (error) {
        throw new Error(`Failed to find events: ${error.message}`)
      }

      eventsToActivate = inactiveEvents?.map(e => e.id) || []

      console.log('Found events to activate:', inactiveEvents?.map(e => ({
        id: e.id,
        title: e.title,
        start_date: e.start_date
      })))
    } else {
      return NextResponse.json({
        success: false,
        error: 'Must provide either eventIds array or startDate/endDate range'
      }, { status: 400 })
    }

    if (eventsToActivate.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No events found to activate',
        searched: { startDate, endDate, count }
      })
    }

    // Activate the events
    const { data, error: updateError } = await supabaseAdmin
      .from('events')
      .update({ active: true })
      .in('id', eventsToActivate)
      .select('id, title, start_date, active')

    if (updateError) {
      throw new Error(`Failed to activate events: ${updateError.message}`)
    }

    console.log('Successfully activated events:', data)

    return NextResponse.json({
      success: true,
      message: `Successfully activated ${data?.length || 0} events`,
      activatedEvents: data,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Event activation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}