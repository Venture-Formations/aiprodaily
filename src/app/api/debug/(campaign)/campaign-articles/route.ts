import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(campaign)/campaign-articles' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issue_id')

    if (!issueId) {
      return NextResponse.json({ error: 'issueId required' }, { status: 400 })
    }

    // Fetch issue with active articles
    const { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
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
      .eq('id', issueId)
      .single()

    if (error || !issue) {
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    // Get total RSS posts count for this issue
    const { data: allPosts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, post_ratings(total_score)')
      .eq('issue_id', issueId)

    // Get duplicate posts count (two-step query for proper filtering)
    const { data: duplicateGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id')
      .eq('issue_id', issueId)

    const groupIds = duplicateGroups?.map(g => g.id) || []

    let duplicates: { post_id: string }[] = []
    if (groupIds.length > 0) {
      const { data: duplicateData } = await supabaseAdmin
        .from('duplicate_posts')
        .select('post_id')
        .in('group_id', groupIds)

      duplicates = duplicateData || []
    }

    // Get active articles sorted by rating (highest first)
    const activeArticles = issue.articles
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
      issue_id: issueId,
      issue_date: issue.date,
      total_rss_posts: allPosts?.length || 0,
      posts_with_ratings: postsWithRatings.length,
      duplicate_posts: duplicatePostIds.size,
      non_duplicate_posts: nonDuplicatePosts.length,
      total_articles: issue.articles.length,
      active_articles: activeArticles.length,
      all_posts: allPosts?.map((post: any) => ({
        id: post.id,
        title: post.title,
        has_rating: !!post.post_ratings?.[0],
        score: post.post_ratings?.[0]?.total_score || null,
        is_duplicate: duplicatePostIds.has(post.id),
        has_article: issue.articles.some((a: any) => a.rss_post?.title === post.title)
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
  }
)
