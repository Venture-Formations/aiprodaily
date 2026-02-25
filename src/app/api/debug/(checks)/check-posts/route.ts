import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-posts' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issue_id')

    if (!issueId) {
      return NextResponse.json({ error: 'issueId required' }, { status: 400 })
    }

    // Get RSS posts for this issue
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        title,
        description,
        issueId,
        post_rating:post_ratings(
          interest_level,
          local_relevance,
          community_impact,
          total_score,
          ai_reasoning
        )
      `)
      .eq('issue_id', issueId)
      .order('processed_at', { ascending: false })

    if (postsError) {
      return NextResponse.json({ error: postsError.message }, { status: 500 })
    }

    // Get articles for this issue
    const { data: articles, error: articlesError } = await supabaseAdmin
      .from('articles')
      .select('id, headline, is_active, post_id')
      .eq('issue_id', issueId)

    if (articlesError) {
      return NextResponse.json({ error: articlesError.message }, { status: 500 })
    }

    // Separate posts with and without ratings
    const postsWithRatings = posts?.filter(p => p.post_rating && p.post_rating.length > 0) || []
    const postsWithoutRatings = posts?.filter(p => !p.post_rating || p.post_rating.length === 0) || []

    return NextResponse.json({
      issue_id: issueId,
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
  }
)
