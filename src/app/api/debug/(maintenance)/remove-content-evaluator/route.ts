import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 600

/**
 * Removes the unused ai_prompt_content_evaluator and ai_prompt_secondary_content_evaluator prompts.
 * These prompts are legacy from the old scoring system and are no longer used.
 * The system now uses criteria-based scoring (ai_prompt_criteria_1 through ai_prompt_criteria_5).
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/remove-content-evaluator' },
  async ({ logger }) => {
  try {
    console.log('[REMOVE-CONTENT-EVALUATOR] Starting cleanup...')

    // Find all content_evaluator prompts
    const { data: existingPrompts, error: selectError } = await supabaseAdmin
      .from('app_settings')
      .select('key, description')
      .like('key', '%content_evaluator%')

    if (selectError) {
      console.error('[REMOVE-CONTENT-EVALUATOR] Error finding prompts:', selectError)
      return NextResponse.json({ error: selectError.message }, { status: 500 })
    }

    console.log(`[REMOVE-CONTENT-EVALUATOR] Found ${existingPrompts?.length || 0} content_evaluator prompts`)

    if (!existingPrompts || existingPrompts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No content_evaluator prompts found (already removed)',
        promptsRemoved: []
      })
    }

    // Delete each one
    const removed: string[] = []
    for (const prompt of existingPrompts) {
      const { error: deleteError } = await supabaseAdmin
        .from('app_settings')
        .delete()
        .eq('key', prompt.key)

      if (deleteError) {
        console.error(`[REMOVE-CONTENT-EVALUATOR] Error deleting ${prompt.key}:`, deleteError)
      } else {
        console.log(`[REMOVE-CONTENT-EVALUATOR] Deleted: ${prompt.key}`)
        removed.push(prompt.key)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Removed ${removed.length} content_evaluator prompts`,
      promptsRemoved: removed,
      details: existingPrompts.map(p => ({
        key: p.key,
        description: p.description
      }))
    })

  } catch (error: any) {
    console.error('[REMOVE-CONTENT-EVALUATOR] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
  }
)
