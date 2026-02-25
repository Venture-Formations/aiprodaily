import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * GET /api/text-box-modules/[id] - Get a single text box module with blocks
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules/[id]' },
  async ({ params }) => {
    const id = params.id

    const { data: module, error } = await supabaseAdmin
      .from('text_box_modules')
      .select(`
        *,
        blocks:text_box_blocks(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Text box module not found' },
          { status: 404 }
        )
      }
      throw error
    }

    // Sort blocks by display_order
    const sortedModule = {
      ...module,
      blocks: (module.blocks || []).sort((a: any, b: any) =>
        a.display_order - b.display_order
      )
    }

    return NextResponse.json({
      success: true,
      module: sortedModule
    })
  }
)

/**
 * PATCH /api/text-box-modules/[id] - Update a text box module
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules/[id]' },
  async ({ params, request }) => {
    const id = params.id
    const body = await request.json()

    // Build update object with only allowed fields
    const updates: Record<string, any> = {}
    const allowedFields = ['name', 'display_order', 'is_active', 'show_name', 'config']

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    updates.updated_at = new Date().toISOString()

    const { data: module, error } = await supabaseAdmin
      .from('text_box_modules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Text box module not found' },
          { status: 404 }
        )
      }
      throw error
    }

    console.log(`[TextBoxModules] Updated module: ${module.name} (${module.id})`)

    return NextResponse.json({
      success: true,
      module
    })
  }
)

/**
 * DELETE /api/text-box-modules/[id] - Delete a text box module
 * Also deletes associated blocks (via CASCADE)
 */
export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules/[id]' },
  async ({ params }) => {
    const id = params.id

    // Get module info for logging
    const { data: module } = await supabaseAdmin
      .from('text_box_modules')
      .select('name, publication_id')
      .eq('id', id)
      .single()

    if (!module) {
      return NextResponse.json(
        { error: 'Text box module not found' },
        { status: 404 }
      )
    }

    // Delete the module (blocks deleted via CASCADE)
    const { error } = await supabaseAdmin
      .from('text_box_modules')
      .delete()
      .eq('id', id)

    if (error) throw error

    console.log(`[TextBoxModules] Deleted module: ${module.name} (${id})`)

    return NextResponse.json({
      success: true,
      message: 'Text box module deleted'
    })
  }
)
