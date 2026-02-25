import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * GET /api/article-modules/[id]/prompts - List prompts for a module
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'article-modules/[id]/prompts' },
  async ({ params }) => {
    const moduleId = params.id

    const { data: prompts, error } = await supabaseAdmin
      .from('article_module_prompts')
      .select('*')
      .eq('article_module_id', moduleId)
      .order('prompt_type', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      prompts: prompts || []
    })
  }
)

/**
 * POST /api/article-modules/[id]/prompts - Create a new prompt
 * Prompt types: article_title, article_body
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'article-modules/[id]/prompts' },
  async ({ params, request }) => {
    const moduleId = params.id
    const body = await request.json()

    // Validate required fields
    if (!body.prompt_type || !body.ai_prompt) {
      return NextResponse.json(
        { error: 'prompt_type and ai_prompt are required' },
        { status: 400 }
      )
    }

    const validTypes = ['article_title', 'article_body']
    if (!validTypes.includes(body.prompt_type)) {
      return NextResponse.json(
        { error: `prompt_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if prompt type already exists
    const { data: existing } = await supabaseAdmin
      .from('article_module_prompts')
      .select('id')
      .eq('article_module_id', moduleId)
      .eq('prompt_type', body.prompt_type)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: `Prompt type '${body.prompt_type}' already exists for this module. Use PATCH to update.` },
        { status: 409 }
      )
    }

    // Create the prompt
    const { data: prompt, error } = await supabaseAdmin
      .from('article_module_prompts')
      .insert({
        article_module_id: moduleId,
        prompt_type: body.prompt_type,
        ai_prompt: body.ai_prompt,
        ai_model: body.ai_model ?? 'gpt-4o',
        ai_provider: body.ai_provider ?? 'openai',
        temperature: body.temperature ?? null,
        max_tokens: body.max_tokens ?? null,
        expected_output: body.expected_output ?? null
      })
      .select()
      .single()

    if (error) throw error

    console.log(`[ArticleModulePrompts] Created prompt: ${prompt.prompt_type} for module ${moduleId}`)

    return NextResponse.json({
      success: true,
      prompt
    }, { status: 201 })
  }
)

/**
 * PATCH /api/article-modules/[id]/prompts - Update a prompt
 * Body: { prompt_id or prompt_type, ...updates }
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'article-modules/[id]/prompts' },
  async ({ params, request }) => {
    const moduleId = params.id
    const body = await request.json()

    // Must have either prompt_id or prompt_type to identify the prompt
    if (!body.prompt_id && !body.prompt_type) {
      return NextResponse.json(
        { error: 'prompt_id or prompt_type is required' },
        { status: 400 }
      )
    }

    const updates: Record<string, any> = {}
    if (body.ai_prompt !== undefined) updates.ai_prompt = body.ai_prompt
    if (body.ai_model !== undefined) updates.ai_model = body.ai_model
    if (body.ai_provider !== undefined) updates.ai_provider = body.ai_provider
    if (body.temperature !== undefined) updates.temperature = body.temperature
    if (body.max_tokens !== undefined) updates.max_tokens = body.max_tokens
    if (body.expected_output !== undefined) updates.expected_output = body.expected_output

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    updates.updated_at = new Date().toISOString()

    // Build query based on identifier provided
    let query = supabaseAdmin
      .from('article_module_prompts')
      .update(updates)
      .eq('article_module_id', moduleId)

    if (body.prompt_id) {
      query = query.eq('id', body.prompt_id)
    } else {
      query = query.eq('prompt_type', body.prompt_type)
    }

    const { data: prompt, error } = await query.select().single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Prompt not found' },
          { status: 404 }
        )
      }
      throw error
    }

    console.log(`[ArticleModulePrompts] Updated prompt: ${prompt.prompt_type}`)

    return NextResponse.json({
      success: true,
      prompt
    })
  }
)
