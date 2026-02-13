import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = Promise<{ id: string }>

/**
 * PATCH /api/sparkloop-rec-modules/[id] - Update sparkloop rec module
 */
export async function PATCH(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params
    const body = await request.json()

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (body.name !== undefined) updates.name = body.name
    if (body.display_order !== undefined) updates.display_order = body.display_order
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.selection_mode !== undefined) updates.selection_mode = body.selection_mode
    if (body.block_order !== undefined) updates.block_order = body.block_order
    if (body.config !== undefined) updates.config = body.config
    if (body.recs_count !== undefined) updates.recs_count = Math.max(1, body.recs_count)
    if (body.next_position !== undefined) updates.next_position = Math.max(1, body.next_position)

    const { data: module, error } = await supabaseAdmin
      .from('sparkloop_rec_modules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    console.log(`[SparkLoopRecModules] Updated module: ${module.name} (${module.id})`)

    return NextResponse.json({
      success: true,
      module
    })
  } catch (error: any) {
    console.error('[SparkLoopRecModules] Failed to update:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update sparkloop rec module', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sparkloop-rec-modules/[id] - Delete sparkloop rec module
 */
export async function DELETE(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params

    const { data: module } = await supabaseAdmin
      .from('sparkloop_rec_modules')
      .select('name')
      .eq('id', id)
      .single()

    const { error } = await supabaseAdmin
      .from('sparkloop_rec_modules')
      .delete()
      .eq('id', id)

    if (error) throw error

    console.log(`[SparkLoopRecModules] Deleted module: ${module?.name} (${id})`)

    return NextResponse.json({
      success: true,
      message: 'SparkLoop rec module deleted successfully'
    })
  } catch (error: any) {
    console.error('[SparkLoopRecModules] Failed to delete:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete sparkloop rec module', details: error.message },
      { status: 500 }
    )
  }
}
