import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

// GET - Fetch all sponsorship packages
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'tools/packages' },
  async ({ logger }) => {
    const { data: packages, error } = await supabaseAdmin
      .from('sponsorship_packages')
      .select('*')
      .eq('publication_id', PUBLICATION_ID)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      logger.error({ err: error }, 'Error fetching packages')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, packages: packages || [] })
  }
)

// POST - Create a new sponsorship package
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'tools/packages' },
  async ({ request, logger }) => {
    const body = await request.json()
    const {
      name,
      description,
      newsletter_ad_spots,
      featured_listing_included,
      featured_listing_months,
      price_monthly,
      price_yearly,
      is_active,
      is_featured,
      display_order
    } = body

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Package name is required' }, { status: 400 })
    }

    const { data: newPackage, error } = await supabaseAdmin
      .from('sponsorship_packages')
      .insert({
        publication_id: PUBLICATION_ID,
        name: name.trim(),
        description: description?.trim() || null,
        newsletter_ad_spots: newsletter_ad_spots || 0,
        featured_listing_included: featured_listing_included || false,
        featured_listing_months: featured_listing_months || 0,
        price_monthly: price_monthly || null,
        price_yearly: price_yearly || null,
        is_active: is_active !== undefined ? is_active : true,
        is_featured: is_featured || false,
        display_order: display_order || 0
      })
      .select()
      .single()

    if (error) {
      logger.error({ err: error }, 'Error creating package')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logger.info({ packageId: newPackage.id }, 'Package created')

    return NextResponse.json({ success: true, package: newPackage })
  }
)
