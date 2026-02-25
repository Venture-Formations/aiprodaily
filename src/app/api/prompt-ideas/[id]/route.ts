import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/prompt-ideas/[id] - Get specific prompt idea
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'prompt-ideas/[id]' },
  async ({ params, logger }) => {
    const id = params.id

    const { data: prompt, error } = await supabaseAdmin
      .from('prompt_ideas')
      .select('*')
      .eq('id', id)
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
  async ({ params, request, logger }) => {
    const id = params.id
    const body = await request.json()

    const { data: prompt, error } = await supabaseAdmin
      .from('prompt_ideas')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

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
  async ({ params, logger }) => {
    const id = params.id

    const { error } = await supabaseAdmin
      .from('prompt_ideas')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Prompt idea deleted successfully'
    })
  }
)
