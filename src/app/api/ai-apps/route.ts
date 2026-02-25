import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/ai-apps - List AI applications
 * Query params:
 *   - ids: comma-separated list of app IDs to fetch
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'ai-apps' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')

    let query = supabaseAdmin
      .from('ai_applications')
      .select('*')

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

    // Get the accounting newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json(
        { error: 'Newsletter not found' },
        { status: 404 }
      )
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
        publication_id: newsletter.id,
        ...body
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      app
    }, { status: 201 })
  }
)
