import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: issueId } = await params

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

  } catch (error) {
    console.error('[Reprocess API] Failed:', error)
    return NextResponse.json({
      error: 'Failed to start reprocess workflow',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 60
