import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get recent campaigns
    const { data: campaigns, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status, subject_line, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // For the most recent campaign, get detailed info
    if (campaigns && campaigns.length > 0) {
      const latestCampaign = campaigns[0]

      const { data: detailedCampaign, error: detailError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select(`
          *,
          articles:articles(
            id,
            headline,
            content,
            is_active,
            rss_post:rss_posts(
              title,
              description,
              post_rating:post_ratings(total_score)
            )
          )
        `)
        .eq('id', latestCampaign.id)
        .single()

      if (!detailError && detailedCampaign) {
        // Get active articles sorted by rating
        const activeArticles = detailedCampaign.articles
          .filter((article: any) => article.is_active)
          .sort((a: any, b: any) => {
            const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
            const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
            return scoreB - scoreA
          })

        return NextResponse.json({
          recent_campaigns: campaigns,
          latest_campaign_details: {
            id: detailedCampaign.id,
            date: detailedCampaign.date,
            status: detailedCampaign.status,
            subject_line: detailedCampaign.subject_line,
            total_articles: detailedCampaign.articles.length,
            active_articles_count: activeArticles.length,
            top_article: activeArticles[0] ? {
              id: activeArticles[0].id,
              headline: activeArticles[0].headline,
              content_preview: activeArticles[0].content?.substring(0, 300) + '...',
              content_full_length: activeArticles[0].content?.length || 0,
              score: activeArticles[0].rss_post?.post_rating?.[0]?.total_score || 0,
              rss_title: activeArticles[0].rss_post?.title,
              rss_description: activeArticles[0].rss_post?.description?.substring(0, 200) + '...'
            } : null,
            all_active_articles: activeArticles.slice(0, 5).map((article: any, index: number) => ({
              rank: index + 1,
              id: article.id,
              headline: article.headline,
              score: article.rss_post?.post_rating?.[0]?.total_score || 0,
              content_preview: article.content?.substring(0, 100) + '...'
            }))
          }
        })
      }
    }

    return NextResponse.json({ recent_campaigns: campaigns })

  } catch (error) {
    console.error('Debug recent campaigns error:', error)
    return NextResponse.json({
      error: 'Failed to fetch campaigns',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}