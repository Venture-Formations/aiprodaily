import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * GET /api/ad-modules/[id]/ads - List ads for a specific module
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'ad-modules/[id]/ads' },
  async ({ params }) => {
    const id = params.id

    const { data: ads, error } = await supabaseAdmin
      .from('advertisements')
      .select(`
        *,
        advertiser:advertisers(id, company_name, logo_url, is_active)
      `)
      .eq('ad_module_id', id)
      .order('priority', { ascending: false, nullsFirst: false })
      .order('display_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      ads: ads || []
    })
  }
)

/**
 * POST /api/ad-modules/[id]/ads - Create new ad for module
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'ad-modules/[id]/ads' },
  async ({ params, request }) => {
    const moduleId = params.id
    const body = await request.json()

    // Validate required fields
    if (!body.advertiser_id) {
      return NextResponse.json(
        { error: 'advertiser_id is required' },
        { status: 400 }
      )
    }

    // Get the module's publication_id
    const { data: module } = await supabaseAdmin
      .from('ad_modules')
      .select('publication_id')
      .eq('id', moduleId)
      .single()

    if (!module) {
      return NextResponse.json(
        { error: 'Ad module not found' },
        { status: 404 }
      )
    }

    const { data: ad, error } = await supabaseAdmin
      .from('advertisements')
      .insert({
        ad_module_id: moduleId,
        publication_id: module.publication_id,
        advertiser_id: body.advertiser_id,
        title: body.title || null,
        body: body.body || null,
        image_url: body.image_url || null,
        button_text: body.button_text || 'Learn More',
        button_url: body.button_url || null,
        status: body.status || 'draft',
        priority: body.priority || 0,
        display_order: body.display_order || 0,
        preferred_start_date: body.start_date || null
      })
      .select(`
        *,
        advertiser:advertisers(id, company_name, logo_url)
      `)
      .single()

    if (error) throw error

    console.log(`[ModuleAds] Created ad: ${ad.title || 'Untitled'} for module ${moduleId}`)

    return NextResponse.json({
      success: true,
      ad
    }, { status: 201 })
  }
)
