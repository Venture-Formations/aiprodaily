import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Initialize AI prompts for secondary articles section
 * Creates database entries with same prompts as primary section (can be customized later via UI)
 */
export async function GET(request: NextRequest) {
  try {
    // Get the primary section prompts to use as templates
    const { data: primaryPrompts, error: fetchError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, description')
      .in('key', [
        'ai_prompt_content_evaluator',
        'ai_prompt_article_writer',
        'ai_prompt_criteria_1',
        'ai_prompt_criteria_2',
        'ai_prompt_criteria_3',
        'ai_prompt_criteria_4',
        'ai_prompt_criteria_5'
      ])

    if (fetchError) {
      throw fetchError
    }

    // Define secondary article prompts (start with same values as primary)
    const secondaryPromptMappings = [
      {
        primary_key: 'ai_prompt_content_evaluator',
        secondary_key: 'ai_prompt_secondary_content_evaluator',
        description: 'AI Prompt: Secondary Article Content Evaluator (rates interest_level, local_relevance, community_impact)'
      },
      {
        primary_key: 'ai_prompt_article_writer',
        secondary_key: 'ai_prompt_secondary_article_writer',
        description: 'AI Prompt: Secondary Article Writer (converts RSS into newsletter articles for secondary section)'
      },
      {
        primary_key: 'ai_prompt_criteria_1',
        secondary_key: 'ai_prompt_secondary_criteria_1',
        description: 'AI Prompt: Secondary Article Criteria 1 Evaluator'
      },
      {
        primary_key: 'ai_prompt_criteria_2',
        secondary_key: 'ai_prompt_secondary_criteria_2',
        description: 'AI Prompt: Secondary Article Criteria 2 Evaluator'
      },
      {
        primary_key: 'ai_prompt_criteria_3',
        secondary_key: 'ai_prompt_secondary_criteria_3',
        description: 'AI Prompt: Secondary Article Criteria 3 Evaluator'
      },
      {
        primary_key: 'ai_prompt_criteria_4',
        secondary_key: 'ai_prompt_secondary_criteria_4',
        description: 'AI Prompt: Secondary Article Criteria 4 Evaluator'
      },
      {
        primary_key: 'ai_prompt_criteria_5',
        secondary_key: 'ai_prompt_secondary_criteria_5',
        description: 'AI Prompt: Secondary Article Criteria 5 Evaluator'
      }
    ]

    const results = []

    for (const mapping of secondaryPromptMappings) {
      const primaryPrompt = primaryPrompts?.find(p => p.key === mapping.primary_key)

      if (!primaryPrompt) {
        results.push({
          key: mapping.secondary_key,
          success: false,
          message: `Primary prompt ${mapping.primary_key} not found in database`
        })
        continue
      }

      // Check if secondary prompt already exists
      const { data: existing } = await supabaseAdmin
        .from('app_settings')
        .select('key')
        .eq('key', mapping.secondary_key)
        .single()

      if (existing) {
        results.push({
          key: mapping.secondary_key,
          success: true,
          message: 'Already exists (skipped)'
        })
        continue
      }

      // Insert the secondary prompt with same value as primary
      const { error: insertError } = await supabaseAdmin
        .from('app_settings')
        .insert({
          key: mapping.secondary_key,
          value: primaryPrompt.value,
          description: mapping.description,
          updated_by: 'system',
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        results.push({
          key: mapping.secondary_key,
          success: false,
          message: insertError.message
        })
      } else {
        results.push({
          key: mapping.secondary_key,
          success: true,
          message: 'Created successfully (copied from primary)'
        })
      }
    }

    const allSuccessful = results.every(r => r.success)

    return NextResponse.json({
      success: allSuccessful,
      message: allSuccessful
        ? 'All secondary article AI prompts initialized successfully'
        : 'Some secondary article AI prompts failed - see details',
      results
    })

  } catch (error: any) {
    console.error('Setup error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        note: 'Failed to initialize secondary article AI prompts'
      },
      { status: 500 }
    )
  }
}
