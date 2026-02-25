import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to check issue advertisement data
 *
 * Usage: GET /api/debug/check-issue-ad?issueId=xxx
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-campaign-ad' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issue_id')

    if (!issueId) {
      return NextResponse.json({
        error: 'issueId parameter required'
      }, { status: 400 })
    }

    // Check issue exists
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status, publication_id')
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({
        error: 'issue not found',
        details: issueError
      }, { status: 404 })
    }

    // Check issue_advertisements records
    const { data: issueAds, error: adsError } = await supabaseAdmin
      .from('issue_advertisements')
      .select('*')
      .eq('issue_id', issueId)

    console.log(`[Check Ad] Found ${issueAds?.length || 0} issue_advertisements records`)

    // Check with nested advertisement
    const { data: issueAdsNested, error: nestedError } = await supabaseAdmin
      .from('issue_advertisements')
      .select('*, advertisement:advertisements(*)')
      .eq('issue_id', issueId)

    console.log(`[Check Ad] Nested query returned ${issueAdsNested?.length || 0} records`)

    // Test the exact query the dashboard uses
    const { data: fullissue, error: fullError } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        id,
        date,
        status,
        issue_advertisements(
          *,
          advertisement:advertisements(*)
        )
      `)
      .eq('id', issueId)
      .single()

    return NextResponse.json({
      success: true,
      issue: {
        id: issue.id,
        date: issue.date,
        status: issue.status,
        publication_id: issue.publication_id
      },
      issue_advertisements_count: issueAds?.length || 0,
      issue_advertisements: issueAds,
      nested_query_error: nestedError?.message,
      nested_query_result: issueAdsNested,
      full_dashboard_query_error: fullError?.message,
      full_dashboard_query: fullissue?.issue_advertisements
    })
  }
)

export const maxDuration = 60
