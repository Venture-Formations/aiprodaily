import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'
import { PollModuleSelector } from '@/lib/poll-modules'

/**
 * GET /api/campaigns/[id]/poll-modules - Get poll module selections for an issue
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/poll-modules' },
  async ({ params }) => {
    const issueId = params.id

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

    // Get publication settings for preview styling
    const { data: pubSettings } = await supabaseAdmin
      .from('publication_settings')
      .select('primary_color, tertiary_color, body_font')
      .eq('publication_id', issue.publication_id)
      .single()

    return NextResponse.json({
      selections: selections || [],
      modules: allModules || [],
      availablePolls,
      styles: {
        primaryColor: pubSettings?.primary_color || '#667eea',
        tertiaryColor: pubSettings?.tertiary_color || '#ffffff',
        bodyFont: pubSettings?.body_font || 'Arial, sans-serif'
      }
    })
  }
)

/**
 * POST /api/campaigns/[id]/poll-modules - Manually select a poll for a module
 * Body: { moduleId, pollId } - pollId can be null to clear selection
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/poll-modules' },
  async ({ params, request }) => {
    const issueId = params.id
    const body = await request.json()
    const { moduleId, pollId } = body

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    // Handle clearing the poll selection (pollId = null)
    if (pollId === null || pollId === '') {
      const result = await PollModuleSelector.clearPollSelection(issueId, moduleId)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    const result = await PollModuleSelector.manuallySelectPoll(issueId, moduleId, pollId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  }
)
