import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = Promise<{ id: string }>

/**
 * GET /api/ai-app-modules/[id] - Get specific AI app module
 */
export async function GET(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params

    const { data: module, error } = await supabaseAdmin
      .from('ai_app_modules')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'AI app module not found' },
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
    console.error('[AIAppModules] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI app module', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/ai-app-modules/[id] - Update AI app module
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
      console.log(`[AIAppModules] Saving block_order:`, body.block_order)
    }
    if (body.config !== undefined) updates.config = body.config
    if (body.apps_count !== undefined) {
      updates.apps_count = Math.max(1, body.apps_count)
    }
    if (body.max_per_category !== undefined) {
      updates.max_per_category = Math.max(1, body.max_per_category)
    }
    if (body.affiliate_cooldown_days !== undefined) {
      updates.affiliate_cooldown_days = Math.max(0, body.affiliate_cooldown_days)
    }
    if (body.next_position !== undefined) {
      updates.next_position = Math.max(1, body.next_position)
    }

    // Layout settings (Product Cards)
    if (body.layout_mode !== undefined) {
      if (['stacked', 'inline'].includes(body.layout_mode)) {
        updates.layout_mode = body.layout_mode
      }
    }
    if (body.logo_style !== undefined) {
      if (['round', 'square'].includes(body.logo_style)) {
        updates.logo_style = body.logo_style
      }
    }
    if (body.title_size !== undefined) {
      if (['small', 'medium', 'large'].includes(body.title_size)) {
        updates.title_size = body.title_size
      }
    }
    if (body.description_size !== undefined) {
      if (['small', 'medium', 'large'].includes(body.description_size)) {
        updates.description_size = body.description_size
      }
    }

    // Block config (per-block settings)
    if (body.block_config !== undefined) {
      updates.block_config = body.block_config
      console.log(`[AIAppModules] Saving block_config:`, JSON.stringify(body.block_config))
    }

    // Directory visibility
    if (body.show_in_directory !== undefined) {
      updates.show_in_directory = Boolean(body.show_in_directory)
    }

    // Display settings
    if (body.show_emoji !== undefined) {
      updates.show_emoji = Boolean(body.show_emoji)
    }
    if (body.show_numbers !== undefined) {
      updates.show_numbers = Boolean(body.show_numbers)
    }

    // Archive settings
    if (body.include_in_archive !== undefined) {
      updates.include_in_archive = Boolean(body.include_in_archive)
    }

    const { data: module, error } = await supabaseAdmin
      .from('ai_app_modules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    console.log(`[AIAppModules] Updated module: ${module.name} (${module.id})`)

    return NextResponse.json({
      success: true,
      module
    })

  } catch (error: any) {
    console.error('[AIAppModules] Failed to update:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update AI app module', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ai-app-modules/[id] - Delete AI app module
 * Note: Apps will be orphaned (ai_app_module_id set to NULL), not deleted
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
      .from('ai_app_modules')
      .select('name')
      .eq('id', id)
      .single()

    // Count apps that will be orphaned
    const { count } = await supabaseAdmin
      .from('ai_applications')
      .select('id', { count: 'exact', head: true })
      .eq('ai_app_module_id', id)

    // Delete the module (CASCADE will handle issue_ai_app_modules)
    // ai_applications will have ai_app_module_id set to NULL (ON DELETE SET NULL)
    const { error } = await supabaseAdmin
      .from('ai_app_modules')
      .delete()
      .eq('id', id)

    if (error) throw error

    console.log(`[AIAppModules] Deleted module: ${module?.name} (${id}), orphaned ${count || 0} apps`)

    return NextResponse.json({
      success: true,
      message: 'AI app module deleted successfully',
      orphaned_apps: count || 0
    })

  } catch (error: any) {
    console.error('[AIAppModules] Failed to delete:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete AI app module', details: error.message },
      { status: 500 }
    )
  }
}
