import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * GET /api/prompt-modules/[id] - Get specific prompt module
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'prompt-modules/[id]' },
  async ({ params }) => {
    const id = params.id

    const { data: module, error } = await supabaseAdmin
      .from('prompt_modules')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Prompt module not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      module
    })
  }
)

/**
 * PATCH /api/prompt-modules/[id] - Update prompt module
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'prompt-modules/[id]' },
  async ({ params, request }) => {
    const id = params.id
    const body = await request.json()

    // Build update object, only including provided fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (body.name !== undefined) updates.name = body.name
    if (body.display_order !== undefined) updates.display_order = body.display_order
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.selection_mode !== undefined) updates.selection_mode = body.selection_mode
    if (body.block_order !== undefined) {
      updates.block_order = body.block_order
      console.log(`[PromptModules] Saving block_order:`, body.block_order)
    }
    if (body.config !== undefined) updates.config = body.config
    if (body.next_position !== undefined) updates.next_position = body.next_position

    const { data: module, error } = await supabaseAdmin
      .from('prompt_modules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    console.log(`[PromptModules] Updated module: ${module.name} (${module.id})`)

    return NextResponse.json({
      success: true,
      module
    })
  }
)

/**
 * DELETE /api/prompt-modules/[id] - Delete prompt module
 * Note: issue_prompt_modules entries will be deleted via CASCADE
 */
export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'prompt-modules/[id]' },
  async ({ params }) => {
    const id = params.id

    // First, get module info for logging
    const { data: module } = await supabaseAdmin
      .from('prompt_modules')
      .select('name')
      .eq('id', id)
      .single()

    // Delete the module (CASCADE will handle issue_prompt_modules)
    const { error } = await supabaseAdmin
      .from('prompt_modules')
      .delete()
      .eq('id', id)

    if (error) throw error

    console.log(`[PromptModules] Deleted module: ${module?.name} (${id})`)

    return NextResponse.json({
      success: true,
      message: 'Prompt module deleted successfully'
    })
  }
)
