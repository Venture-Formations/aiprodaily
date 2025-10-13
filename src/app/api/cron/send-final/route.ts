import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { SlackNotificationService } from '@/lib/slack'

// Helper function to log article positions at final send
async function logFinalArticlePositions(campaign: any) {
  console.log('=== LOGGING ARTICLE POSITIONS FOR FINAL SEND ===')

  // Get active articles sorted by rank (same logic as MailerLite service)
  const finalActiveArticles = campaign.articles
    .filter((article: any) => article.is_active)
    .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))
    .slice(0, 5) // Only log positions 1-5

  const finalActiveManualArticles = campaign.manual_articles
    .filter((article: any) => article.is_active)
    .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))
    .slice(0, 5) // Only log positions 1-5

  console.log('Final active articles for position logging:', finalActiveArticles.map((a: any) => `ID: ${a.id}, Rank: ${a.rank}, Headline: ${a.headline}`))
  console.log('Final active manual articles for position logging:', finalActiveManualArticles.map((a: any) => `ID: ${a.id}, Rank: ${a.rank}, Title: ${a.title}`))

  // Update final positions for regular articles
  for (let i = 0; i < finalActiveArticles.length; i++) {
    const position = i + 1
    const { error: updateError } = await supabaseAdmin
      .from('articles')
      .update({ final_position: position })
      .eq('id', finalActiveArticles[i].id)

    if (updateError) {
      console.error(`Failed to update final position for article ${finalActiveArticles[i].id}:`, updateError)
    } else {
      console.log(`Set final position ${position} for article: ${finalActiveArticles[i].headline}`)
    }
  }

  // Update final positions for manual articles
  for (let i = 0; i < finalActiveManualArticles.length; i++) {
    const position = i + 1
    const { error: updateError } = await supabaseAdmin
      .from('manual_articles')
      .update({ final_position: position })
      .eq('id', finalActiveManualArticles[i].id)

    if (updateError) {
      console.error(`Failed to update final position for manual article ${finalActiveManualArticles[i].id}:`, updateError)
    } else {
      console.log(`Set final position ${position} for manual article: ${finalActiveManualArticles[i].title}`)
    }
  }

  console.log('=== FINAL ARTICLE POSITION LOGGING COMPLETE ===')
}

export async function POST(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let campaign: any = null

  try {
    console.log('=== AUTOMATED FINAL SEND CHECK ===')
    console.log('Time:', new Date().toISOString())

    // Check if it's time to run final send based on database settings
    const shouldRun = await ScheduleChecker.shouldRunFinalSend()

    if (!shouldRun) {
      // Check if there's a campaign that's ready to send but missed its window
      const { data: readyCampaigns } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('id, date, status, created_at')
        .eq('status', 'ready_to_send')
        .order('created_at', { ascending: false })
        .limit(5)

      if (readyCampaigns && readyCampaigns.length > 0) {
        // There are campaigns ready but we're not sending - this could indicate a timing issue
        const slack = new SlackNotificationService()

        await slack.sendAlert(
          `⏰ Scheduled Send Check: Found ${readyCampaigns.length} campaigns with 'ready_to_send' status but shouldRun returned false. This may indicate a timing configuration issue.`,
          'warn',
          'scheduled_send_timing'
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Not time to run final send or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log('=== FINAL SEND STARTED (Time Matched) ===')
    console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

    // Get today's campaign that's ready to send (use Central Time for consistency)
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const today = centralDate.toISOString().split('T')[0]

    const { data, error } = await supabaseAdmin
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
      .eq('date', today)
      .in('status', ['in_review', 'changes_made'])
      .single()

    campaign = data

    if (error || !campaign) {
      console.log('No campaign ready to send for today')
      return NextResponse.json({
        message: 'No campaign ready to send for today',
        timestamp: new Date().toISOString()
      })
    }

    // Check if we have any active articles
    const activeArticles = campaign.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      console.log('Campaign has no active articles, skipping send')
      return NextResponse.json({
        message: 'Campaign has no active articles, skipping send',
        timestamp: new Date().toISOString()
      })
    }

    // Send the final campaign
    const mailerLiteService = new MailerLiteService()

    // Get main group ID from settings
    const { data: mainGroupSetting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'email_mainGroupId')
      .single()

    const mainGroupId = mainGroupSetting?.value

    if (!mainGroupId) {
      throw new Error('Main group ID not configured in settings')
    }

    console.log('Using main group ID from settings:', mainGroupId)

    // Log article positions at final send
    await logFinalArticlePositions(campaign)

    const result = await mailerLiteService.createFinalCampaign(campaign, mainGroupId)

    // Update campaign status to sent and capture the previous status
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        status: 'sent',
        status_before_send: campaign.status, // Capture the status before sending
        final_sent_at: new Date().toISOString(),
        metrics: {
          ...campaign.metrics,
          mailerlite_campaign_id: result.campaignId,
          sent_timestamp: new Date().toISOString()
        }
      })
      .eq('id', campaign.id)

    if (updateError) {
      console.error('Failed to update campaign status to sent:', updateError)
      // Don't fail the entire operation - the email was sent successfully
    } else {
      console.log('Campaign status updated to sent')
    }

    return NextResponse.json({
      success: true,
      message: 'Final newsletter sent successfully',
      campaignId: campaign.id,
      mailerliteCampaignId: result.campaignId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Scheduled final newsletter send failed:', error)

    // Send Slack notification for scheduled send failure
    try {
      const slack = new SlackNotificationService()
      const currentCentralTime = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})

      await slack.sendScheduledSendFailureAlert(
        campaign?.id || 'Unknown',
        currentCentralTime,
        error instanceof Error ? error.message : 'Unknown error',
        {
          operation: 'final_send_post',
          timestamp: new Date().toISOString(),
          attempted_campaign_status: campaign?.status || 'Unknown'
        }
      )
    } catch (slackError) {
      console.error('Failed to send Slack notification for send failure:', slackError)
    }

    return NextResponse.json({
      error: 'Final newsletter send failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Handle GET requests from Vercel cron (no auth header, uses URL secret)
export async function GET(request: NextRequest) {
  let campaign: any = null

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

    console.log('=== AUTOMATED FINAL SEND CHECK (GET) ===')
    console.log('Time:', new Date().toISOString())
    console.log('Request type:', isVercelCron ? 'Vercel Cron' : 'Manual Test')

    // Check if it's time to run final send based on database settings
    const shouldRun = await ScheduleChecker.shouldRunFinalSend()

    if (!shouldRun) {
      // Check if there's a campaign that's ready to send but missed its window
      const { data: readyCampaigns } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('id, date, status, created_at')
        .eq('status', 'ready_to_send')
        .order('created_at', { ascending: false })
        .limit(5)

      if (readyCampaigns && readyCampaigns.length > 0) {
        // There are campaigns ready but we're not sending - this could indicate a timing issue
        const slack = new SlackNotificationService()

        await slack.sendAlert(
          `⏰ Scheduled Send Check: Found ${readyCampaigns.length} campaigns with 'ready_to_send' status but shouldRun returned false. This may indicate a timing configuration issue.`,
          'warn',
          'scheduled_send_timing'
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Not time to run final send or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log('=== FINAL SEND STARTED (Time Matched) ===')
    console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

    // Get today's campaign that's ready to send (use Central Time for consistency)
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const today = centralDate.toISOString().split('T')[0]

    const { data, error } = await supabaseAdmin
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
      .eq('date', today)
      .in('status', ['in_review', 'changes_made'])
      .single()

    campaign = data

    if (error || !campaign) {
      console.log('No campaign ready to send for today')
      return NextResponse.json({
        message: 'No campaign ready to send for today',
        timestamp: new Date().toISOString()
      })
    }

    // Check if we have any active articles
    const activeArticles = campaign.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      console.log('Campaign has no active articles, skipping send')
      return NextResponse.json({
        message: 'Campaign has no active articles, skipping send',
        timestamp: new Date().toISOString()
      })
    }

    // Send the final campaign
    const mailerLiteService = new MailerLiteService()

    // Get main group ID from settings
    const { data: mainGroupSetting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'email_mainGroupId')
      .single()

    const mainGroupId = mainGroupSetting?.value

    if (!mainGroupId) {
      throw new Error('Main group ID not configured in settings')
    }

    console.log('Using main group ID from settings:', mainGroupId)

    // Log article positions at final send
    await logFinalArticlePositions(campaign)

    const result = await mailerLiteService.createFinalCampaign(campaign, mainGroupId)

    // Update campaign status to sent and capture the previous status
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        status: 'sent',
        status_before_send: campaign.status, // Capture the status before sending
        final_sent_at: new Date().toISOString(),
        metrics: {
          ...campaign.metrics,
          mailerlite_campaign_id: result.campaignId,
          sent_timestamp: new Date().toISOString()
        }
      })
      .eq('id', campaign.id)

    if (updateError) {
      console.error('Failed to update campaign status to sent:', updateError)
      // Don't fail the entire operation - the email was sent successfully
    } else {
      console.log('Campaign status updated to sent')
    }

    return NextResponse.json({
      success: true,
      message: 'Final newsletter sent successfully',
      campaignId: campaign.id,
      mailerliteCampaignId: result.campaignId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Scheduled final newsletter send failed:', error)

    // Send Slack notification for scheduled send failure
    try {
      const slack = new SlackNotificationService()
      const currentCentralTime = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})

      await slack.sendScheduledSendFailureAlert(
        campaign?.id || 'Unknown',
        currentCentralTime,
        error instanceof Error ? error.message : 'Unknown error',
        {
          operation: 'final_send_get',
          timestamp: new Date().toISOString(),
          attempted_campaign_status: campaign?.status || 'Unknown'
        }
      )
    } catch (slackError) {
      console.error('Failed to send Slack notification for send failure:', slackError)
    }

    return NextResponse.json({
      error: 'Final newsletter send failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}