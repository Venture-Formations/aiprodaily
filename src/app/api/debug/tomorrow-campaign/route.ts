import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get tomorrow's date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const campaignDate = tomorrow.toISOString().split('T')[0]

    console.log('Checking for campaign on date:', campaignDate)

    // Check if campaign exists for tomorrow
    const { data: campaign, error } = await supabaseAdmin
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
        )
      `)
      .eq('date', campaignDate)
      .single()

    if (error) {
      return NextResponse.json({
        debug: 'Tomorrow Campaign Check',
        campaignDate,
        exists: false,
        error: error.message,
        recommendation: 'RSS processing needs to run to create tomorrow\'s campaign'
      })
    }

    const activeArticles = campaign.articles?.filter((article: any) => article.is_active) || []

    return NextResponse.json({
      debug: 'Tomorrow Campaign Check',
      campaignDate,
      exists: true,
      campaign: {
        id: campaign.id,
        status: campaign.status,
        subject_line: campaign.subject_line,
        created_at: campaign.created_at,
        total_articles: campaign.articles?.length || 0,
        active_articles: activeArticles.length,
        review_sent_at: campaign.review_sent_at
      },
      activeArticles: activeArticles.map((article: any) => ({
        id: article.id,
        headline: article.headline,
        ai_score: article.rss_post?.post_rating?.[0]?.total_score || 0
      })),
      issues: {
        no_subject_line: !campaign.subject_line || campaign.subject_line.trim() === '',
        no_active_articles: activeArticles.length === 0,
        wrong_status: campaign.status !== 'draft',
        already_sent_review: !!campaign.review_sent_at
      },
      recommendation: campaign.status !== 'draft' ?
        `Campaign status is ${campaign.status}, should be 'draft' for creation` :
        (!campaign.subject_line || campaign.subject_line.trim() === '') ?
        'No subject line - run subject line generation' :
        activeArticles.length === 0 ?
        'No active articles found' :
        'Campaign appears ready for creation'
    })

  } catch (error) {
    console.error('Tomorrow campaign debug error:', error)
    return NextResponse.json({
      debug: 'Tomorrow Campaign Check',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}