import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  TextBoxModuleSelector,
  TextBoxGenerator
} from '@/lib/text-box-modules'
import type { GenerationTiming } from '@/types/database'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/campaigns/[id]/text-box-modules - Get text box modules for an issue
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: issueId } = await context.params

    const selections = await TextBoxModuleSelector.getIssueSelections(issueId)

    return NextResponse.json({
      success: true,
      modules: selections
    })

  } catch (error: any) {
    console.error('[IssueTextBoxModules] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch text box modules', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/[id]/text-box-modules - Initialize or regenerate text box modules
 * Body: { action: 'initialize' | 'regenerate', blockId?: string, timing?: GenerationTiming }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: issueId } = await context.params
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

  } catch (error: any) {
    console.error('[IssueTextBoxModules] Failed to process:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process request', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/campaigns/[id]/text-box-modules - Update issue block content
 * Body: { blockId: string, overrideContent?: string, overrideImageUrl?: string }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: issueId } = await context.params
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

  } catch (error: any) {
    console.error('[IssueTextBoxModules] Failed to update:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update override content', details: error.message },
      { status: 500 }
    )
  }
}
