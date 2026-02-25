import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

// GET - Fetch all customer entitlements
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'tools/entitlements' },
  async ({ request, logger }) => {
    // Optional: filter by clerk_user_id
    const url = new URL(request.url)
    const clerkUserId = url.searchParams.get('clerk_user_id')

    let query = supabaseAdmin
      .from('customer_entitlements')
      .select(`
        *,
        package:sponsorship_packages(id, name)
      `)
      .eq('publication_id', PUBLICATION_ID)
      .order('created_at', { ascending: false })

    if (clerkUserId) {
      query = query.eq('clerk_user_id', clerkUserId)
    }

    const { data: entitlements, error } = await query

    if (error) {
      logger.error({ err: error }, 'Error fetching entitlements')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate remaining quantity for each entitlement
    const entitlementsWithRemaining = (entitlements || []).map(e => ({
      ...e,
      quantity_remaining: e.quantity_total - e.quantity_used
    }))

    return NextResponse.json({ success: true, entitlements: entitlementsWithRemaining })
  }
)

// POST - Grant a new entitlement (manual grant by admin)
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'tools/entitlements' },
  async ({ request, session, logger }) => {
    const grantedBy = session.user.email

    const body = await request.json()
    const {
      clerk_user_id,
      customer_email,
      package_id,
      entitlement_type,
      quantity_total,
      valid_until,
      notes
    } = body

    // Validate required fields
    if (!clerk_user_id && !customer_email) {
      return NextResponse.json({ error: 'Either clerk_user_id or customer_email is required' }, { status: 400 })
    }

    if (!entitlement_type || !['newsletter_ad', 'featured_listing'].includes(entitlement_type)) {
      return NextResponse.json({ error: 'Valid entitlement_type is required' }, { status: 400 })
    }

    if (!quantity_total || quantity_total < 1) {
      return NextResponse.json({ error: 'quantity_total must be at least 1' }, { status: 400 })
    }

    // If only email provided, use it as a temporary clerk_user_id
    // In a real implementation, you might look up the clerk user by email
    const userId = clerk_user_id || `email:${customer_email}`

    const { data: newEntitlement, error } = await supabaseAdmin
      .from('customer_entitlements')
      .insert({
        publication_id: PUBLICATION_ID,
        clerk_user_id: userId,
        package_id: package_id || null,
        entitlement_type,
        quantity_total,
        quantity_used: 0,
        valid_from: new Date().toISOString(),
        valid_until: valid_until || null,
        status: 'active',
        notes: notes || null,
        granted_by: grantedBy
      })
      .select()
      .single()

    if (error) {
      logger.error({ err: error }, 'Error creating entitlement')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logger.info({ entitlementId: newEntitlement.id, userId }, 'Entitlement granted')

    return NextResponse.json({ success: true, entitlement: newEntitlement })
  }
)
