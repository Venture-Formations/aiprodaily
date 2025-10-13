import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('=== CHECKING EVENTS DATABASE ===')

    // Get all events
    const { data: allEvents, error: allEventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .order('start_date', { ascending: true })

    // Get active events
    const { data: activeEvents, error: activeEventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('active', true)
      .order('start_date', { ascending: true })

    // Get recent events (within 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const { data: recentEvents, error: recentEventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .gte('start_date', thirtyDaysAgo.toISOString().split('T')[0])
      .lte('start_date', thirtyDaysFromNow.toISOString().split('T')[0])
      .eq('active', true)
      .order('start_date', { ascending: true })

    // Get tomorrow's date (what campaigns look for)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const campaignDate = tomorrow.toISOString().split('T')[0]

    // Calculate 3-day range from tomorrow (like RSS processor does)
    const dates = []
    for (let i = 0; i <= 2; i++) {
      const date = new Date(tomorrow)
      date.setDate(tomorrow.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }

    const startDate = dates[0]
    const endDate = dates[dates.length - 1]

    const { data: relevantEvents, error: relevantEventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .gte('start_date', startDate)
      .lte('start_date', endDate + 'T23:59:59')
      .eq('active', true)
      .order('start_date', { ascending: true })

    return NextResponse.json({
      debug: 'Events Database Check',
      campaignDate,
      dateRange: { startDate, endDate, dates },
      counts: {
        total: allEvents?.length || 0,
        active: activeEvents?.length || 0,
        recent: recentEvents?.length || 0,
        relevantForCampaign: relevantEvents?.length || 0
      },
      sampleEvents: {
        first5Active: activeEvents?.slice(0, 5) || [],
        relevantForCampaign: relevantEvents || []
      },
      errors: {
        allEvents: allEventsError?.message || null,
        activeEvents: activeEventsError?.message || null,
        recentEvents: recentEventsError?.message || null,
        relevantEvents: relevantEventsError?.message || null
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Events check error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}