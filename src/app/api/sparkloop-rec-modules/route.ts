import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

export const maxDuration = 30

/**
 * GET /api/sparkloop-rec-modules - List sparkloop rec modules for a publication
 * Query params: publication_id (required)
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'sparkloop-rec-modules' },
  async ({ request }) => {
    const publicationId = request.nextUrl.searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    const { data: modules, error } = await supabaseAdmin
      .from('sparkloop_rec_modules')
      .select('id, publication_id, name, display_order, is_active, selection_mode, block_order, config, recs_count, next_position, created_at, updated_at')
      .eq('publication_id', publicationId)
      .order('display_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      modules: modules || []
    })
  }
)

/**
 * POST /api/sparkloop-rec-modules - Create new sparkloop rec module
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'sparkloop-rec-modules' },
  async ({ request }) => {
    const body = await request.json()

    if (!body.publication_id || !body.name) {
      return NextResponse.json(
        { error: 'publication_id and name are required' },
        { status: 400 }
      )
    }

    // Get highest display_order for this publication
    const { data: existing } = await supabaseAdmin
      .from('sparkloop_rec_modules')
      .select('display_order')
      .eq('publication_id', body.publication_id)
      .order('display_order', { ascending: false })
      .limit(1)

    const nextOrder = (existing?.[0]?.display_order ?? -1) + 1

    const { data: module, error } = await supabaseAdmin
      .from('sparkloop_rec_modules')
      .insert({
        publication_id: body.publication_id,
        name: body.name,
        display_order: body.display_order ?? nextOrder,
        is_active: body.is_active ?? true,
        selection_mode: body.selection_mode ?? 'score_based',
        block_order: body.block_order ?? ['logo', 'name', 'description', 'button'],
        config: body.config ?? {},
        recs_count: body.recs_count ?? 3
      })
      .select()
      .single()

    if (error) throw error

    console.log(`[SparkLoopRecModules] Created module: ${module.name} (${module.id})`)

    return NextResponse.json({
      success: true,
      module
    }, { status: 201 })
  }
)

/**
 * PATCH /api/sparkloop-rec-modules - Reorder modules (bulk update display_order)
 * Body: { modules: [{ id, display_order }] }
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'sparkloop-rec-modules' },
  async ({ request }) => {
    const body = await request.json()

    if (!body.modules || !Array.isArray(body.modules)) {
      return NextResponse.json(
        { error: 'modules array is required' },
        { status: 400 }
      )
    }

    for (const item of body.modules) {
      if (!item.id || typeof item.display_order !== 'number') continue

      const { error } = await supabaseAdmin
        .from('sparkloop_rec_modules')
        .update({
          display_order: item.display_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)

      if (error) {
        console.error(`[SparkLoopRecModules] Failed to update order for ${item.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Module order updated'
    })
  }
)
