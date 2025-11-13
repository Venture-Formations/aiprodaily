import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
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

  } catch (error) {
    console.error('Check logs error:', error)
    return NextResponse.json({
      error: 'Failed to check logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
