import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing MailerLite review campaign creation...')

    // Get the latest campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        articles:articles!inner(
          *,
          rss_post:rss_posts!inner(
            *,
            post_rating:post_ratings!inner(*),
            rss_feed:rss_feeds!inner(*)
          )
        ),
        manual_articles:manual_articles(*),
        campaign_events:campaign_events(
          *,
          event:events(*)
        )
      `)
      .eq('articles.is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'No campaign found',
        details: campaignError?.message
      }, { status: 404 })
    }

    console.log(`Testing MailerLite integration for campaign ${campaign.id} (${campaign.date})`)

    // Test MailerLite API connection
    const mailerLiteService = new MailerLiteService()

    try {
      console.log('Testing MailerLite review campaign creation...')
      const result = await mailerLiteService.createReviewCampaign(campaign)

      return NextResponse.json({
        success: true,
        message: 'MailerLite review campaign created successfully',
        campaignId: campaign.id,
        campaignDate: campaign.date,
        mailerliteCampaignId: result.campaignId,
        subjectLine: campaign.subject_line,
        result: result
      })

    } catch (mailerLiteError) {
      console.error('MailerLite API error:', mailerLiteError)

      return NextResponse.json({
        success: false,
        error: 'MailerLite API failed',
        details: mailerLiteError instanceof Error ? mailerLiteError.message : 'Unknown MailerLite error',
        campaignId: campaign.id,
        campaignDate: campaign.date,
        hasSubjectLine: !!campaign.subject_line,
        activeArticlesCount: campaign.articles?.length || 0
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Debug test failed:', error)

    return NextResponse.json({
      success: false,
      error: 'Debug test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}