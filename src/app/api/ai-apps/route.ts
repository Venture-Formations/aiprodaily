import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

const APP_COLS = 'id, publication_id, app_name, tagline, description, category, app_url, logo_url, logo_alt, screenshot_url, screenshot_alt, tool_type, category_priority, pinned_position, is_active, is_featured, is_paid_placement, is_affiliate, ai_app_module_id, times_used, last_used_date, created_at, updated_at'

/**
 * GET /api/ai-apps - List AI applications
 * Query params:
 *   - publication_id: Required - filter by publication (multi-tenant isolation)
 *   - ids: comma-separated list of app IDs to fetch
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'ai-apps' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')
    const idsParam = searchParams.get('ids')

    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('ai_applications')
      .select(APP_COLS)
      .eq('publication_id', publicationId)

    // Filter by specific IDs if provided
    if (idsParam) {
      const ids = idsParam.split(',').filter(id => id.trim())
      if (ids.length > 0) {
        query = query.in('id', ids)
      }
    }

    const { data: apps, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      apps: apps || []
    })
  }
)

/**
 * POST /api/ai-apps - Create new AI application
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'ai-apps' },
  async ({ request }) => {
    const body = await request.json()
    const { publication_id } = body

    if (!publication_id) {
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 })
    }

    // Validate required fields
    if (!body.app_name || !body.description || !body.app_url) {
      return NextResponse.json(
        { error: 'app_name, description, and app_url are required' },
        { status: 400 }
      )
    }

    const { data: app, error } = await supabaseAdmin
      .from('ai_applications')
      .insert({
        ...body,
        publication_id
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      app
    }, { status: 201 })
  }
)
