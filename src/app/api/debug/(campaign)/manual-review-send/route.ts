import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export async function POST(request: NextRequest) {
  try {
    console.log('=== MANUAL REVIEW SEND ===')

    // Get tomorrow's campaign
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const tomorrow = new Date(centralDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const campaignDate = tomorrow.toISOString().split('T')[0]

    console.log('Sending review for campaign date:', campaignDate)

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
        campaignDate: campaignDate,
        errorDetails: campaignError
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
        error: 'No subject line found for campaign',
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

    console.log('=== MANUAL REVIEW SEND COMPLETED ===')

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
    console.error('=== MANUAL REVIEW SEND FAILED ===')
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: 'Manual review send failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
