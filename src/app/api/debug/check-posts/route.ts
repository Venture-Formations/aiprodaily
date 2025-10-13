import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    }

    // Get RSS posts for this campaign
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        title,
        description,
        campaign_id,
        post_rating:post_ratings(
          interest_level,
          local_relevance,
          community_impact,
          total_score,
          ai_reasoning
        )
      `)
      .eq('campaign_id', campaignId)
      .order('processed_at', { ascending: false })

    if (postsError) {
      return NextResponse.json({ error: postsError.message }, { status: 500 })
    }

    // Get articles for this campaign
    const { data: articles, error: articlesError } = await supabaseAdmin
      .from('articles')
      .select('id, headline, is_active, post_id')
      .eq('campaign_id', campaignId)

    if (articlesError) {
      return NextResponse.json({ error: articlesError.message }, { status: 500 })
    }

    // Separate posts with and without ratings
    const postsWithRatings = posts?.filter(p => p.post_rating && p.post_rating.length > 0) || []
    const postsWithoutRatings = posts?.filter(p => !p.post_rating || p.post_rating.length === 0) || []

    return NextResponse.json({
      campaign_id: campaignId,
      total_posts: posts?.length || 0,
      posts_with_ratings: postsWithRatings.length,
      posts_without_ratings: postsWithoutRatings.length,
      total_articles: articles?.length || 0,
      active_articles: articles?.filter(a => a.is_active).length || 0,
      posts_sample: postsWithRatings.slice(0, 5).map(p => ({
        id: p.id,
        title: p.title,
        rating: p.post_rating?.[0],
        has_article: articles?.some(a => a.post_id === p.id)
      })),
      posts_without_ratings_sample: postsWithoutRatings.slice(0, 5).map(p => ({
        id: p.id,
        title: p.title
      }))
    })

  } catch (error) {
    console.error('Check posts error:', error)
    return NextResponse.json({
      error: 'Failed to check posts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
