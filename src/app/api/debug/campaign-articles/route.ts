import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    }

    // Fetch campaign with active articles
    const { data: campaign, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        articles:articles(
          headline,
          content,
          is_active,
          rss_post:rss_posts(
            title,
            description,
            content,
            post_rating:post_ratings(total_score)
          )
        )
      `)
      .eq('id', campaignId)
      .single()

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get active articles sorted by rating (highest first)
    const activeArticles = campaign.articles
      .filter((article: any) => article.is_active)
      .sort((a: any, b: any) => {
        const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
        const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
        return scoreB - scoreA
      })

    return NextResponse.json({
      campaign_id: campaignId,
      campaign_date: campaign.date,
      total_articles: campaign.articles.length,
      active_articles: activeArticles.length,
      top_article: activeArticles[0] ? {
        headline: activeArticles[0].headline,
        content_preview: activeArticles[0].content?.substring(0, 200) + '...',
        content_length: activeArticles[0].content?.length || 0,
        score: activeArticles[0].rss_post?.post_rating?.[0]?.total_score || 0,
        rss_title: activeArticles[0].rss_post?.title,
        rss_description: activeArticles[0].rss_post?.description
      } : null,
      all_active_articles: activeArticles.map((article: any, index: number) => ({
        index,
        headline: article.headline,
        content_preview: article.content?.substring(0, 100) + '...',
        score: article.rss_post?.post_rating?.[0]?.total_score || 0
      }))
    })

  } catch (error) {
    console.error('Debug campaign articles error:', error)
    return NextResponse.json({
      error: 'Failed to fetch campaign articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}