import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'
import { ScheduleChecker } from '@/lib/schedule-checker'

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== AUTOMATED CAMPAIGN CREATION CHECK ===')
    console.log('Time:', new Date().toISOString())

    // Check if it's time to run campaign creation based on database settings
    const shouldRun = await ScheduleChecker.shouldRunCampaignCreation()

    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        message: 'Not time to run campaign creation or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log('=== CAMPAIGN CREATION STARTED (Time Matched) ===')
    console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

    // Get campaign (already processed with RSS and subject line)
    // Use Central Time + 12 hours for consistent date calculations
    // This ensures evening runs (8pm+) create campaigns for tomorrow
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    // Add 12 hours to determine campaign date (same logic as RSS Processing)
    centralDate.setHours(centralDate.getHours() + 12)
    const campaignDate = centralDate.toISOString().split('T')[0]

    console.log('Campaign date calculation: Current CT time + 12 hours =', campaignDate)
    console.log('Creating review campaign for date:', campaignDate)

    // Get accounting newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('newsletters')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({
        success: false,
        error: 'Accounting newsletter not found'
      }, { status: 404 })
    }

    // Find tomorrow's campaign with articles
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        articles:articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
        ),
        manual_articles:manual_articles(*)
      `)
      .eq('newsletter_id', newsletter.id)
      .eq('date', campaignDate)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'No campaign found for tomorrow',
        campaignDate: campaignDate
      }, { status: 404 })
    }

    console.log('Found campaign:', campaign.id, 'Status:', campaign.status)

    // Only create if campaign is in draft status
    if (campaign.status !== 'draft') {
      return NextResponse.json({
        success: true,
        message: `Campaign status is ${campaign.status}, skipping campaign creation`,
        campaignId: campaign.id,
        skipped: true
      })
    }

    // Check if campaign has active articles
    const activeArticles = campaign.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active articles found for campaign creation',
        campaignId: campaign.id
      }, { status: 400 })
    }

    console.log(`Campaign has ${activeArticles.length} active articles`)

    // Check if subject line exists
    if (!campaign.subject_line || campaign.subject_line.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'No subject line found for campaign. Run subject line generation first.',
        campaignId: campaign.id
      }, { status: 400 })
    }

    console.log('Using subject line:', campaign.subject_line)
    console.log('=== CAMPAIGN CREATION COMPLETED ===')
    console.log('Campaign remains in draft status until sent to MailerLite for review')

    return NextResponse.json({
      success: true,
      message: 'Campaign created successfully - ready for MailerLite review sending',
      campaignId: campaign.id,
      campaignDate: campaignDate,
      subjectLine: campaign.subject_line,
      activeArticlesCount: activeArticles.length,
      status: 'draft',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('=== CAMPAIGN CREATION FAILED ===')
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: 'Campaign creation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Handle GET requests from Vercel cron (no auth header, uses URL secret)
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

    console.log('=== AUTOMATED CAMPAIGN CREATION CHECK (GET) ===')
    console.log('Time:', new Date().toISOString())
    console.log('Request type:', isVercelCron ? 'Vercel Cron' : 'Manual Test')

    // Check if it's time to run campaign creation based on database settings
    const shouldRun = await ScheduleChecker.shouldRunCampaignCreation()

    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        message: 'Not time to run campaign creation or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log('=== CAMPAIGN CREATION STARTED (Time Matched) ===')
    console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

    // Get campaign (already processed with RSS and subject line)
    // Use Central Time + 12 hours for consistent date calculations
    // This ensures evening runs (8pm+) create campaigns for tomorrow
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    // Add 12 hours to determine campaign date (same logic as RSS Processing)
    centralDate.setHours(centralDate.getHours() + 12)
    const campaignDate = centralDate.toISOString().split('T')[0]

    console.log('Campaign date calculation: Current CT time + 12 hours =', campaignDate)
    console.log('Creating review campaign for date:', campaignDate)

    // Get accounting newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('newsletters')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({
        success: false,
        error: 'Accounting newsletter not found'
      }, { status: 404 })
    }

    // Find tomorrow's campaign with articles
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        articles:articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
        ),
        manual_articles:manual_articles(*)
      `)
      .eq('newsletter_id', newsletter.id)
      .eq('date', campaignDate)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'No campaign found for tomorrow',
        campaignDate: campaignDate
      }, { status: 404 })
    }

    console.log('Found campaign:', campaign.id, 'Status:', campaign.status)

    // Only create if campaign is in draft status
    if (campaign.status !== 'draft') {
      return NextResponse.json({
        success: true,
        message: `Campaign status is ${campaign.status}, skipping campaign creation`,
        campaignId: campaign.id,
        skipped: true
      })
    }

    // Check if campaign has active articles
    const activeArticles = campaign.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active articles found for campaign creation',
        campaignId: campaign.id
      }, { status: 400 })
    }

    console.log(`Campaign has ${activeArticles.length} active articles`)

    // Check if subject line exists
    if (!campaign.subject_line || campaign.subject_line.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'No subject line found for campaign. Run subject line generation first.',
        campaignId: campaign.id
      }, { status: 400 })
    }

    console.log('Using subject line:', campaign.subject_line)
    console.log('=== CAMPAIGN CREATION COMPLETED ===')
    console.log('Campaign remains in draft status until sent to MailerLite for review')

    return NextResponse.json({
      success: true,
      message: 'Campaign created successfully - ready for MailerLite review sending',
      campaignId: campaign.id,
      campaignDate: campaignDate,
      subjectLine: campaign.subject_line,
      activeArticlesCount: activeArticles.length,
      status: 'draft',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('=== CAMPAIGN CREATION FAILED ===')
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: 'Campaign creation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}