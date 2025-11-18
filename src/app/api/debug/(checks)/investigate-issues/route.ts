import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const issueId1 = 'd8679cfd-c2a2-42c0-aa1a-ca6a612ba0af'
  const issueId2 = 'f546382b-54e6-4d3f-8edf-79bc20541b85'

  // Get issue details
  const { data: issues } = await supabaseAdmin
    .from('publication_issues')
    .select('id, date, status, created_at')
    .in('id', [issueId1, issueId2])
    .order('date')

  const results: any = {
    issues: issues,
    articles: {},
    deduplication: {}
  }

  // Get articles for each issue
  for (const issue of issues || []) {
    const { data: articles } = await supabaseAdmin
      .from('articles')
      .select('id, post_id, headline, is_active, skipped')
      .eq('issue_id', issue.id)

    const postIds = articles?.filter(a => a.post_id).map(a => a.post_id) || []

    const { data: posts } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, feed_id, content, full_article_text')
      .in('id', postIds)

    results.articles[issue.id] = {
      count: articles?.length || 0,
      posts: posts?.map(p => ({
        id: p.id,
        title: p.title,
        feed_id: p.feed_id,
        content_preview: (p.full_article_text || p.content || '').substring(0, 200)
      }))
    }

    // Get deduplication records
    const { data: groups } = await supabaseAdmin
      .from('duplicate_groups')
      .select('id, primary_post_id, topic_signature')
      .eq('issue_id', issue.id)

    results.deduplication[issue.id] = {
      groupCount: groups?.length || 0,
      groups: groups
    }
  }

  return NextResponse.json(results, { status: 200 })
}
