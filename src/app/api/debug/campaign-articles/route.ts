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

    // Get total RSS posts count for this campaign
    const { data: allPosts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, post_ratings(total_score)')
      .eq('campaign_id', campaignId)

    // Get duplicate posts count
    const { data: duplicates, error: dupError } = await supabaseAdmin
      .from('duplicate_posts')
      .select(`
        post_id,
        group:duplicate_groups!inner(campaign_id)
      `)
      .eq('group.campaign_id', campaignId)

    // Get active articles sorted by rating (highest first)
    const activeArticles = campaign.articles
      .filter((article: any) => article.is_active)
      .sort((a: any, b: any) => {
        const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
        const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
        return scoreB - scoreA
      })

    const duplicatePostIds = new Set(duplicates?.map(d => d.post_id) || [])
    const postsWithRatings = allPosts?.filter(p => p.post_ratings?.[0]) || []
    const nonDuplicatePosts = postsWithRatings.filter(p => !duplicatePostIds.has(p.id))

    return NextResponse.json({
      campaign_id: campaignId,
      campaign_date: campaign.date,
      total_rss_posts: allPosts?.length || 0,
      posts_with_ratings: postsWithRatings.length,
      duplicate_posts: duplicatePostIds.size,
      non_duplicate_posts: nonDuplicatePosts.length,
      total_articles: campaign.articles.length,
      active_articles: activeArticles.length,
      all_posts: allPosts?.map((post: any) => ({
        id: post.id,
        title: post.title,
        has_rating: !!post.post_ratings?.[0],
        score: post.post_ratings?.[0]?.total_score || null,
        is_duplicate: duplicatePostIds.has(post.id),
        has_article: campaign.articles.some((a: any) => a.rss_post?.title === post.title)
      })),
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