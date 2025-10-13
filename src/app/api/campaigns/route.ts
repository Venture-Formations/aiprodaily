import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { selectPropertiesForCampaign } from '@/lib/vrbo-selector'
import { selectDiningDealsForCampaign } from '@/lib/dining-selector'

// Helper function to initialize random event selection for a new campaign
async function initializeRandomEventSelection(campaignId: string) {
  try {
    console.log(`Initializing random event selection for campaign ${campaignId}`)

    // Get the campaign's date and created_at timestamp
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('date, created_at')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error('Could not fetch campaign for event selection:', campaignError)
      return
    }

    // Calculate 3-day range starting from the campaign date (same day as newsletter)
    // Use the campaign.date for consistent timezone handling
    const campaignDate = new Date(campaign.date + 'T00:00:00')
    console.log(`Campaign date: ${campaign.date}, Starting events from campaign date`)

    const dates = []
    for (let i = 0; i < 3; i++) { // Start from i=0 to include campaign date itself
      const date = new Date(campaignDate)
      date.setDate(campaignDate.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }

    console.log('Event selection dates:', dates)

    // For each date, fetch available events and randomly select up to 8
    for (const eventDate of dates) {
      const dateStart = new Date(eventDate + 'T00:00:00-05:00')
      const dateEnd = new Date(eventDate + 'T23:59:59-05:00')

      // Fetch events for this date using broader range matching
      const { data: availableEvents, error: eventsError } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('active', true)
        .gte('start_date', eventDate)
        .lte('start_date', eventDate + 'T23:59:59')
        .order('start_date', { ascending: true })

      if (eventsError) {
        console.error('Error fetching events for date', eventDate, eventsError)
        continue
      }

      if (!availableEvents || availableEvents.length === 0) {
        console.log('No events found for date:', eventDate)
        continue
      }

      console.log(`Found ${availableEvents.length} events for ${eventDate}`)

      // Randomly shuffle all available events
      const shuffledEvents = [...availableEvents].sort(() => Math.random() - 0.5)

      // Select up to 8 events randomly
      const selectedEvents = shuffledEvents.slice(0, Math.min(8, availableEvents.length))

      console.log(`Selected ${selectedEvents.length} events for ${eventDate}`)

      // Insert campaign_events records
      const campaignEventInserts = selectedEvents.map((event, index) => ({
        campaign_id: campaignId,
        event_id: event.id,
        event_date: eventDate,
        is_selected: true,
        is_featured: index === 0, // First event of each day is featured
        display_order: index + 1
      }))

      if (campaignEventInserts.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('campaign_events')
          .insert(campaignEventInserts)

        if (insertError) {
          console.error('Error inserting campaign events for date', eventDate, insertError)
        } else {
          console.log(`Successfully inserted ${campaignEventInserts.length} campaign events for ${eventDate}`)
        }
      }
    }

    console.log('Random event selection initialization completed')
  } catch (error) {
    console.error('Error initializing random event selection:', error)
    // Don't throw error to prevent campaign creation from failing
  }
}

// Helper function to initialize VRBO property selection for a new campaign
async function initializeVrboSelection(campaignId: string) {
  try {
    console.log(`Initializing VRBO property selection for campaign ${campaignId}`)
    const result = await selectPropertiesForCampaign(campaignId)
    console.log('VRBO selection result:', result.message)
  } catch (error) {
    console.error('Error initializing VRBO selection:', error)
    // Don't throw error to prevent campaign creation from failing
  }
}

// Helper function to initialize dining deals selection for a new campaign
async function initializeDiningDealsSelection(campaignId: string, campaignDate: string) {
  try {
    console.log(`Initializing dining deals selection for campaign ${campaignId}`)
    const date = new Date(campaignDate + 'T00:00:00')
    const result = await selectDiningDealsForCampaign(campaignId, date)
    console.log('Dining deals selection result:', result.message)
  } catch (error) {
    console.error('Error initializing dining deals selection:', error)
    // Don't throw error to prevent campaign creation from failing
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const status = url.searchParams.get('status')

    let query = supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        articles:articles(
          count
        ),
        manual_articles:manual_articles(
          count
        ),
        email_metrics(*)
      `)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: campaigns, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      campaigns: campaigns || [],
      total: campaigns?.length || 0
    })

  } catch (error) {
    console.error('Failed to fetch campaigns:', error)
    return NextResponse.json({
      error: 'Failed to fetch campaigns',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date } = body

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    // Create new campaign (duplicate dates are now allowed)
    const { data: campaign, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .insert([{
        date,
        status: 'draft'
      }])
      .select('*')
      .single()

    if (error) {
      throw error
    }

    // Initialize all content selections for the new campaign
    console.log('Initializing campaign content selections...')

    // Run all initializations in parallel for better performance
    await Promise.all([
      initializeRandomEventSelection(campaign.id),
      initializeVrboSelection(campaign.id),
      initializeDiningDealsSelection(campaign.id, campaign.date)
    ])

    console.log('Campaign content initialization completed')

    return NextResponse.json({ campaign }, { status: 201 })

  } catch (error) {
    console.error('Failed to create campaign:', error)
    return NextResponse.json({
      error: 'Failed to create campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}