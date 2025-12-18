import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/advertisers - List advertisers
 * Query params: publication_id (required)
 */
export async function GET(request: NextRequest) {
  try {
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

  } catch (error: any) {
    console.error('[Advertisers] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch advertisers', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/advertisers - Create new advertiser
 */
export async function POST(request: NextRequest) {
  try {
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

    console.log(`[Advertisers] Created: ${advertiser.company_name} (${advertiser.id})`)

    return NextResponse.json({
      success: true,
      advertiser
    }, { status: 201 })

  } catch (error: any) {
    console.error('[Advertisers] Failed to create:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create advertiser', details: error.message },
      { status: 500 }
    )
  }
}
