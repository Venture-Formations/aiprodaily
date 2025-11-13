import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/ai/load-live-prompt
 *
 * Fetches the live/production prompt from app_settings table
 * based on the prompt type and AI provider selected in the playground
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const publication_id = searchParams.get('publication_id')
    const provider = searchParams.get('provider')
    const prompt_type = searchParams.get('prompt_type')

    if (!publication_id || !provider || !prompt_type) {
      return NextResponse.json(
        { error: 'Missing required parameters: publication_id, provider, prompt_type' },
        { status: 400 }
      )
    }

    // Map playground prompt types to database keys
    const promptKeyMap: Record<string, string | null> = {
      'primary-title': 'ai_prompt_primary_article_title',
      'primary-body': 'ai_prompt_primary_article_body',
      'secondary-title': 'ai_prompt_secondary_article_title',
      'secondary-body': 'ai_prompt_secondary_article_body',
      'subject-line': 'ai_prompt_subject_line',
      'post-scorer': 'ai_prompt_criteria_1', // Default to first criteria prompt
      'custom': null // Custom has no live prompt
    }

    const promptKey = promptKeyMap[prompt_type]

    // Custom prompts don't have live versions
    if (!promptKey || promptKey === null) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No live prompt for custom type'
      })
    }

    // Fetch live prompt from app_settings
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, ai_provider, description, expected_outputs')
      .eq('key', promptKey)
      .maybeSingle()

    if (error) {
      console.error('[API] Error loading live prompt:', error)
      return NextResponse.json(
        { error: 'Failed to load live prompt', details: error.message },
        { status: 500 }
      )
    }

    // If no live prompt found
    if (!data) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No live prompt found for this type'
      })
    }

    // Check if provider matches (optional - return prompt anyway but include provider info)
    const promptProvider = data.ai_provider || 'openai'
    const providerMatches = promptProvider === provider

    return NextResponse.json({
      success: true,
      data: {
        key: data.key,
        prompt: data.value,
        ai_provider: promptProvider,
        description: data.description,
        expected_outputs: data.expected_outputs,
        provider_matches: providerMatches
      }
    })
  } catch (error) {
    console.error('[API] Error in load-live-prompt:', error)
    return NextResponse.json(
      {
        error: 'Failed to load live prompt',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
