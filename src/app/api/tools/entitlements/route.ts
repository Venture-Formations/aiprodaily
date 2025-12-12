import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

// GET - Fetch all customer entitlements
export async function GET(request: NextRequest) {
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
      console.error('[Entitlements] Error fetching entitlements:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate remaining quantity for each entitlement
    const entitlementsWithRemaining = (entitlements || []).map(e => ({
      ...e,
      quantity_remaining: e.quantity_total - e.quantity_used
    }))

    return NextResponse.json({ success: true, entitlements: entitlementsWithRemaining })
  } catch (error) {
    console.error('[Entitlements] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Grant a new entitlement (manual grant by admin)
export async function POST(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const isStaging = host.includes('localhost') ||
                    host.includes('staging') ||
                    process.env.VERCEL_GIT_COMMIT_REF === 'staging'

  let grantedBy: string | null = null

  if (!isStaging) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedEmails = process.env.ALLOWED_ADMIN_EMAILS?.split(',') || []
    if (!allowedEmails.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    grantedBy = session.user.email
  }

  try {
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
      console.error('[Entitlements] Error creating entitlement:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Entitlements] Entitlement granted:', newEntitlement.id, 'to', userId)

    return NextResponse.json({ success: true, entitlement: newEntitlement })
  } catch (error) {
    console.error('[Entitlements] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
