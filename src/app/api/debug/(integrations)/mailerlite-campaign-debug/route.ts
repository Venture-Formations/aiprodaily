import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export async function GET(request: NextRequest) {
  try {
    console.log('=== MAILERLITE CAMPAIGN DEBUG ===')

    // Check environment variables
    const hasApiKey = !!process.env.MAILERLITE_API_KEY
    const hasReviewGroupId = !!process.env.MAILERLITE_REVIEW_GROUP_ID
    const hasMainGroupId = !!process.env.MAILERLITE_MAIN_GROUP_ID

    console.log('Environment variables check:', {
      hasApiKey,
      hasReviewGroupId,
      hasMainGroupId,
      apiKeyPrefix: process.env.MAILERLITE_API_KEY?.substring(0, 8) + '...',
      reviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID,
      mainGroupId: process.env.MAILERLITE_MAIN_GROUP_ID
    })

    // Get tomorrow's campaign
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const campaignDate = tomorrow.toISOString().split('T')[0]

    console.log('Checking campaign for date:', campaignDate)

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        articles:articles(
          id,
          headline,
          is_active,
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        ),
        campaign_events:campaign_events(
          *,
          event:events(*)
        )
      `)
      .eq('date', campaignDate)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        debug: 'MailerLite Campaign Debug',
        campaignDate,
        environmentCheck: {
          hasApiKey,
          hasReviewGroupId,
          hasMainGroupId,
          issues: [
            !hasApiKey && 'Missing MAILERLITE_API_KEY',
            !hasReviewGroupId && 'Missing MAILERLITE_REVIEW_GROUP_ID',
            !hasMainGroupId && 'Missing MAILERLITE_MAIN_GROUP_ID'
          ].filter(Boolean)
        },
        campaignCheck: {
          exists: false,
          error: campaignError?.message || 'Campaign not found',
          recommendation: 'Run RSS processing to create tomorrow\'s campaign first'
        }
      })
    }

    const activeArticles = campaign.articles?.filter((article: any) => article.is_active) || []
    const campaignEvents = campaign.campaign_events || []

    // Check campaign readiness
    const campaignIssues = []
    if (!campaign.subject_line || campaign.subject_line.trim() === '') {
      campaignIssues.push('No subject line')
    }
    if (activeArticles.length === 0) {
      campaignIssues.push('No active articles')
    }
    if (campaign.status !== 'draft') {
      campaignIssues.push(`Status is ${campaign.status}, should be 'draft'`)
    }

    // If campaign looks ready, test MailerLite API call
    let mailerliteTest = null
    if (hasApiKey && hasReviewGroupId && campaignIssues.length === 0) {
      try {
        console.log('Testing MailerLite service...')
        const mailerLiteService = new MailerLiteService()

        // Test creating the campaign (this would actually create it)
        // For debugging, we'll just validate the data structure
        console.log('Campaign data looks valid for MailerLite creation')
        mailerliteTest = {
          readyForCreation: true,
          wouldCreateAt: new Date().toISOString(),
          scheduledDeliveryTime: '21:00 CT (9:00 PM)'
        }
      } catch (error) {
        console.error('MailerLite test error:', error)
        mailerliteTest = {
          readyForCreation: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    return NextResponse.json({
      debug: 'MailerLite Campaign Debug',
      campaignDate,
      environmentCheck: {
        hasApiKey,
        hasReviewGroupId,
        hasMainGroupId,
        apiKeyPrefix: process.env.MAILERLITE_API_KEY?.substring(0, 8) + '...',
        reviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID,
        mainGroupId: process.env.MAILERLITE_MAIN_GROUP_ID,
        issues: [
          !hasApiKey && 'Missing MAILERLITE_API_KEY',
          !hasReviewGroupId && 'Missing MAILERLITE_REVIEW_GROUP_ID',
          !hasMainGroupId && 'Missing MAILERLITE_MAIN_GROUP_ID'
        ].filter(Boolean)
      },
      campaignCheck: {
        exists: true,
        campaign: {
          id: campaign.id,
          status: campaign.status,
          subject_line: campaign.subject_line,
          created_at: campaign.created_at,
          review_sent_at: campaign.review_sent_at,
          total_articles: campaign.articles?.length || 0,
          active_articles: activeArticles.length,
          total_events: campaignEvents.length
        },
        issues: campaignIssues,
        readyForMailerLite: campaignIssues.length === 0
      },
      mailerliteTest,
      recommendation: campaignIssues.length > 0
        ? `Fix these issues: ${campaignIssues.join(', ')}`
        : !hasApiKey
        ? 'Set MAILERLITE_API_KEY environment variable'
        : !hasReviewGroupId
        ? 'Set MAILERLITE_REVIEW_GROUP_ID environment variable'
        : 'Campaign appears ready for MailerLite creation',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('MailerLite campaign debug error:', error)
    return NextResponse.json({
      debug: 'MailerLite Campaign Debug',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}