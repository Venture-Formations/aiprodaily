import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-logs' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issue_id')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabaseAdmin
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (issueId) {
      query = query.eq('context->>issueId', issueId)
    }

    const { data: logs, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      total_logs: logs?.length || 0,
      logs: logs?.map(log => ({
        level: log.level,
        message: log.message,
        context: log.context,
        source: log.source,
        created_at: log.created_at
      })) || []
    })
  }
)
