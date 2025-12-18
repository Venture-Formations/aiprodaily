import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = Promise<{ id: string }>

/**
 * GET /api/ad-modules/[id]/ads - List ads for a specific module
 */
export async function GET(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id } = params

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

  } catch (error: any) {
    console.error('[ModuleAds] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch module ads', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ad-modules/[id]/ads - Create new ad for module
 */
export async function POST(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { id: moduleId } = params
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

  } catch (error: any) {
    console.error('[ModuleAds] Failed to create:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create ad', details: error.message },
      { status: 500 }
    )
  }
}
