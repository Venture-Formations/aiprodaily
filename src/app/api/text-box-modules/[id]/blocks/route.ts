import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/text-box-modules/[id]/blocks - Get all blocks for a module
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

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

  } catch (error: any) {
    console.error('[TextBoxBlocks] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch blocks', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/text-box-modules/[id]/blocks - Create a new block
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: moduleId } = await context.params
    const body = await request.json()
    const {
      blockType,
      displayOrder,
      isActive,
      // Static text fields
      staticContent,
      textSize,
      // AI prompt fields
      aiPromptJson,
      generationTiming,
      // Image fields
      imageType,
      staticImageUrl,
      aiImagePrompt
    } = body

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

  } catch (error: any) {
    console.error('[TextBoxBlocks] Failed to create:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create block', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/text-box-modules/[id]/blocks - Reorder blocks
 * Body: { order: [{ id: string, display_order: number }] }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: moduleId } = await context.params
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

  } catch (error: any) {
    console.error('[TextBoxBlocks] Failed to reorder:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reorder blocks', details: error.message },
      { status: 500 }
    )
  }
}
