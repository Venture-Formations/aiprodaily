import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/advertisers - List advertisers
 * Query params: publication_id (required)
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'advertisers' },
  async ({ request }) => {
    const publicationId = request.nextUrl.searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    const { data: advertisers, error } = await supabaseAdmin
      .from('advertisers')
      .select('*')
      .eq('publication_id', publicationId)
      .order('company_name', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      advertisers: advertisers || []
    })
  }
)

/**
 * POST /api/advertisers - Create new advertiser
 */
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'advertisers' },
  async ({ request, logger }) => {
    const body = await request.json()

    // Validate required fields
    if (!body.publication_id || !body.company_name) {
      return NextResponse.json(
        { error: 'publication_id and company_name are required' },
        { status: 400 }
      )
    }

    const { data: advertiser, error } = await supabaseAdmin
      .from('advertisers')
      .insert({
        publication_id: body.publication_id,
        company_name: body.company_name,
        contact_email: body.contact_email || null,
        contact_name: body.contact_name || null,
        logo_url: body.logo_url || null,
        website_url: body.website_url || null,
        notes: body.notes || null,
        is_active: body.is_active ?? true
      })
      .select()
      .single()

    if (error) throw error

    logger.info({ advertiserId: advertiser.id, name: advertiser.company_name }, 'Created advertiser')

    return NextResponse.json({
      success: true,
      advertiser
    }, { status: 201 })
  }
)
