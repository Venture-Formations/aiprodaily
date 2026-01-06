import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Test endpoint for text box module generation
 * (Replaces legacy welcome section testing)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issueId')

    if (!issueId) {
      return NextResponse.json(
        { error: 'issueId parameter required' },
        { status: 400 }
      )
    }

    console.log('[TEST] Testing text box modules for issue:', issueId)

    // Get publication_id for the issue
    const { data: issue } = await supabaseAdmin
      .from('publication_issues')
      .select('publication_id')
      .eq('id', issueId)
      .single()

    if (!issue?.publication_id) {
      return NextResponse.json(
        { error: 'Could not find publication for issue' },
        { status: 404 }
      )
    }

    // Initialize and generate text box modules
    const { TextBoxModuleSelector, TextBoxGenerator } = await import('@/lib/text-box-modules')
    await TextBoxModuleSelector.initializeForIssue(issueId, issue.publication_id)
    const result = await TextBoxGenerator.generateBlocksWithTiming(issueId, 'after_articles')

    console.log('[TEST] Text box modules generated:', result)

    // Get the generated blocks
    const { data: issueBlocks } = await supabaseAdmin
      .from('issue_text_box_blocks')
      .select(`
        id,
        generated_content,
        generation_status,
        text_box_block:text_box_blocks(
          id,
          block_type,
          text_box_module:text_box_modules(name)
        )
      `)
      .eq('issue_id', issueId)

    return NextResponse.json({
      success: true,
      generated: result.generated,
      failed: result.failed,
      blocks: issueBlocks?.map(b => ({
        id: b.id,
        module: (b.text_box_block as any)?.text_box_module?.name,
        type: (b.text_box_block as any)?.block_type,
        status: b.generation_status,
        content_preview: b.generated_content?.substring(0, 200)
      }))
    })
  } catch (error: any) {
    console.error('[TEST] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export const maxDuration = 600
