import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

// Debug endpoint to check what's preventing issue deletion
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-campaign-relations' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issue_id')

    if (!issueId) {
      return NextResponse.json({
        error: 'issueId parameter required'
      }, { status: 400 })
    }

    console.log(`Checking relations for issue: ${issueId}`)

    const results: Record<string, any> = {}

    // Check all tables that might reference this issue
    const tables = [
      'issue_events',
      'articles',
      'rss_posts',
      'road_work_data',
      'user_activities',
      'archived_articles',
      'archived_rss_posts'
    ]

    for (const table of tables) {
      try {
        const { data, error, count } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: false })
          .eq('issue_id', issueId)

        if (error) {
          results[table] = { error: error.message, code: error.code }
        } else {
          results[table] = {
            count: count || data?.length || 0,
            sample: data?.slice(0, 2) || [] // Show first 2 records
          }
        }
      } catch (err) {
        results[table] = {
          error: err instanceof Error ? err.message : 'Unknown error',
          note: 'Table might not exist or column name different'
        }
      }
    }

    // Check the issue itself
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('*')
      .eq('id', issueId)
      .single()

    return NextResponse.json({
      success: true,
      issue_id: issueId,
      issue: issue || { error: issueError?.message },
      related_data: results,
      summary: {
        tables_with_data: Object.entries(results)
          .filter(([_, data]) => !data.error && data.count > 0)
          .map(([table, data]) => `${table}: ${data.count} records`)
      },
      timestamp: new Date().toISOString()
    })
  }
)
