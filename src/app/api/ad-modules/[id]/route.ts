import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = Promise<{ id: string }>

/**
 * GET /api/ad-modules/[id] - Get specific ad module
 */
export async function GET(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params

    const { data: module, error } = await supabaseAdmin
      .from('ad_modules')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Ad module not found' },
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
    console.error('[AdModules] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ad module', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/ad-modules/[id] - Update ad module
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
      console.log(`[AdModules] Saving block_order:`, body.block_order)
    }
    if (body.config !== undefined) updates.config = body.config
    if (body.next_position !== undefined) {
      updates.next_position = Math.max(1, body.next_position) // Ensure at least 1
      console.log(`[AdModules] Setting next_position:`, body.next_position)
    }

    const { data: module, error } = await supabaseAdmin
      .from('ad_modules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    console.log(`[AdModules] Updated module: ${module.name} (${module.id})`)

    return NextResponse.json({
      success: true,
      module
    })

  } catch (error: any) {
    console.error('[AdModules] Failed to update:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update ad module', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ad-modules/[id] - Delete ad module
 * Note: Ads will be orphaned (ad_module_id set to NULL), not deleted
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
      .from('ad_modules')
      .select('name')
      .eq('id', id)
      .single()

    // Count ads that will be orphaned
    const { count } = await supabaseAdmin
      .from('advertisements')
      .select('id', { count: 'exact', head: true })
      .eq('ad_module_id', id)

    // Delete the module (CASCADE will handle issue_module_ads)
    // advertisements will have ad_module_id set to NULL (ON DELETE SET NULL)
    const { error } = await supabaseAdmin
      .from('ad_modules')
      .delete()
      .eq('id', id)

    if (error) throw error

    console.log(`[AdModules] Deleted module: ${module?.name} (${id}), orphaned ${count || 0} ads`)

    return NextResponse.json({
      success: true,
      message: 'Ad module deleted successfully',
      orphaned_ads: count || 0
    })

  } catch (error: any) {
    console.error('[AdModules] Failed to delete:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete ad module', details: error.message },
      { status: 500 }
    )
  }
}
