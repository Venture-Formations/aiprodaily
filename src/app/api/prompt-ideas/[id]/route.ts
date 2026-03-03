import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/prompt-ideas/[id] - Get specific prompt idea
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'prompt-ideas/[id]' },
  async ({ request, params }) => {
    const id = params.id
    const publicationId = new URL(request.url).searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json({ success: false, error: 'publication_id is required' }, { status: 400 })
    }

    const { data: prompt, error } = await supabaseAdmin
      .from('prompt_ideas')
      .select('id, publication_id, prompt_module_id, title, prompt_text, category, use_case, suggested_model, difficulty_level, is_featured, is_active, display_order, priority, times_used, created_at, updated_at')
      .eq('id', id)
      .eq('publication_id', publicationId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Prompt idea not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      prompt
    })
  }
)

/**
 * PATCH /api/prompt-ideas/[id] - Update prompt idea
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'prompt-ideas/[id]' },
  async ({ params, request }) => {
    const id = params.id
    const body = await request.json()
    const { publication_id, ...updateFields } = body

    if (!publication_id) {
      return NextResponse.json({ success: false, error: 'publication_id is required' }, { status: 400 })
    }

    const { data: prompt, error } = await supabaseAdmin
      .from('prompt_ideas')
      .update({
        ...updateFields,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('publication_id', publication_id)
      .select().single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      prompt
    })
  }
)

/**
 * DELETE /api/prompt-ideas/[id] - Delete prompt idea
 */
export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'prompt-ideas/[id]' },
  async ({ request, params }) => {
    const id = params.id
    const publicationId = new URL(request.url).searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json({ success: false, error: 'publication_id is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('prompt_ideas')
      .delete()
      .eq('id', id)
      .eq('publication_id', publicationId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Prompt idea deleted successfully'
    })
  }
)
