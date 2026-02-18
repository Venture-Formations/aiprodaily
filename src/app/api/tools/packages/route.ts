import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

// GET - Fetch all sponsorship packages
export async function GET(request: NextRequest) {
  // Check if staging environment (bypass auth for read operations)
  const host = request.headers.get('host') || ''
  const isStaging = host.includes('localhost') ||
                    host.includes('staging') ||
                    process.env.VERCEL_GIT_COMMIT_REF === 'staging'

  if (!isStaging) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedEmails = process.env.ALLOWED_ADMIN_EMAILS?.split(',') || []
    if (!allowedEmails.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const { data: packages, error } = await supabaseAdmin
      .from('sponsorship_packages')
      .select('*')
      .eq('publication_id', PUBLICATION_ID)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Packages] Error fetching packages:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, packages: packages || [] })
  } catch (error) {
    console.error('[Packages] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new sponsorship package
export async function POST(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const isStaging = host.includes('localhost') ||
                    host.includes('staging') ||
                    process.env.VERCEL_GIT_COMMIT_REF === 'staging'

  if (!isStaging) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedEmails = process.env.ALLOWED_ADMIN_EMAILS?.split(',') || []
    if (!allowedEmails.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
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
      console.error('[Packages] Error creating package:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Packages] Package created:', newPackage.id)

    return NextResponse.json({ success: true, package: newPackage })
  } catch (error) {
    console.error('[Packages] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
