import { NextRequest, NextResponse } from 'next/server'
import { MailerLiteService } from '@/lib/mailerlite'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('Testing MailerLite campaign creation with scheduling...')

    // Get the latest campaign
    const { data: campaign, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        articles:articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
        )
      `)
      .eq('date', '2025-09-24')
      .single()

    if (error || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'No campaign found for testing'
      }, { status: 404 })
    }

    // Create a test MailerLite campaign with the fixed scheduling
    const mailerLiteService = new MailerLiteService()
    const result = await mailerLiteService.createReviewCampaign(campaign)

    return NextResponse.json({
      success: true,
      message: 'Test MailerLite campaign created with scheduling',
      campaignId: campaign.id,
      mailerliteCampaignId: result.campaignId,
      result
    })

  } catch (error) {
    console.error('Test campaign creation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create test campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}