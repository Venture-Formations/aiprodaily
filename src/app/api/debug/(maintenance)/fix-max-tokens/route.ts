import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 600

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/fix-max-tokens' },
  async ({ logger }) => {
  try {
    console.log('[FIX-MAX-TOKENS] Starting migration...')

    // First, check which prompts need fixing
    const { data: prompts, error: selectError } = await supabaseAdmin
      .from('app_settings')
      .select('key, ai_provider, value')
      .like('key', 'ai_prompt_%')

    if (selectError) {
      console.error('[FIX-MAX-TOKENS] Error selecting prompts:', selectError)
      return NextResponse.json({ error: selectError.message }, { status: 500 })
    }

    console.log(`[FIX-MAX-TOKENS] Found ${prompts?.length || 0} prompts`)

    const needsFix: string[] = []
    const alreadyGood: string[] = []

    for (const prompt of prompts || []) {
      const value = typeof prompt.value === 'string' ? JSON.parse(prompt.value) : prompt.value

      if (prompt.ai_provider === 'openai' && value.max_tokens && !value.max_output_tokens) {
        needsFix.push(prompt.key)
      } else if (value.max_output_tokens) {
        alreadyGood.push(prompt.key)
      }
    }

    console.log(`[FIX-MAX-TOKENS] Needs fix: ${needsFix.length}`)
    console.log(`[FIX-MAX-TOKENS] Already good: ${alreadyGood.length}`)

    // Fix the prompts that need it
    const fixed: string[] = []
    for (const key of needsFix) {
      const { data: current, error: getError } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .single()

      if (getError) {
        console.error(`[FIX-MAX-TOKENS] Error getting ${key}:`, getError)
        continue
      }

      const value = typeof current.value === 'string' ? JSON.parse(current.value) : current.value

      // Replace max_tokens with max_output_tokens
      if (value.max_tokens) {
        value.max_output_tokens = value.max_tokens
        delete value.max_tokens

        const { error: updateError } = await supabaseAdmin
          .from('app_settings')
          .update({ value: value })
          .eq('key', key)

        if (updateError) {
          console.error(`[FIX-MAX-TOKENS] Error updating ${key}:`, updateError)
        } else {
          console.log(`[FIX-MAX-TOKENS] Fixed ${key}`)
          fixed.push(key)
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: prompts?.length || 0,
        needsFix: needsFix.length,
        fixed: fixed.length,
        alreadyGood: alreadyGood.length
      },
      details: {
        needsFix,
        fixed,
        alreadyGood
      }
    })

  } catch (error: any) {
    console.error('[FIX-MAX-TOKENS] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
  }
)
