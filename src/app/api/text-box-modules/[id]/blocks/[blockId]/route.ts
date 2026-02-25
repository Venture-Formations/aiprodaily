import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * GET /api/text-box-modules/[id]/blocks/[blockId] - Get a single block
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules/[id]/blocks/[blockId]' },
  async ({ params }) => {
    const moduleId = params.id
    const blockId = params.blockId

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
  }
)

/**
 * PATCH /api/text-box-modules/[id]/blocks/[blockId] - Update a block
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules/[id]/blocks/[blockId]' },
  async ({ params, request }) => {
    const moduleId = params.id
    const blockId = params.blockId
    const body = await request.json()

    // Build update object - accept both camelCase and snake_case
    const updates: Record<string, any> = {}

    // Common fields
    const displayOrder = body.displayOrder ?? body.display_order
    const isActive = body.isActive ?? body.is_active
    if (displayOrder !== undefined) updates.display_order = displayOrder
    if (isActive !== undefined) updates.is_active = isActive

    // Static text fields
    const staticContent = body.staticContent ?? body.static_content
    const textSize = body.textSize ?? body.text_size
    if (staticContent !== undefined) updates.static_content = staticContent
    if (textSize !== undefined) updates.text_size = textSize

    // AI prompt fields
    const aiPromptJson = body.aiPromptJson ?? body.ai_prompt_json
    const generationTiming = body.generationTiming ?? body.generation_timing
    const isBold = body.isBold ?? body.is_bold
    const isItalic = body.isItalic ?? body.is_italic
    if (aiPromptJson !== undefined) updates.ai_prompt_json = aiPromptJson
    if (generationTiming !== undefined) updates.generation_timing = generationTiming
    if (isBold !== undefined) updates.is_bold = isBold
    if (isItalic !== undefined) updates.is_italic = isItalic

    // Image fields
    const imageType = body.imageType ?? body.image_type
    const staticImageUrl = body.staticImageUrl ?? body.static_image_url
    const aiImagePrompt = body.aiImagePrompt ?? body.ai_image_prompt
    if (imageType !== undefined) updates.image_type = imageType
    if (staticImageUrl !== undefined) updates.static_image_url = staticImageUrl
    if (aiImagePrompt !== undefined) updates.ai_image_prompt = aiImagePrompt

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
  }
)

/**
 * DELETE /api/text-box-modules/[id]/blocks/[blockId] - Delete a block
 */
export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules/[id]/blocks/[blockId]' },
  async ({ params }) => {
    const moduleId = params.id
    const blockId = params.blockId

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
  }
)
