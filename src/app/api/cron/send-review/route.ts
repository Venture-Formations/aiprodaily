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

    console.log('=== AUTOMATED REVIEW SEND CHECK ===')
    console.log('Time:', new Date().toISOString())

    // Check if it's time to run review sending based on database settings
    const shouldRun = await ScheduleChecker.shouldRunReviewSend()

    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        message: 'Not time to run review send or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log('=== REVIEW SEND STARTED (Time Matched) ===')
    console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

    // Get tomorrow's campaign that's in draft status and ready for review
    // Use Central Time for consistent date calculations
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const tomorrow = new Date(centralDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const campaignDate = tomorrow.toISOString().split('T')[0]

    console.log('Sending review for tomorrow\'s campaign date:', campaignDate)

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
      .eq('date', campaignDate)
      .eq('status', 'draft')
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'No draft campaign found for tomorrow',
        campaignDate: campaignDate
      }, { status: 404 })
    }

    console.log('Found campaign:', campaign.id, 'Status:', campaign.status)

    // Check if campaign has active articles
    const activeArticles = campaign.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active articles found for review sending',
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

    // Create MailerLite review campaign
    const mailerLiteService = new MailerLiteService()
    const result = await mailerLiteService.createReviewCampaign(campaign)

    console.log('MailerLite campaign created:', result.campaignId)

    // Update campaign status to in_review
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        status: 'in_review',
        review_sent_at: new Date().toISOString()
      })
      .eq('id', campaign.id)

    if (updateError) {
      console.error('Failed to update campaign status:', updateError)
      // Continue anyway since MailerLite campaign was created
    }

    console.log('=== REVIEW SEND COMPLETED ===')

    return NextResponse.json({
      success: true,
      message: 'Review campaign sent to MailerLite successfully',
      campaignId: campaign.id,
      campaignDate: campaignDate,
      mailerliteCampaignId: result.campaignId,
      subjectLine: campaign.subject_line,
      activeArticlesCount: activeArticles.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('=== REVIEW SEND FAILED ===')
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: 'Review send failed',
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

    console.log('=== AUTOMATED REVIEW SEND CHECK (GET) ===')
    console.log('Time:', new Date().toISOString())
    console.log('Request type:', isVercelCron ? 'Vercel Cron' : 'Manual Test')

    // Check if it's time to run review sending based on database settings
    const shouldRun = await ScheduleChecker.shouldRunReviewSend()

    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        message: 'Not time to run review send or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log('=== REVIEW SEND STARTED (Time Matched) ===')
    console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

    // Get tomorrow's campaign that's in draft status and ready for review
    // Use Central Time for consistent date calculations
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const tomorrow = new Date(centralDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const campaignDate = tomorrow.toISOString().split('T')[0]

    console.log('Sending review for tomorrow\'s campaign date:', campaignDate)

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
      .eq('date', campaignDate)
      .eq('status', 'draft')
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'No draft campaign found for tomorrow',
        campaignDate: campaignDate
      }, { status: 404 })
    }

    console.log('Found campaign:', campaign.id, 'Status:', campaign.status)

    // Check if campaign has active articles
    const activeArticles = campaign.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active articles found for review sending',
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

    // Create MailerLite review campaign
    const mailerLiteService = new MailerLiteService()
    const result = await mailerLiteService.createReviewCampaign(campaign)

    console.log('MailerLite campaign created:', result.campaignId)

    // Update campaign status to in_review
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        status: 'in_review',
        review_sent_at: new Date().toISOString()
      })
      .eq('id', campaign.id)

    if (updateError) {
      console.error('Failed to update campaign status:', updateError)
      // Continue anyway since MailerLite campaign was created
    }

    console.log('=== REVIEW SEND COMPLETED ===')

    return NextResponse.json({
      success: true,
      message: 'Review campaign sent to MailerLite successfully',
      campaignId: campaign.id,
      campaignDate: campaignDate,
      mailerliteCampaignId: result.campaignId,
      subjectLine: campaign.subject_line,
      activeArticlesCount: activeArticles.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('=== REVIEW SEND FAILED ===')
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: 'Review send failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}