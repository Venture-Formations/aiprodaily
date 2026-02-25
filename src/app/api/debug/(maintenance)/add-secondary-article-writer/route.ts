import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Add secondary article writer prompt by copying from primary
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/add-secondary-article-writer' },
  async ({ logger }) => {
  try {
    // Get the primary article writer prompt
    const { data: primaryPrompt, error: fetchError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, description')
      .eq('key', 'ai_prompt_article_writer')
      .single()

    if (fetchError || !primaryPrompt) {
      return NextResponse.json({
        success: false,
        error: 'Primary prompt ai_prompt_article_writer not found in database'
      }, { status: 404 })
    }

    // Check if secondary prompt already exists
    const { data: existing } = await supabaseAdmin
      .from('app_settings')
      .select('key')
      .eq('key', 'ai_prompt_secondary_article_writer')
      .single()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'ai_prompt_secondary_article_writer already exists (skipped)'
      })
    }

    // Insert the secondary prompt
    const { error: insertError } = await supabaseAdmin
      .from('app_settings')
      .insert({
        key: 'ai_prompt_secondary_article_writer',
        value: primaryPrompt.value,
        description: 'AI Prompt: Secondary Article Writer (converts RSS into newsletter articles for secondary section)',
        updated_by: 'system',
        updated_at: new Date().toISOString()
      })

    if (insertError) {
      return NextResponse.json({
        success: false,
        error: insertError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Created ai_prompt_secondary_article_writer successfully',
      copied_from: 'ai_prompt_article_writer'
    })

  } catch (error: any) {
    console.error('Setup error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
  }
)
