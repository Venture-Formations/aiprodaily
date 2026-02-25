import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * GET /api/text-box-modules/[id]/blocks - Get all blocks for a module
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules/[id]/blocks' },
  async ({ params }) => {
    const id = params.id

    const { data: blocks, error } = await supabaseAdmin
      .from('text_box_blocks')
      .select('*')
      .eq('text_box_module_id', id)
      .order('display_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      blocks: blocks || []
    })
  }
)

/**
 * POST /api/text-box-modules/[id]/blocks - Create a new block
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules/[id]/blocks' },
  async ({ params, request }) => {
    const moduleId = params.id
    const body = await request.json()

    // Accept both camelCase and snake_case parameter names
    const blockType = body.blockType || body.block_type
    const displayOrder = body.displayOrder ?? body.display_order
    const isActive = body.isActive ?? body.is_active
    // Static text fields
    const staticContent = body.staticContent || body.static_content
    const textSize = body.textSize || body.text_size
    // AI prompt fields
    const aiPromptJson = body.aiPromptJson || body.ai_prompt_json
    const generationTiming = body.generationTiming || body.generation_timing
    // Image fields
    const imageType = body.imageType || body.image_type
    const staticImageUrl = body.staticImageUrl || body.static_image_url
    const aiImagePrompt = body.aiImagePrompt || body.ai_image_prompt

    if (!blockType) {
      return NextResponse.json(
        { error: 'blockType is required' },
        { status: 400 }
      )
    }

    // Validate block type
    if (!['static_text', 'ai_prompt', 'image'].includes(blockType)) {
      return NextResponse.json(
        { error: 'Invalid blockType. Must be static_text, ai_prompt, or image' },
        { status: 400 }
      )
    }

    // Get next display_order if not provided
    let order = displayOrder
    if (order === undefined) {
      const { data: existing } = await supabaseAdmin
        .from('text_box_blocks')
        .select('display_order')
        .eq('text_box_module_id', moduleId)
        .order('display_order', { ascending: false })
        .limit(1)

      order = existing && existing.length > 0 ? (existing[0].display_order || 0) + 1 : 0
    }

    const blockData: Record<string, any> = {
      text_box_module_id: moduleId,
      block_type: blockType,
      display_order: order,
      is_active: isActive !== false
    }

    // Add type-specific fields
    if (blockType === 'static_text') {
      blockData.static_content = staticContent || null
      blockData.text_size = textSize || 'medium'
    } else if (blockType === 'ai_prompt') {
      blockData.ai_prompt_json = aiPromptJson || null
      blockData.generation_timing = generationTiming || 'after_articles'
    } else if (blockType === 'image') {
      blockData.image_type = imageType || 'static'
      blockData.static_image_url = staticImageUrl || null
      blockData.ai_image_prompt = aiImagePrompt || null
    }

    const { data: block, error } = await supabaseAdmin
      .from('text_box_blocks')
      .insert(blockData)
      .select()
      .single()

    if (error) throw error

    console.log(`[TextBoxBlocks] Created ${blockType} block for module ${moduleId}`)

    return NextResponse.json({
      success: true,
      block
    })
  }
)

/**
 * PATCH /api/text-box-modules/[id]/blocks - Reorder blocks
 * Body: { order: [{ id: string, display_order: number }] }
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules/[id]/blocks' },
  async ({ params, request }) => {
    const moduleId = params.id
    const body = await request.json()
    const { order } = body

    if (!order || !Array.isArray(order)) {
      return NextResponse.json(
        { error: 'order array is required' },
        { status: 400 }
      )
    }

    // Update each block's display_order
    for (const item of order) {
      if (!item.id || item.display_order === undefined) continue

      await supabaseAdmin
        .from('text_box_blocks')
        .update({
          display_order: item.display_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)
        .eq('text_box_module_id', moduleId) // Security: ensure block belongs to module
    }

    // Get updated blocks
    const { data: blocks } = await supabaseAdmin
      .from('text_box_blocks')
      .select('*')
      .eq('text_box_module_id', moduleId)
      .order('display_order', { ascending: true })

    console.log(`[TextBoxBlocks] Reordered ${order.length} blocks for module ${moduleId}`)

    return NextResponse.json({
      success: true,
      blocks: blocks || []
    })
  }
)
