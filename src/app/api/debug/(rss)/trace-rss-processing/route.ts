import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(rss)/trace-rss-processing' },
  async ({ logger }) => {
  try {
    console.log('=== RSS Processing Trace Started ===')

    // 1. Check for latest issue
    const { data: issues, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    console.log('Latest issue:', issues)

    if (issueError || !issues || issues.length === 0) {
      return NextResponse.json({
        error: 'No issues found',
        details: issueError
      })
    }

    const issue = issues[0]

    // 2. Check for RSS posts
    const { data: rssPosts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('issue_id', issue.id)

    console.log(`Found ${rssPosts?.length || 0} RSS posts for issue ${issue.id}`)

    if (postsError) {
      return NextResponse.json({
        error: 'Failed to fetch RSS posts',
        details: postsError
      })
    }

    // 3. Check for post ratings
    const postIds = rssPosts?.map(p => p.id) || []
    const { data: ratings, error: ratingsError } = await supabaseAdmin
      .from('post_ratings')
      .select('*')
      .in('post_id', postIds)

    console.log(`Found ${ratings?.length || 0} ratings for ${postIds.length} posts`)

    if (ratingsError) {
      return NextResponse.json({
        error: 'Failed to fetch ratings',
        details: ratingsError
      })
    }

    // 4. Check for articles
    const { data: articles, error: articlesError } = await supabaseAdmin
      .from('articles')
      .select('*')
      .eq('issue_id', issue.id)

    console.log(`Found ${articles?.length || 0} articles for issue ${issue.id}`)

    if (articlesError) {
      return NextResponse.json({
        error: 'Failed to fetch articles',
        details: articlesError
      })
    }

    // 5. Detailed post analysis
    const postsWithRatings = rssPosts?.map(post => {
      const rating = ratings?.find(r => r.post_id === post.id)
      return {
        id: post.id,
        title: post.title,
        published_date: post.published_date,
        has_rating: !!rating,
        total_score: rating?.total_score,
        criteria_1_score: rating?.criteria_1_score,
        criteria_2_score: rating?.criteria_2_score,
        criteria_3_score: rating?.criteria_3_score
      }
    })

    return NextResponse.json({
      success: true,
      issue: {
        id: issue.id,
        date: issue.date,
        status: issue.status,
        created_at: issue.created_at
      },
      rss_posts_count: rssPosts?.length || 0,
      ratings_count: ratings?.length || 0,
      articles_count: articles?.length || 0,
      posts_with_ratings: postsWithRatings,
      ratings_summary: ratings?.map(r => ({
        post_id: r.post_id,
        total_score: r.total_score,
        criteria_1_score: r.criteria_1_score,
        criteria_2_score: r.criteria_2_score,
        criteria_3_score: r.criteria_3_score,
        created_at: r.created_at
      }))
    })

  } catch (error) {
    console.error('Trace RSS processing error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
  }
)
