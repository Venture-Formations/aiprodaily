import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET all ads with optional status and ad_module_id filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const adModuleId = searchParams.get('ad_module_id')

    // Get the first active newsletter for publication_id
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (newsletterError || !newsletter) {
      return NextResponse.json(
        { error: 'No active newsletter found' },
        { status: 404 }
      )
    }

    let query = supabaseAdmin
      .from('advertisements')
      .select(`
        *,
        ad_module:ad_modules(id, name),
        advertiser:advertisers(id, company_name, logo_url)
      `)
      .eq('publication_id', newsletter.id)
      .order('created_at', { ascending: false })

    // Filter by ad_module_id
    if (adModuleId === 'null' || adModuleId === 'legacy') {
      // Legacy advertorial ads (no ad_module_id)
      query = query.is('ad_module_id', null)
    } else if (adModuleId) {
      query = query.eq('ad_module_id', adModuleId)
    }

    if (status) {
      // Handle comma-separated status values
      const statuses = status.split(',').map(s => s.trim())
      if (statuses.length > 1) {
        query = query.in('status', statuses)
      } else {
        query = query.eq('status', status)
      }
    }

    const { data: ads, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ads })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch ads',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Create new ad (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      body: adBody,
      word_count,
      button_text,
      button_url,
      frequency,
      times_paid
    } = body

    // Validation
    if (!title || !adBody || !button_url) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the first active newsletter for publication_id
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (newsletterError || !newsletter) {
      return NextResponse.json(
        { error: 'No active newsletter found' },
        { status: 404 }
      )
    }

    const newsletterId = newsletter.id

    // Determine display_order if status is active
    let display_order = null
    const requestedStatus = body.status || 'approved'
    const useInNextNewsletter = body.useInNextNewsletter || false

    if (requestedStatus === 'active') {
      if (useInNextNewsletter) {
        // Get the current next_ad_position from publication_settings (for this newsletter)
        const { data: settingsData, error: settingsError } = await supabaseAdmin
          .from('publication_settings')
          .select('value')
          .eq('publication_id', newsletterId)
          .eq('key', 'next_ad_position')
          .maybeSingle()

        if (settingsError) {
          console.error('Error fetching next_ad_position:', settingsError)
        }

        const nextAdPosition = settingsData ? parseInt(settingsData.value) : 1
        display_order = nextAdPosition

        // Shift all ads with display_order >= nextAdPosition by +1
        const { data: adsToShift, error: fetchAdsError } = await supabaseAdmin
          .from('advertisements')
          .select('id, display_order')
          .eq('publication_id', newsletterId)
          .eq('status', 'active')
          .gte('display_order', nextAdPosition)
          .not('display_order', 'is', null)

        if (fetchAdsError) {
          console.error('Error fetching ads to shift:', fetchAdsError)
        }

        // Increment display_order for each ad that needs to shift
        if (adsToShift && adsToShift.length > 0) {
          for (const ad of adsToShift) {
            await supabaseAdmin
              .from('advertisements')
              .update({ display_order: (ad.display_order || 0) + 1 })
              .eq('id', ad.id)
          }
        }
      } else {
        // Normal behavior: add to end of queue
        // Get the highest display_order for active ads (for this newsletter)
        const { data: activeAds, error: fetchError } = await supabaseAdmin
          .from('advertisements')
          .select('display_order')
          .eq('publication_id', newsletterId)
          .eq('status', 'active')
          .not('display_order', 'is', null)
          .order('display_order', { ascending: false })
          .limit(1)

        if (fetchError) {
          console.error('Error fetching active ads:', fetchError)
        }

        // Set display_order to next available position
        display_order = activeAds && activeAds.length > 0
          ? (activeAds[0].display_order || 0) + 1
          : 1
      }
    }

    const { data: ad, error } = await supabaseAdmin
      .from('advertisements')
      .insert({
        title,
        body: adBody,
        word_count,
        button_text: button_text || '',
        button_url,
        frequency: frequency || 'single', // Default to 'single' if not provided
        times_paid: times_paid || 1, // Default to 1 if not provided
        times_used: 0,
        status: requestedStatus,
        display_order: display_order,
        payment_status: body.payment_status || 'paid',
        paid: body.paid !== undefined ? body.paid : true,
        image_url: body.image_url || null,
        submission_date: new Date().toISOString(),
        publication_id: newsletterId, // Associate ad with newsletter
        ad_module_id: body.ad_module_id || null, // Optional ad module assignment
        advertiser_id: body.advertiser_id || null, // Optional advertiser assignment
        priority: body.priority || 0 // Priority for selection mode
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ad })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to create ad',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
