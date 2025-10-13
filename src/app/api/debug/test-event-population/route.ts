import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

export async function POST(request: NextRequest) {
  try {
    console.log('=== TESTING EVENT POPULATION ===')

    // Get latest campaign
    const { data: latestCampaign, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !latestCampaign) {
      return NextResponse.json({
        success: false,
        error: 'No campaign found to test events'
      }, { status: 404 })
    }

    console.log('Testing event population for campaign:', latestCampaign.id)

    // Check existing events in database
    const { data: allEvents, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('active', true)
      .order('start_date', { ascending: true })
      .limit(20)

    console.log('Found events in database:', allEvents?.length || 0)

    // Check existing campaign events
    const { data: campaignEvents, error: campaignEventsError } = await supabaseAdmin
      .from('campaign_events')
      .select('*')
      .eq('campaign_id', latestCampaign.id)

    console.log('Existing campaign events:', campaignEvents?.length || 0)

    // Test event population
    const rssProcessor = new RSSProcessor()
    console.log('Running populateEventsForCampaign...')

    await rssProcessor.populateEventsForCampaign(latestCampaign.id)

    // Check campaign events after population
    const { data: updatedCampaignEvents, error: updatedError } = await supabaseAdmin
      .from('campaign_events')
      .select(`
        *,
        event:events(*)
      `)
      .eq('campaign_id', latestCampaign.id)

    return NextResponse.json({
      success: true,
      campaign: latestCampaign,
      eventsInDatabase: allEvents?.length || 0,
      eventsBeforePopulation: campaignEvents?.length || 0,
      eventsAfterPopulation: updatedCampaignEvents?.length || 0,
      campaignEvents: updatedCampaignEvents || [],
      sampleEvents: allEvents?.slice(0, 3) || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Event population test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}