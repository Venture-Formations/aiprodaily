import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { PollModuleSelector } from '@/lib/poll-modules'

/**
 * GET /api/campaigns/[id]/poll-modules - Get poll module selections for an issue
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: issueId } = await params

    // Get the issue to get publication_id
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('publication_id')
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Get all poll module selections for this issue
    let selections = await PollModuleSelector.getIssuePollSelections(issueId)

    // If no selections exist, initialize them (empty - admin must pick manually)
    if (!selections || selections.length === 0) {
      await PollModuleSelector.initializeSelectionsForIssue(issueId, issue.publication_id)
      selections = await PollModuleSelector.getIssuePollSelections(issueId)
    }

    // Get all active poll modules for the publication
    const { data: allModules } = await supabaseAdmin
      .from('poll_modules')
      .select('id, name, display_order, block_order, is_active')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Get all active polls for manual selection dropdown
    const availablePolls = await PollModuleSelector.getAvailablePolls(issue.publication_id)

    return NextResponse.json({
      selections: selections || [],
      modules: allModules || [],
      availablePolls
    })

  } catch (error: any) {
    console.error('[PollModules] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch poll modules', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/[id]/poll-modules - Manually select a poll for a module
 * Body: { moduleId, pollId }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: issueId } = await params
    const body = await request.json()
    const { moduleId, pollId } = body

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    if (!pollId) {
      return NextResponse.json({ error: 'pollId is required' }, { status: 400 })
    }

    const result = await PollModuleSelector.manuallySelectPoll(issueId, moduleId, pollId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[PollModules] Error selecting poll:', error)
    return NextResponse.json(
      { error: 'Failed to select poll', details: error.message },
      { status: 500 }
    )
  }
}
