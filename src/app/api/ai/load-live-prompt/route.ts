import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/ai/load-live-prompt
 *
 * Fetches the live/production prompt from publication_settings table
 * based on the prompt type and AI provider selected in the playground
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'ai/load-live-prompt' },
  async ({ request, logger }) => {
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

    // Check if this is a module-based prompt type (e.g., "module-{uuid}-title" or "module-{uuid}-body")
    const moduleMatch = prompt_type.match(/^module-(.+)-(title|body)$/)

    if (moduleMatch) {
      // Handle module-based prompts from article_module_prompts table
      const moduleId = moduleMatch[1]
      const promptCategory = moduleMatch[2] // 'title' or 'body'
      const modulePromptType = promptCategory === 'title' ? 'article_title' : 'article_body'

      const { data: modulePrompt, error: moduleError } = await supabaseAdmin
        .from('article_module_prompts')
        .select('ai_prompt, ai_model, ai_provider')
        .eq('article_module_id', moduleId)
        .eq('prompt_type', modulePromptType)
        .maybeSingle()

      if (moduleError) {
        logger.error({ err: moduleError }, 'Error loading module prompt')
        return NextResponse.json(
          { error: 'Failed to load module prompt', details: moduleError.message },
          { status: 500 }
        )
      }

      if (!modulePrompt) {
        return NextResponse.json({
          success: true,
          data: null,
          message: 'No prompt found for this module'
        })
      }

      const promptProvider = modulePrompt.ai_provider || 'openai'
      const providerMatches = promptProvider === provider

      return NextResponse.json({
        success: true,
        data: {
          key: `module_${moduleId}_${promptCategory}`,
          prompt: modulePrompt.ai_prompt,
          ai_provider: promptProvider,
          ai_model: modulePrompt.ai_model,
          provider_matches: providerMatches
        }
      })
    }

    // Map legacy playground prompt types to database keys
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

    // Get the first active newsletter for publication_id if not provided
    let newsletterId = publication_id
    if (!newsletterId || newsletterId === 'undefined') {
      const { data: newsletter } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (newsletter) {
        newsletterId = newsletter.id
      }
    }

    // Fetch live prompt from publication_settings
    const { data, error } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value, ai_provider, description, expected_outputs')
      .eq('publication_id', newsletterId)
      .eq('key', promptKey)
      .maybeSingle()

    if (error) {
      logger.error({ err: error }, 'Error loading live prompt')
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
  }
)
