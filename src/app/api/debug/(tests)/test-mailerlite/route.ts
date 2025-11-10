import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing MailerLite integration...')

    // Get the latest campaign that's in draft status
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
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (campaignError || !campaign) {
      // Try to get the latest in_review campaign instead
      const { data: reviewCampaign, error: reviewError } = await supabaseAdmin
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
        .eq('status', 'in_review')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (reviewError || !reviewCampaign) {
        return NextResponse.json({
          success: false,
          error: 'No draft or in_review campaigns found for testing',
          drafttError: campaignError?.message,
          reviewError: reviewError?.message
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        message: 'Found in_review campaign (already processed)',
        campaign: {
          id: reviewCampaign.id,
          date: reviewCampaign.date,
          status: reviewCampaign.status,
          subject_line: reviewCampaign.subject_line,
          review_sent_at: reviewCampaign.review_sent_at,
          active_articles: reviewCampaign.articles.filter((a: any) => a.is_active).length
        },
        note: 'This campaign was already sent to MailerLite (status is in_review)'
      })
    }

    // Check if campaign has required data
    const activeArticles = campaign.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active articles found in campaign',
        campaignId: campaign.id
      }, { status: 400 })
    }

    if (!campaign.subject_line || campaign.subject_line.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'No subject line found in campaign',
        campaignId: campaign.id
      }, { status: 400 })
    }

    console.log(`Testing with campaign ${campaign.id} (${campaign.date})`)
    console.log(`Active articles: ${activeArticles.length}`)
    console.log(`Subject line: ${campaign.subject_line}`)

    // Test MailerLite service
    const mailerLiteService = new MailerLiteService()
    const result = await mailerLiteService.createReviewCampaign(campaign)

    return NextResponse.json({
      success: true,
      message: 'MailerLite campaign created successfully',
      result,
      campaign: {
        id: campaign.id,
        date: campaign.date,
        subject_line: campaign.subject_line,
        active_articles: activeArticles.length
      }
    })

  } catch (error) {
    console.error('MailerLite test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'MailerLite test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}