import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== AUTOMATED FINAL NEWSLETTER SEND STARTED ===')
    console.log('Time:', new Date().toISOString())

    // Get tomorrow's campaign (review should have been scheduled by create-campaign cron)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const campaignDate = tomorrow.toISOString().split('T')[0]

    console.log('Sending final newsletter for tomorrow\'s campaign date:', campaignDate)

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
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'No campaign found for tomorrow',
        campaignDate: campaignDate
      }, { status: 404 })
    }

    console.log('Found campaign:', campaign.id, 'Status:', campaign.status)

    // Only send if campaign is in_review or changes_made status
    if (campaign.status !== 'in_review' && campaign.status !== 'changes_made') {
      return NextResponse.json({
        success: true,
        message: `Campaign status is ${campaign.status}, skipping newsletter send`,
        campaignId: campaign.id,
        skipped: true
      })
    }

    // Check if already sent
    if (campaign.final_sent_at) {
      return NextResponse.json({
        success: true,
        message: 'Newsletter already sent',
        campaignId: campaign.id,
        sentAt: campaign.final_sent_at,
        skipped: true
      })
    }

    // Check if campaign has active articles
    const activeArticles = campaign.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active articles found for newsletter send',
        campaignId: campaign.id
      }, { status: 400 })
    }

    console.log(`Campaign has ${activeArticles.length} active articles`)

    // Check if subject line exists
    if (!campaign.subject_line || campaign.subject_line.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'No subject line found for campaign',
        campaignId: campaign.id
      }, { status: 400 })
    }

    console.log('Using subject line:', campaign.subject_line)

    // Send final newsletter via MailerLite
    const mailerLiteService = new MailerLiteService()

    // Get main group ID from settings
    const { data: settingsRows } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .eq('key', 'email_mainGroupId')
      .single()

    const mainGroupId = settingsRows?.value || process.env.MAILERLITE_MAIN_GROUP_ID

    if (!mainGroupId) {
      throw new Error('Main group ID not found in settings or environment')
    }

    // Create final campaign for main audience
    const result = await mailerLiteService.createFinalCampaign(campaign, mainGroupId)

    console.log('MailerLite final campaign created:', result.campaignId)

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
      console.error('Failed to update campaign status:', updateError)
      // Continue anyway since MailerLite campaign was created
    }

    console.log('=== FINAL NEWSLETTER SEND COMPLETED ===')

    return NextResponse.json({
      success: true,
      message: 'Final newsletter sent successfully to main group',
      campaignId: campaign.id,
      campaignDate: campaignDate,
      mailerliteCampaignId: result.campaignId,
      subjectLine: campaign.subject_line,
      activeArticlesCount: activeArticles.length,
      mainGroupId: mainGroupId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('=== NEWSLETTER SEND FAILED ===')
    console.error('Error:', error)

    // Update campaign status to failed if we can identify the campaign
    const today = new Date()
    const campaignDate = today.toISOString().split('T')[0]

    try {
      await supabaseAdmin
        .from('newsletter_campaigns')
        .update({ status: 'failed' })
        .eq('date', campaignDate)
    } catch (updateError) {
      console.error('Failed to update campaign status to failed:', updateError)
    }

    return NextResponse.json({
      success: false,
      error: 'Newsletter send failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  const secret = searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Create a fake POST request for processing
  const fakeRequest = new Request(request.url, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${process.env.CRON_SECRET}`
    }
  })

  return POST(fakeRequest as NextRequest)
}