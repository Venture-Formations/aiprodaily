import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to check deduplication status
 * Usage: GET /api/debug/check-deduplication?issueId=xxx
 * Or without issueId to check the most recent issue
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-deduplication' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    let issueId = searchParams.get('issue_id')

    // If no issueId provided, get the most recent one
    if (!issueId) {
      const { data: recentissue } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status')
        .order('date', { ascending: false })
        .limit(1)
        .single()

      if (!recentissue) {
        return NextResponse.json({ error: 'No issues found' }, { status: 404 })
      }

      issueId = recentissue.id
    }

    // Get issue info
    const { data: issue } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status, subject_line')
      .eq('id', issueId)
      .single()

    if (!issue) {
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    // Get ALL duplicate groups for this issue
    const { data: duplicateGroups } = await supabaseAdmin
      .from('duplicate_groups')
      .select(`
        id,
        topic_signature,
        primary_post_id,
        primary_post:rss_posts!duplicate_groups_primary_post_id_fkey(
          id,
          title,
          description
        )
      `)
      .eq('issue_id', issueId)

    // Get ALL duplicate posts (the ones that should be filtered out)
    const groupIds = duplicateGroups?.map(g => g.id) || []
    const { data: duplicatePosts } = await supabaseAdmin
      .from('duplicate_posts')
      .select(`
        id,
        post_id,
        group_id,
        detection_method,
        similarity_score,
        post:rss_posts(
          id,
          title,
          description
        )
      `)
      .in('group_id', groupIds)

    // Check if any duplicate posts made it into articles (THIS SHOULD BE ZERO)
    const duplicatePostIds = duplicatePosts?.map(dp => dp.post_id) || []
    const { data: articlesFromDuplicates } = await supabaseAdmin
      .from('articles')
      .select('id, headline, post_id')
      .eq('issue_id', issueId)
      .in('post_id', duplicatePostIds)

    const { data: secondaryArticlesFromDuplicates } = await supabaseAdmin
      .from('secondary_articles')
      .select('id, headline, post_id')
      .eq('issue_id', issueId)
      .in('post_id', duplicatePostIds)

    // Get all articles for this issue
    const { data: allArticles } = await supabaseAdmin
      .from('articles')
      .select('id, headline, post_id, is_active')
      .eq('issue_id', issueId)

    const { data: allSecondaryArticles } = await supabaseAdmin
      .from('secondary_articles')
      .select('id, headline, post_id, is_active')
      .eq('issue_id', issueId)

    // Format duplicate groups with their duplicates
    const groupsFormatted = duplicateGroups?.map(group => ({
      topic: group.topic_signature,
      primary_post: {
        id: group.primary_post_id,
        title: (group.primary_post as any)?.title || 'Unknown',
        description: (group.primary_post as any)?.description?.substring(0, 100) || 'No description'
      },
      duplicates: duplicatePosts
        ?.filter(dp => dp.group_id === group.id)
        .map(dp => ({
          id: dp.post_id,
          title: (dp.post as any)?.title || 'Unknown',
          description: (dp.post as any)?.description?.substring(0, 100) || 'No description',
          detection_method: dp.detection_method,
          similarity_score: dp.similarity_score
        })) || []
    })) || []

    return NextResponse.json({
      issue: {
        id: issue.id,
        date: issue.date,
        status: issue.status,
        subject_line: issue.subject_line
      },
      deduplication_summary: {
        total_duplicate_groups: duplicateGroups?.length || 0,
        total_duplicate_posts: duplicatePosts?.length || 0,
        posts_filtered_correctly: duplicatePostIds.length - ((articlesFromDuplicates?.length || 0) + (secondaryArticlesFromDuplicates?.length || 0)),
        duplicate_posts_that_made_it_to_articles: (articlesFromDuplicates?.length || 0) + (secondaryArticlesFromDuplicates?.length || 0),
      },
      articles_count: {
        primary_articles: allArticles?.length || 0,
        secondary_articles: allSecondaryArticles?.length || 0,
        primary_active: allArticles?.filter(a => a.is_active).length || 0,
        secondary_active: allSecondaryArticles?.filter(a => a.is_active).length || 0
      },
      duplicate_groups: groupsFormatted,
      warning_duplicates_in_articles: [
        ...(articlesFromDuplicates?.map(a => ({
          section: 'primary',
          article_id: a.id,
          headline: a.headline,
          post_id: a.post_id
        })) || []),
        ...(secondaryArticlesFromDuplicates?.map(a => ({
          section: 'secondary',
          article_id: a.id,
          headline: a.headline,
          post_id: a.post_id
        })) || [])
      ]
    })
  }
)
