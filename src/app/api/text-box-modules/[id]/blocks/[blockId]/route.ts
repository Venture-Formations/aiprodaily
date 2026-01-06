import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface RouteContext {
  params: Promise<{ id: string; blockId: string }>
}

/**
 * GET /api/text-box-modules/[id]/blocks/[blockId] - Get a single block
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: moduleId, blockId } = await context.params

    const { data: block, error } = await supabaseAdmin
      .from('text_box_blocks')
      .select('*')
      .eq('id', blockId)
      .eq('text_box_module_id', moduleId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Block not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      block
    })

  } catch (error: any) {
    console.error('[TextBoxBlocks] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch block', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/text-box-modules/[id]/blocks/[blockId] - Update a block
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: moduleId, blockId } = await context.params
    const body = await request.json()

    // Build update object
    const updates: Record<string, any> = {}

    // Common fields
    if (body.displayOrder !== undefined) updates.display_order = body.displayOrder
    if (body.isActive !== undefined) updates.is_active = body.isActive

    // Static text fields
    if (body.staticContent !== undefined) updates.static_content = body.staticContent
    if (body.textSize !== undefined) updates.text_size = body.textSize

    // AI prompt fields
    if (body.aiPromptJson !== undefined) updates.ai_prompt_json = body.aiPromptJson
    if (body.generationTiming !== undefined) updates.generation_timing = body.generationTiming

    // Image fields
    if (body.imageType !== undefined) updates.image_type = body.imageType
    if (body.staticImageUrl !== undefined) updates.static_image_url = body.staticImageUrl
    if (body.aiImagePrompt !== undefined) updates.ai_image_prompt = body.aiImagePrompt

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    updates.updated_at = new Date().toISOString()

    const { data: block, error } = await supabaseAdmin
      .from('text_box_blocks')
      .update(updates)
      .eq('id', blockId)
      .eq('text_box_module_id', moduleId) // Security: ensure block belongs to module
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Block not found' },
          { status: 404 }
        )
      }
      throw error
    }

    console.log(`[TextBoxBlocks] Updated block ${blockId}`)

    return NextResponse.json({
      success: true,
      block
    })

  } catch (error: any) {
    console.error('[TextBoxBlocks] Failed to update:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update block', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/text-box-modules/[id]/blocks/[blockId] - Delete a block
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: moduleId, blockId } = await context.params

    // Verify block exists and belongs to module
    const { data: block } = await supabaseAdmin
      .from('text_box_blocks')
      .select('id, block_type')
      .eq('id', blockId)
      .eq('text_box_module_id', moduleId)
      .single()

    if (!block) {
      return NextResponse.json(
        { error: 'Block not found' },
        { status: 404 }
      )
    }

    // Delete the block
    const { error } = await supabaseAdmin
      .from('text_box_blocks')
      .delete()
      .eq('id', blockId)

    if (error) throw error

    console.log(`[TextBoxBlocks] Deleted block ${blockId} from module ${moduleId}`)

    return NextResponse.json({
      success: true,
      message: 'Block deleted'
    })

  } catch (error: any) {
    console.error('[TextBoxBlocks] Failed to delete:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete block', details: error.message },
      { status: 500 }
    )
  }
}
