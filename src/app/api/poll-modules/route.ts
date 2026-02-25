import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * GET /api/poll-modules - List poll modules for a publication
 * Query params: publication_id (required)
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'poll-modules' },
  async ({ request }) => {
    const publicationId = request.nextUrl.searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    const { data: modules, error } = await supabaseAdmin
      .from('poll_modules')
      .select('*')
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
 * POST /api/poll-modules - Create new poll module
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'poll-modules' },
  async ({ request }) => {
    const body = await request.json()

    // Validate required fields
    if (!body.publication_id || !body.name) {
      return NextResponse.json(
        { error: 'publication_id and name are required' },
        { status: 400 }
      )
    }

    // Get highest display_order for this publication
    const { data: existing } = await supabaseAdmin
      .from('poll_modules')
      .select('display_order')
      .eq('publication_id', body.publication_id)
      .order('display_order', { ascending: false })
      .limit(1)

    const nextOrder = (existing?.[0]?.display_order ?? -1) + 1

    const { data: module, error } = await supabaseAdmin
      .from('poll_modules')
      .insert({
        publication_id: body.publication_id,
        name: body.name,
        display_order: body.display_order ?? nextOrder,
        is_active: body.is_active ?? true,
        block_order: body.block_order ?? ['title', 'question', 'image', 'options'],
        config: body.config ?? {}
      })
      .select()
      .single()

    if (error) throw error

    console.log(`[PollModules] Created module: ${module.name} (${module.id})`)

    return NextResponse.json({
      success: true,
      module
    }, { status: 201 })
  }
)

/**
 * PATCH /api/poll-modules - Reorder modules (bulk update display_order)
 * Body: { modules: [{ id, display_order }] }
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'poll-modules' },
  async ({ request }) => {
    const body = await request.json()

    if (!body.modules || !Array.isArray(body.modules)) {
      return NextResponse.json(
        { error: 'modules array is required' },
        { status: 400 }
      )
    }

    // Update each module's display_order
    for (const item of body.modules) {
      if (!item.id || typeof item.display_order !== 'number') continue

      const { error } = await supabaseAdmin
        .from('poll_modules')
        .update({
          display_order: item.display_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)

      if (error) {
        console.error(`[PollModules] Failed to update order for ${item.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Module order updated'
    })
  }
)
