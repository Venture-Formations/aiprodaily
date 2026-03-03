import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

const PROMPT_COLS = 'id, publication_id, prompt_module_id, title, prompt_text, category, use_case, suggested_model, difficulty_level, is_featured, is_active, display_order, priority, times_used, created_at, updated_at'

// GET - List all prompt ideas
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'prompt-ideas' },
  async ({ request, logger }) => {
    const publicationId = new URL(request.url).searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 })
    }

    const { data: prompts, error } = await supabaseAdmin
      .from('prompt_ideas')
      .select(PROMPT_COLS)
      .eq('publication_id', publicationId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error({ err: error }, 'Error fetching prompt ideas')
      return NextResponse.json({ error: 'Failed to fetch prompt ideas' }, { status: 500 })
    }

    return NextResponse.json({ prompts: prompts || [] })
  }
)

// POST - Create new prompt idea
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'prompt-ideas' },
  async ({ request, logger }) => {
    const body = await request.json()
    const { publication_id } = body

    if (!publication_id) {
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 })
    }

    const { data: prompt, error } = await supabaseAdmin
      .from('prompt_ideas')
      .insert({
        publication_id,
        title: body.title,
        prompt_text: body.prompt_text,
        category: body.category || null,
        use_case: body.use_case || null,
        suggested_model: body.suggested_model || null,
        difficulty_level: body.difficulty_level || null,
        is_featured: body.is_featured || false,
        is_active: body.is_active !== undefined ? body.is_active : true,
        display_order: body.display_order || null,
        times_used: 0
      })
      .select()
      .single()

    if (error) {
      logger.error({ err: error }, 'Error creating prompt idea')
      return NextResponse.json({ error: 'Failed to create prompt idea' }, { status: 500 })
    }

    return NextResponse.json({ prompt }, { status: 201 })
  }
)
