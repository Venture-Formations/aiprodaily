import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { start } from 'workflow/api'
import { reprocessArticlesWorkflow } from '@/lib/workflows/reprocess-articles-workflow'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Reprocess Articles for an Existing Issue
 *
 * This endpoint triggers the reprocess workflow which:
 * 1. Deletes existing articles
 * 2. Unassigns posts
 * 3. Reselects top posts
 * 4. Regenerates all articles
 * 5. Regenerates welcome section
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/reprocess' },
  async ({ params }) => {
    const issueId = params.id

    if (!issueId) {
      return NextResponse.json({ error: 'issue ID required' }, { status: 400 })
    }

    // Get issue and newsletter info
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, publication_id, status')
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    // Prevent reprocessing if already processing
    if (issue.status === 'processing') {
      return NextResponse.json({
        error: 'issue is already processing',
        status: issue.status
      }, { status: 409 })
    }

    console.log(`[Reprocess API] Starting reprocess for issue ${issueId}`)

    // Start the workflow
    await start(reprocessArticlesWorkflow, [{
      issue_id: issueId,
      publication_id: issue.publication_id
    }])

    return NextResponse.json({
      success: true,
      message: 'Reprocess workflow started',
      issue_id: issueId
    })
  }
)

export const maxDuration = 60
