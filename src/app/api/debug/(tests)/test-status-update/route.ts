import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(tests)/test-status-update' },
  async ({ request, session, logger }) => {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issue_id')

    if (!issueId) {
      return NextResponse.json({ error: 'issueId parameter required' }, { status: 400 })
    }

    logger.info({ issueId }, 'Status update debug')

    // Check if issue exists
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('*')
      .eq('id', issueId)
      .single()

    if (issueError) {
      return NextResponse.json({
        error: 'issue lookup failed',
        details: issueError.message,
        code: issueError.code
      }, { status: 500 })
    }

    if (!issue) {
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    // Test the update operation
    const { error: updateError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        status: 'changes_made',
        last_action: 'changes_made',
        last_action_at: new Date().toISOString(),
        last_action_by: session.user?.email || 'unknown'
      })
      .eq('id', issueId)

    if (updateError) {
      return NextResponse.json({
        error: 'Update failed',
        details: updateError.message,
        code: updateError.code,
        hint: updateError.hint || 'none'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Status update test completed successfully',
      issue: {
        id: issueId,
        current_status: issue.status,
        updated_status: 'changes_made'
      }
    })
  }
)
