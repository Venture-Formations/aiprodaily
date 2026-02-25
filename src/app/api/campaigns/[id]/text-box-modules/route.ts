import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import {
  TextBoxModuleSelector,
  TextBoxGenerator
} from '@/lib/text-box-modules'
import type { GenerationTiming } from '@/types/database'

/**
 * GET /api/campaigns/[id]/text-box-modules - Get text box modules for an issue
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/text-box-modules' },
  async ({ params, logger }) => {
    const issueId = params.id

    // Get issue to find publication_id
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('publication_id')
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      )
    }

    // Check if modules have been initialized for this issue
    let selections = await TextBoxModuleSelector.getIssueSelections(issueId)

    // If no selections exist, auto-initialize the text box modules
    if (selections.length === 0) {
      logger.info({ issueId }, '[IssueTextBoxModules] No selections found, auto-initializing')
      await TextBoxModuleSelector.initializeForIssue(issueId, issue.publication_id)
      // Fetch again after initialization
      selections = await TextBoxModuleSelector.getIssueSelections(issueId)
    }

    // Auto-fix: Update any static image blocks that incorrectly have 'pending' status
    for (const selection of selections) {
      for (const block of selection.blocks) {
        const issueBlock = selection.issueBlocks.find(ib => ib.text_box_block_id === block.id)
        if (
          block.block_type === 'image' &&
          block.image_type === 'static' &&
          issueBlock &&
          issueBlock.generation_status === 'pending'
        ) {
          logger.info({ blockId: block.id }, '[IssueTextBoxModules] Auto-fixing static image block status from pending to completed')
          await supabaseAdmin
            .from('issue_text_box_blocks')
            .update({
              generation_status: 'completed',
              generated_image_url: block.static_image_url
            })
            .eq('id', issueBlock.id)
          // Update the local object too
          issueBlock.generation_status = 'completed'
          issueBlock.generated_image_url = block.static_image_url
        }
      }
    }

    return NextResponse.json({
      success: true,
      modules: selections
    })
  }
)

/**
 * POST /api/campaigns/[id]/text-box-modules - Initialize or regenerate text box modules
 * Body: { action: 'initialize' | 'regenerate', blockId?: string, timing?: GenerationTiming }
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/text-box-modules' },
  async ({ params, request, logger }) => {
    const issueId = params.id
    const body = await request.json()
    const { action, blockId, timing } = body

    // Get publication_id from issue
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('publication_id, status')
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      )
    }

    // Don't allow modifications to sent issues
    if (issue.status === 'sent') {
      return NextResponse.json(
        { error: 'Cannot modify sent issues' },
        { status: 400 }
      )
    }

    if (action === 'initialize') {
      // Initialize text box modules for the issue
      const result = await TextBoxModuleSelector.initializeForIssue(
        issueId,
        issue.publication_id
      )

      return NextResponse.json({
        success: result.success,
        modulesInitialized: result.modulesInitialized,
        blocksInitialized: result.blocksInitialized
      })
    }

    if (action === 'regenerate') {
      if (blockId) {
        // Regenerate a specific block
        const result = await TextBoxGenerator.regenerateBlock(issueId, blockId)

        return NextResponse.json({
          success: result.success,
          content: result.content,
          imageUrl: result.imageUrl,
          error: result.error
        })
      } else {
        // Regenerate all blocks for a timing
        const selectedTiming: GenerationTiming = timing || 'after_articles'
        const result = await TextBoxGenerator.generateBlocksWithTiming(
          issueId,
          selectedTiming
        )

        return NextResponse.json({
          success: result.success,
          generated: result.generated,
          failed: result.failed,
          timing: selectedTiming
        })
      }
    }

    return NextResponse.json(
      { error: 'Invalid action. Must be "initialize" or "regenerate"' },
      { status: 400 }
    )
  }
)

/**
 * PATCH /api/campaigns/[id]/text-box-modules - Update issue block content
 * Body: { blockId: string, overrideContent?: string, overrideImageUrl?: string }
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/text-box-modules' },
  async ({ params, request, logger }) => {
    const issueId = params.id
    const body = await request.json()
    const { blockId, overrideContent, overrideImageUrl } = body

    if (!blockId) {
      return NextResponse.json(
        { error: 'blockId is required' },
        { status: 400 }
      )
    }

    // Check issue status
    const { data: issue } = await supabaseAdmin
      .from('publication_issues')
      .select('status')
      .eq('id', issueId)
      .single()

    if (issue?.status === 'sent') {
      return NextResponse.json(
        { error: 'Cannot modify sent issues' },
        { status: 400 }
      )
    }

    const result = await TextBoxModuleSelector.setOverrideContent(
      issueId,
      blockId,
      overrideContent !== undefined ? overrideContent : null,
      overrideImageUrl
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Override content updated'
    })
  }
)
