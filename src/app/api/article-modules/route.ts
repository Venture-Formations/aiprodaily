import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Default prompts for new article modules
const DEFAULT_CRITERIA_PROMPTS = [
  { name: 'Relevance', weight: 0.25 },
  { name: 'Timeliness', weight: 0.20 },
  { name: 'Quality', weight: 0.20 },
  { name: 'Engagement', weight: 0.20 },
  { name: 'Uniqueness', weight: 0.15 }
]

const DEFAULT_TITLE_PROMPT = JSON.stringify({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: 'You are a professional newsletter editor. Generate a compelling, concise headline for the following article that captures the key point and encourages readers to continue reading.'
    },
    {
      role: 'user',
      content: 'Title: {{title}}\nDescription: {{description}}\nContent: {{content}}'
    }
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'headline_response',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          headline: { type: 'string' }
        },
        required: ['headline'],
        additionalProperties: false
      }
    }
  }
})

const DEFAULT_BODY_PROMPT = JSON.stringify({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: 'You are a professional newsletter writer. Write a concise, engaging summary of the article below. Focus on the key points and make it informative yet brief (100-150 words).'
    },
    {
      role: 'user',
      content: 'Headline: {{headline}}\nOriginal Title: {{title}}\nDescription: {{description}}\nContent: {{content}}'
    }
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'body_response',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          word_count: { type: 'integer' }
        },
        required: ['content', 'word_count'],
        additionalProperties: false
      }
    }
  }
})

/**
 * GET /api/article-modules - List article modules for a publication
 * Query params: publication_id (required)
 */
export async function GET(request: NextRequest) {
  try {
    const publicationId = request.nextUrl.searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    const { data: modules, error } = await supabaseAdmin
      .from('article_modules')
      .select(`
        *,
        criteria:article_module_criteria(*),
        prompts:article_module_prompts(*)
      `)
      .eq('publication_id', publicationId)
      .order('display_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      modules: modules || []
    })

  } catch (error: any) {
    console.error('[ArticleModules] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch article modules', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/article-modules - Create new article module
 * Creates module with default criteria and prompts from template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.publication_id || !body.name) {
      return NextResponse.json(
        { error: 'publication_id and name are required' },
        { status: 400 }
      )
    }

    // Get highest display_order for this publication
    const { data: existing } = await supabaseAdmin
      .from('article_modules')
      .select('display_order')
      .eq('publication_id', body.publication_id)
      .order('display_order', { ascending: false })
      .limit(1)

    const nextOrder = (existing?.[0]?.display_order ?? -1) + 1

    // Create the module
    const { data: module, error } = await supabaseAdmin
      .from('article_modules')
      .insert({
        publication_id: body.publication_id,
        name: body.name,
        display_order: body.display_order ?? nextOrder,
        is_active: body.is_active ?? true,
        selection_mode: body.selection_mode ?? 'top_score',
        block_order: body.block_order ?? ['source_image', 'title', 'body'],
        config: body.config ?? {},
        articles_count: body.articles_count ?? 3,
        lookback_hours: body.lookback_hours ?? 72,
        ai_image_prompt: body.ai_image_prompt ?? null
      })
      .select()
      .single()

    if (error) throw error

    // Create default criteria
    for (let i = 0; i < DEFAULT_CRITERIA_PROMPTS.length; i++) {
      const criteria = DEFAULT_CRITERIA_PROMPTS[i]
      await supabaseAdmin
        .from('article_module_criteria')
        .insert({
          article_module_id: module.id,
          criteria_number: i + 1,
          name: criteria.name,
          weight: criteria.weight,
          is_active: i < 4 // First 4 active by default
        })
    }

    // Create default title prompt
    await supabaseAdmin
      .from('article_module_prompts')
      .insert({
        article_module_id: module.id,
        prompt_type: 'article_title',
        ai_prompt: DEFAULT_TITLE_PROMPT,
        ai_model: 'gpt-4o',
        ai_provider: 'openai'
      })

    // Create default body prompt
    await supabaseAdmin
      .from('article_module_prompts')
      .insert({
        article_module_id: module.id,
        prompt_type: 'article_body',
        ai_prompt: DEFAULT_BODY_PROMPT,
        ai_model: 'gpt-4o',
        ai_provider: 'openai'
      })

    console.log(`[ArticleModules] Created module: ${module.name} (${module.id}) with default criteria and prompts`)

    // Fetch the complete module with criteria and prompts
    const { data: completeModule } = await supabaseAdmin
      .from('article_modules')
      .select(`
        *,
        criteria:article_module_criteria(*),
        prompts:article_module_prompts(*)
      `)
      .eq('id', module.id)
      .single()

    return NextResponse.json({
      success: true,
      module: completeModule
    }, { status: 201 })

  } catch (error: any) {
    console.error('[ArticleModules] Failed to create:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create article module', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/article-modules - Reorder modules (bulk update display_order)
 * Body: { modules: [{ id, display_order }] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.modules || !Array.isArray(body.modules)) {
      return NextResponse.json(
        { error: 'modules array is required' },
        { status: 400 }
      )
    }

    // Update each module's display_order
    for (const item of body.modules) {
      if (!item.id || typeof item.display_order !== 'number') continue

      await supabaseAdmin
        .from('article_modules')
        .update({
          display_order: item.display_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${body.modules.length} modules`
    })

  } catch (error: any) {
    console.error('[ArticleModules] Failed to reorder:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reorder modules', details: error.message },
      { status: 500 }
    )
  }
}
