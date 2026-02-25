import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'
import { SparkLoopRecModuleSelector } from '@/lib/sparkloop-rec-modules'

/**
 * GET /api/campaigns/[id]/sparkloop-rec-modules
 * Get sparkloop rec module selections for an issue
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/sparkloop-rec-modules' },
  async ({ params }) => {
    const issueId = params.id

    // Get the issue
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('publication_id, status')
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Get selections with recommendation data
    const { selections } = await SparkLoopRecModuleSelector.getIssueSelections(issueId)

    // Get all active modules
    const { data: modules } = await supabaseAdmin
      .from('sparkloop_rec_modules')
      .select('id, name, display_order, is_active, selection_mode, block_order, recs_count')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Get all eligible recommendations for manual selection
    const eligible = await SparkLoopRecModuleSelector.getEligibleRecommendations(issue.publication_id)

    return NextResponse.json({
      selections: selections || [],
      modules: modules || [],
      eligibleRecs: eligible,
    })
  }
)

/**
 * POST /api/campaigns/[id]/sparkloop-rec-modules
 * Manually select recommendations for a module
 * Body: { moduleId, refCodes }
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/sparkloop-rec-modules' },
  async ({ params, request }) => {
    const issueId = params.id
    const body = await request.json()
    const { moduleId, refCodes } = body

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    if (!Array.isArray(refCodes)) {
      return NextResponse.json({ error: 'refCodes must be an array' }, { status: 400 })
    }

    const result = await SparkLoopRecModuleSelector.manuallySelectRecs(issueId, moduleId, refCodes)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  }
)
