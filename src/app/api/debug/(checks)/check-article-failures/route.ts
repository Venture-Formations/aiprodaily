import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-article-failures' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issue_id')

    if (!issueId) {
      return NextResponse.json({ error: 'issueId required' }, { status: 400 })
    }

    // Get all posts with ratings
    const { data: ratedPosts } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        title,
        post_ratings(total_score, interest_level, local_relevance, community_impact)
      `)
      .eq('issue_id', issueId)

    // Get all articles
    const { data: articles } = await supabaseAdmin
      .from('articles')
      .select('id, post_id, headline, is_active')
      .eq('issue_id', issueId)

    const articlePostIds = new Set(articles?.map(a => a.post_id) || [])

    // Find posts that were rated but didn't get articles
    const postsWithRatings = ratedPosts?.filter((p: any) => p.post_ratings && p.post_ratings.length > 0) || []
    const missingArticles = postsWithRatings.filter(p => !articlePostIds.has(p.id))

    // Check for duplicate groups
    const { data: duplicateGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select(`
        id,
        topic_signature,
        primary_post_id,
        duplicate_posts(post_id)
      `)
      .eq('issue_id', issueId)

    const duplicatePostIds = new Set()
    duplicateGroups?.forEach(g => {
      g.duplicate_posts?.forEach((dp: any) => {
        duplicatePostIds.add(dp.post_id)
      })
    })

    // Check system logs for errors
    const { data: errorLogs } = await supabaseAdmin
      .from('system_logs')
      .select('created_at, level, message, metadata')
      .or(`message.ilike.%article%,message.ilike.%fact%,message.ilike.%newsletter%`)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      success: true,
      issue_id: issueId,
      summary: {
        total_rated_posts: postsWithRatings.length,
        total_articles: articles?.length || 0,
        missing_articles: missingArticles.length,
        duplicate_groups: duplicateGroups?.length || 0,
        duplicate_posts_excluded: duplicatePostIds.size
      },
      posts_without_articles: missingArticles.map((p: any) => ({
        id: p.id,
        title: p.title.substring(0, 80),
        score: p.post_ratings?.[0]?.total_score || 0,
        interest: p.post_ratings?.[0]?.interest_level || 0,
        local: p.post_ratings?.[0]?.local_relevance || 0,
        impact: p.post_ratings?.[0]?.community_impact || 0,
        is_duplicate: duplicatePostIds.has(p.id)
      })),
      duplicate_groups: duplicateGroups?.map(g => ({
        topic: g.topic_signature,
        primary_post_id: g.primary_post_id,
        duplicate_count: g.duplicate_posts?.length || 0
      })),
      recent_errors: errorLogs?.slice(0, 10).map(log => ({
        time: log.created_at,
        level: log.level,
        message: log.message,
        metadata: log.metadata
      }))
    })
  }
)
