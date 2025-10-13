import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET all ads with optional status filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabaseAdmin
      .from('advertisements')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
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
      business_name,
      contact_name,
      contact_email,
      contact_phone,
      business_address,
      business_website,
      frequency,
      times_paid
    } = body

    // Validation
    if (!title || !adBody || !business_name || !contact_name || !contact_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Determine display_order if status is active
    let display_order = null
    const requestedStatus = body.status || 'approved'
    const useInNextNewsletter = body.useInNextNewsletter || false

    if (requestedStatus === 'active') {
      if (useInNextNewsletter) {
        // Get the current next_ad_position from app_settings
        const { data: settingsData, error: settingsError } = await supabaseAdmin
          .from('app_settings')
          .select('value')
          .eq('key', 'next_ad_position')
          .single()

        if (settingsError) {
          console.error('Error fetching next_ad_position:', settingsError)
        }

        const nextAdPosition = settingsData ? parseInt(settingsData.value) : 1
        display_order = nextAdPosition

        // Shift all ads with display_order >= nextAdPosition by +1
        const { data: adsToShift, error: fetchAdsError } = await supabaseAdmin
          .from('advertisements')
          .select('id, display_order')
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
        // Get the highest display_order for active ads
        const { data: activeAds, error: fetchError } = await supabaseAdmin
          .from('advertisements')
          .select('display_order')
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
        business_name,
        contact_name,
        contact_email,
        contact_phone,
        business_address,
        business_website,
        frequency: frequency || 'single', // Default to 'single' if not provided
        times_paid: times_paid || 1, // Default to 1 if not provided
        times_used: 0,
        status: requestedStatus,
        display_order: display_order,
        payment_status: body.payment_status || 'paid',
        paid: body.paid !== undefined ? body.paid : true,
        image_url: body.image_url || null,
        submission_date: new Date().toISOString()
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
