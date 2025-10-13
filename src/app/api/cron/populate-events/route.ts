import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'
import { ScheduleChecker } from '@/lib/schedule-checker'

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== AUTOMATED EVENT POPULATION CHECK ===')
    console.log('Time:', new Date().toISOString())

    // Check if it's time to run event population (5 minutes before RSS processing)
    const settings = await ScheduleChecker.getScheduleSettings()
    if (!settings.reviewScheduleEnabled) {
      return NextResponse.json({
        success: true,
        message: 'Review schedule not enabled',
        skipped: true
      })
    }

    // Run 5 minutes before RSS processing time
    const rssTime = settings.rssProcessingTime
    const [rssHour, rssMinute] = rssTime.split(':').map(Number)
    const eventTime = `${rssHour.toString().padStart(2, '0')}:${(rssMinute - 5).toString().padStart(2, '0')}`

    const currentTime = ScheduleChecker.getCurrentTimeInCT()

    // Check if current time matches event population time (within 15-minute window)
    const current = ScheduleChecker.parseTime(currentTime.timeString)
    const scheduled = ScheduleChecker.parseTime(eventTime)
    const currentMinutes = current.hours * 60 + current.minutes
    const scheduledMinutes = scheduled.hours * 60 + scheduled.minutes
    const timeDiff = Math.abs(currentMinutes - scheduledMinutes)

    if (timeDiff > 15) {
      return NextResponse.json({
        success: true,
        message: `Not time to run event population: current ${currentTime.timeString}, scheduled ${eventTime}`,
        skipped: true
      })
    }

    console.log('=== EVENT POPULATION STARTED (Time Matched) ===')
    console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

    // Get tomorrow's campaign (created by RSS processing)
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const tomorrow = new Date(centralDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const campaignDate = tomorrow.toISOString().split('T')[0]

    console.log('Populating events for campaign date:', campaignDate)

    // Find tomorrow's campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')
      .eq('date', campaignDate)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'No campaign found for tomorrow - RSS processing may not have run yet',
        campaignDate: campaignDate
      }, { status: 404 })
    }

    console.log('Found campaign:', campaign.id, 'Status:', campaign.status)

    // Initialize RSS processor for event population
    const rssProcessor = new RSSProcessor()

    // Populate events with smart selection
    await rssProcessor.populateEventsForCampaignSmart(campaign.id)

    console.log('=== EVENT POPULATION COMPLETED ===')

    return NextResponse.json({
      success: true,
      message: 'Events populated successfully for tomorrow\'s campaign',
      campaignId: campaign.id,
      campaignDate: campaignDate,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('=== EVENT POPULATION FAILED ===')
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: 'Event population failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Handle GET requests from Vercel cron (no auth header)
export async function GET(request: NextRequest) {
  try {
    // For Vercel cron: check secret in URL params, for manual: require secret param
    const searchParams = new URL(request.url).searchParams
    const secret = searchParams.get('secret')

    // Allow both manual testing (with secret param) and Vercel cron (no auth needed)
    const isVercelCron = !secret && !searchParams.has('secret')
    const isManualTest = secret === process.env.CRON_SECRET

    if (!isVercelCron && !isManualTest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== EVENT POPULATION CHECK (GET) ===')
    console.log('Time:', new Date().toISOString())
    console.log('Request type:', isVercelCron ? 'Vercel Cron' : 'Manual Test')

    // Same logic as POST handler...
    const settings = await ScheduleChecker.getScheduleSettings()
    if (!settings.reviewScheduleEnabled) {
      return NextResponse.json({
        success: true,
        message: 'Review schedule not enabled',
        skipped: true
      })
    }

    const rssTime = settings.rssProcessingTime
    const [rssHour, rssMinute] = rssTime.split(':').map(Number)
    const eventTime = `${rssHour.toString().padStart(2, '0')}:${(rssMinute - 5).toString().padStart(2, '0')}`

    const currentTime = ScheduleChecker.getCurrentTimeInCT()

    const current = ScheduleChecker.parseTime(currentTime.timeString)
    const scheduled = ScheduleChecker.parseTime(eventTime)
    const currentMinutes = current.hours * 60 + current.minutes
    const scheduledMinutes = scheduled.hours * 60 + scheduled.minutes
    const timeDiff = Math.abs(currentMinutes - scheduledMinutes)

    if (timeDiff > 15) {
      return NextResponse.json({
        success: true,
        message: `Not time to run event population: current ${currentTime.timeString}, scheduled ${eventTime}`,
        skipped: true
      })
    }

    // Get tomorrow's campaign and populate events
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const tomorrow = new Date(centralDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const campaignDate = tomorrow.toISOString().split('T')[0]

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')
      .eq('date', campaignDate)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'No campaign found for tomorrow - RSS processing may not have run yet',
        campaignDate: campaignDate
      }, { status: 404 })
    }

    const rssProcessor = new RSSProcessor()
    await rssProcessor.populateEventsForCampaignSmart(campaign.id)

    return NextResponse.json({
      success: true,
      message: 'Events populated successfully for tomorrow\'s campaign',
      campaignId: campaign.id,
      campaignDate: campaignDate,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Event population failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Event population failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}