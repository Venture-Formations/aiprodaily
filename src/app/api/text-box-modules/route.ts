import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * GET /api/text-box-modules - List text box modules for a publication
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publicationId') || searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publicationId is required' },
        { status: 400 }
      )
    }

    const { data: modules, error } = await supabaseAdmin
      .from('text_box_modules')
      .select(`
        *,
        blocks:text_box_blocks(*)
      `)
      .eq('publication_id', publicationId)
      .order('display_order', { ascending: true })

    if (error) throw error

    // Sort blocks by display_order within each module
    const sortedModules = (modules || []).map(module => ({
      ...module,
      blocks: (module.blocks || []).sort((a: any, b: any) =>
        a.display_order - b.display_order
      )
    }))

    return NextResponse.json({
      success: true,
      modules: sortedModules
    })
  }
)

/**
 * POST /api/text-box-modules - Create a new text box module
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules' },
  async ({ request }) => {
    const body = await request.json()
    const { name, showName, displayOrder, isActive, config } = body
    // Accept both camelCase and snake_case for publication ID
    const publicationId = body.publicationId || body.publication_id

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publicationId is required' },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    // Get next display_order if not provided
    let order = displayOrder
    if (order === undefined) {
      const { data: existing } = await supabaseAdmin
        .from('text_box_modules')
        .select('display_order')
        .eq('publication_id', publicationId)
        .order('display_order', { ascending: false })
        .limit(1)

      order = existing && existing.length > 0 ? (existing[0].display_order || 0) + 1 : 0
    }

    const { data: module, error } = await supabaseAdmin
      .from('text_box_modules')
      .insert({
        publication_id: publicationId,
        name,
        show_name: showName !== false, // Default to true
        display_order: order,
        is_active: isActive !== false, // Default to true
        config: config || {}
      })
      .select()
      .single()

    if (error) throw error

    console.log(`[TextBoxModules] Created module: ${module.name} (${module.id})`)

    return NextResponse.json({
      success: true,
      module
    })
  }
)

/**
 * PATCH /api/text-box-modules - Bulk update display_order for multiple modules
 * Body: { modules: [{ id: string, display_order: number }] }
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules' },
  async ({ request }) => {
    const body = await request.json()
    const { modules } = body

    console.log('[TextBoxModules] PATCH called with:', JSON.stringify(modules))

    if (!modules || !Array.isArray(modules)) {
      return NextResponse.json(
        { error: 'modules array is required' },
        { status: 400 }
      )
    }

    // Update each module's display_order
    for (const m of modules as { id: string; display_order: number }[]) {
      console.log(`[TextBoxModules] Updating module ${m.id} to display_order ${m.display_order}`)
      const { error } = await supabaseAdmin
        .from('text_box_modules')
        .update({ display_order: m.display_order, updated_at: new Date().toISOString() })
        .eq('id', m.id)

      if (error) {
        console.error(`[TextBoxModules] Failed to update order for ${m.id}:`, error)
        throw error
      }
    }

    console.log(`[TextBoxModules] Successfully updated display_order for ${modules.length} modules`)

    return NextResponse.json({
      success: true,
      updated: modules.length
    })
  }
)
