import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'rss/status' },
  async ({ params }) => {
    const issueId = params.issueId

    // Get issue info
    const { data: issue } = await supabaseAdmin
      .from('publication_issues')
      .select('*')
      .eq('id', issueId)
      .single()

    if (!issue) {
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    // Get articles count
    const { data: articles } = await supabaseAdmin
      .from('articles')
      .select('id')
      .eq('issue_id', issueId)

    // Get RSS posts count
    const { data: posts } = await supabaseAdmin
      .from('rss_posts')
      .select('id')
      .eq('issue_id', issueId)

    // Get recent system logs for this issue
    const { data: logs } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .eq('source', 'rss_processor')
      .gte('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('timestamp', { ascending: false })
      .limit(10)

    return NextResponse.json({
      issue: {
        id: issue.id,
        status: issue.status,
        date: issue.date
      },
      counts: {
        articles: articles?.length || 0,
        posts: posts?.length || 0
      },
      recentLogs: logs || []
    })
  }
)
