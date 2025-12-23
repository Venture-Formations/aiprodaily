import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { PromptModuleSelector } from '@/lib/prompt-modules'

/**
 * GET /api/campaigns/[id]/prompt-modules - Get prompt module selections for an issue
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

    // Get all prompt module selections for this issue
    let selections = await PromptModuleSelector.getIssuePromptSelections(issueId)

    // If no selections exist, initialize them (empty - admin must pick manually or auto-select runs later)
    if (!selections || selections.length === 0) {
      await PromptModuleSelector.initializeSelectionsForIssue(issueId, issue.publication_id)
      selections = await PromptModuleSelector.getIssuePromptSelections(issueId)
    }

    // Get all active prompt modules for the publication
    const { data: allModules } = await supabaseAdmin
      .from('prompt_modules')
      .select('id, name, display_order, block_order, is_active, selection_mode')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Get all active prompts for manual selection dropdown
    const availablePrompts = await PromptModuleSelector.getAvailablePrompts(issue.publication_id)

    // Get publication settings for preview styling
    const { data: pubSettings } = await supabaseAdmin
      .from('publication_settings')
      .select('primary_color, tertiary_color, heading_font, body_font')
      .eq('publication_id', issue.publication_id)
      .single()

    return NextResponse.json({
      selections: selections || [],
      modules: allModules || [],
      availablePrompts,
      styles: {
        primaryColor: pubSettings?.primary_color || '#667eea',
        tertiaryColor: pubSettings?.tertiary_color || '#ffffff',
        headingFont: pubSettings?.heading_font || 'Georgia, serif',
        bodyFont: pubSettings?.body_font || 'Arial, sans-serif'
      }
    })

  } catch (error: any) {
    console.error('[PromptModules] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompt modules', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/[id]/prompt-modules - Manually select a prompt for a module
 * Body: { moduleId, promptId } - promptId can be null to clear selection
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
    const { moduleId, promptId } = body

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    // Handle clearing the prompt selection (promptId = null)
    if (promptId === null || promptId === '') {
      const result = await PromptModuleSelector.clearPromptSelection(issueId, moduleId)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    const result = await PromptModuleSelector.manuallySelectPrompt(issueId, moduleId, promptId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[PromptModules] Error selecting prompt:', error)
    return NextResponse.json(
      { error: 'Failed to select prompt', details: error.message },
      { status: 500 }
    )
  }
}
