import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = Promise<{ id: string }>

/**
 * GET /api/prompt-modules/[id] - Get specific prompt module
 */
export async function GET(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params

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

  } catch (error: any) {
    console.error('[PromptModules] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch prompt module', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/prompt-modules/[id] - Update prompt module
 */
export async function PATCH(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params
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

  } catch (error: any) {
    console.error('[PromptModules] Failed to update:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update prompt module', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/prompt-modules/[id] - Delete prompt module
 * Note: issue_prompt_modules entries will be deleted via CASCADE
 */
export async function DELETE(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params

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

  } catch (error: any) {
    console.error('[PromptModules] Failed to delete:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete prompt module', details: error.message },
      { status: 500 }
    )
  }
}
