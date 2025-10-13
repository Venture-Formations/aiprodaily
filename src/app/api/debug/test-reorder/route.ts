import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentTopArticle } from '@/lib/subject-line-generator'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id parameter required' }, { status: 400 })
    }

    console.log(`Testing reorder logic for campaign: ${campaignId}`)

    // Get current campaign and articles
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        id,
        subject_line,
        articles:articles(
          id,
          headline,
          is_active,
          skipped,
          rank,
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        )
      `)
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        error: 'Campaign not found',
        details: campaignError?.message
      }, { status: 404 })
    }

    console.log('Raw campaign data:', JSON.stringify(campaign, null, 2))

    // Test getCurrentTopArticle function
    const { article: currentTopArticle, error: topArticleError } = await getCurrentTopArticle(campaignId)

    if (topArticleError) {
      console.error('Error getting current top article:', topArticleError)
    }

    console.log('Current top article from function:', currentTopArticle)

    // Manual filtering logic to debug
    const activeArticles = campaign.articles
      .filter((article: any) => {
        console.log(`Checking article: ${article.headline}`)
        console.log(`  is_active: ${article.is_active}`)
        console.log(`  skipped: ${article.skipped}`)
        console.log(`  rank: ${article.rank}`)

        if (!article.is_active) {
          console.log(`  -> EXCLUDED: not active`)
          return false
        }

        if (article.hasOwnProperty('skipped') && article.skipped) {
          console.log(`  -> EXCLUDED: skipped`)
          return false
        }

        console.log(`  -> INCLUDED`)
        return true
      })
      .sort((a: any, b: any) => {
        const rankA = a.rank || 999
        const rankB = b.rank || 999
        console.log(`Sorting: ${a.headline} (rank ${rankA}) vs ${b.headline} (rank ${rankB})`)
        return rankA - rankB
      })

    console.log('Filtered and sorted active articles:', activeArticles.map((a: any) => ({
      id: a.id,
      headline: a.headline,
      rank: a.rank,
      is_active: a.is_active,
      skipped: a.skipped
    })))

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      current_subject_line: campaign.subject_line,
      total_articles: campaign.articles.length,
      active_articles_count: activeArticles.length,
      current_top_article: currentTopArticle,
      top_article_error: topArticleError,
      active_articles: activeArticles.map((a: any) => ({
        id: a.id,
        headline: a.headline,
        rank: a.rank,
        is_active: a.is_active,
        skipped: a.skipped
      })),
      all_articles: campaign.articles.map((a: any) => ({
        id: a.id,
        headline: a.headline,
        rank: a.rank,
        is_active: a.is_active,
        skipped: a.skipped
      }))
    })

  } catch (error) {
    console.error('Debug test failed:', error)
    return NextResponse.json({
      error: 'Debug test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}