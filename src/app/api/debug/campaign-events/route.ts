import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id parameter required' }, { status: 400 })
    }

    console.log('=== CAMPAIGN EVENTS DEBUG ===')
    console.log('Campaign ID:', campaignId)

    // Get campaign info
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        error: 'Campaign not found',
        details: campaignError?.message
      }, { status: 404 })
    }

    // Get campaign events
    const { data: campaignEvents, error: eventsError }: { data: any[] | null, error: any } = await supabaseAdmin
      .from('campaign_events')
      .select(`
        *,
        event:events(*)
      `)
      .eq('campaign_id', campaignId)

    // Calculate 3-day range starting from the newsletter date (campaign.date)
    // Day 1: Newsletter date, Day 2: Next day, Day 3: Day after that
    const newsletterDate = new Date(campaign.date + 'T00:00:00') // Parse as local date

    const dates = []
    for (let i = 0; i <= 2; i++) {
      const date = new Date(newsletterDate)
      date.setDate(newsletterDate.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }

    const startDate = dates[0]
    const endDate = dates[dates.length - 1]

    const { data: availableEvents, error: availableEventsError }: { data: any[] | null, error: any } = await supabaseAdmin
      .from('events')
      .select('*')
      .gte('start_date', startDate)
      .lte('start_date', endDate + 'T23:59:59')
      .eq('active', true)
      .order('start_date', { ascending: true })

    return NextResponse.json({
      debug: 'Campaign Events Analysis',
      campaign: {
        id: campaign.id,
        date: campaign.date,
        created_at: campaign.created_at,
        status: campaign.status
      },
      dateRange: {
        startDate,
        endDate,
        calculatedDates: dates
      },
      campaignEvents: {
        total: campaignEvents?.length || 0,
        selected: campaignEvents?.filter(ce => ce.is_selected)?.length || 0,
        featured: campaignEvents?.filter(ce => ce.is_featured)?.length || 0,
        data: campaignEvents || []
      },
      availableEvents: {
        total: availableEvents?.length || 0,
        data: availableEvents || []
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Campaign events debug error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: 'Failed to analyze campaign events'
    }, { status: 500 })
  }
}