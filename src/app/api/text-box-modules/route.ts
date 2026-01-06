import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/text-box-modules - List text box modules for a publication
 */
export async function GET(request: NextRequest) {
  try {
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

  } catch (error: any) {
    console.error('[TextBoxModules] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch text box modules', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/text-box-modules - Create a new text box module
 */
export async function POST(request: NextRequest) {
  try {
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

  } catch (error: any) {
    console.error('[TextBoxModules] Failed to create:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create text box module', details: error.message },
      { status: 500 }
    )
  }
}
