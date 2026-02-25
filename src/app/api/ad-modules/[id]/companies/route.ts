import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * GET /api/ad-modules/[id]/companies
 * List companies for a module with their ads, auto-creating junction entries for any missing ones.
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'ad-modules/[id]/companies' },
  async ({ params }) => {
    const moduleId = params.id

    // Get the module for context
    const { data: adModule, error: moduleError } = await supabaseAdmin
      .from('ad_modules')
      .select('id, publication_id, next_position, selection_mode')
      .eq('id', moduleId)
      .single()

    if (moduleError || !adModule) {
      return NextResponse.json(
        { success: false, error: 'Ad module not found' },
        { status: 404 }
      )
    }

    // Auto-create junction entries for any active ads missing from the junction table
    const { data: activeAds } = await supabaseAdmin
      .from('advertisements')
      .select('advertiser_id')
      .eq('ad_module_id', moduleId)
      .eq('publication_id', adModule.publication_id)
      .eq('status', 'active')
      .not('advertiser_id', 'is', null)

    if (activeAds && activeAds.length > 0) {
      // Get unique advertiser IDs from active ads
      const advertiserIds = Array.from(new Set(activeAds.map(a => a.advertiser_id)))

      // Check which ones already exist in junction
      const { data: existingJunctions } = await supabaseAdmin
        .from('ad_module_advertisers')
        .select('advertiser_id')
        .eq('ad_module_id', moduleId)

      const existingAdvertiserIds = new Set(existingJunctions?.map(j => j.advertiser_id) || [])
      const missingAdvertiserIds = advertiserIds.filter(id => !existingAdvertiserIds.has(id))

      if (missingAdvertiserIds.length > 0) {
        // Get current max display_order
        const { data: maxOrderResult } = await supabaseAdmin
          .from('ad_module_advertisers')
          .select('display_order')
          .eq('ad_module_id', moduleId)
          .order('display_order', { ascending: false })
          .limit(1)

        let nextOrder = (maxOrderResult?.[0]?.display_order || 0) + 1

        const newEntries = missingAdvertiserIds.map(advertiserId => ({
          ad_module_id: moduleId,
          advertiser_id: advertiserId,
          display_order: nextOrder++,
          next_ad_position: 1,
          times_used: 0,
          priority: 0
        }))

        await supabaseAdmin
          .from('ad_module_advertisers')
          .insert(newEntries)

        console.log(`[AdModules] Auto-created ${newEntries.length} junction entries for module ${moduleId}`)
      }
    }

    // Fetch junction entries with advertiser details
    const { data: junctions, error: junctionError } = await supabaseAdmin
      .from('ad_module_advertisers')
      .select(`
        id,
        ad_module_id,
        advertiser_id,
        display_order,
        next_ad_position,
        times_used,
        priority,
        created_at,
        updated_at,
        advertiser:advertisers(id, company_name, logo_url, is_active, last_used_date, times_used)
      `)
      .eq('ad_module_id', moduleId)
      .order('display_order', { ascending: true })

    if (junctionError) {
      return NextResponse.json(
        { success: false, error: junctionError.message },
        { status: 500 }
      )
    }

    // Fetch all active ads for this module grouped by advertiser
    const { data: ads, error: adsError } = await supabaseAdmin
      .from('advertisements')
      .select('id, title, advertiser_id, display_order, status, times_used, last_used_date, paid, frequency, times_paid, image_url, image_alt, body, button_url, priority')
      .eq('ad_module_id', moduleId)
      .eq('publication_id', adModule.publication_id)
      .eq('status', 'active')
      .order('display_order', { ascending: true })

    if (adsError) {
      return NextResponse.json(
        { success: false, error: adsError.message },
        { status: 500 }
      )
    }

    // Group ads by advertiser_id
    const adsByAdvertiser: Record<string, typeof ads> = {}
    for (const ad of (ads || [])) {
      if (!ad.advertiser_id) continue
      if (!adsByAdvertiser[ad.advertiser_id]) {
        adsByAdvertiser[ad.advertiser_id] = []
      }
      adsByAdvertiser[ad.advertiser_id].push(ad)
    }

    // Build response with companies and their ads
    const companies = (junctions || []).map(j => ({
      ...j,
      advertisements: adsByAdvertiser[j.advertiser_id] || []
    }))

    return NextResponse.json({
      success: true,
      companies,
      module: {
        id: adModule.id,
        next_position: adModule.next_position,
        selection_mode: adModule.selection_mode
      }
    })
  }
)
