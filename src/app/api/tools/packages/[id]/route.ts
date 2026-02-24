import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

// GET - Fetch a single package by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { data: pkg, error } = await supabaseAdmin
      .from('sponsorship_packages')
      .select('*')
      .eq('id', id)
      .eq('publication_id', PUBLICATION_ID)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Package not found' }, { status: 404 })
      }
      console.error('[Packages] Error fetching package:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, package: pkg })
  } catch (error) {
    console.error('[Packages] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update a package
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.newsletter_ad_spots !== undefined) updateData.newsletter_ad_spots = body.newsletter_ad_spots
    if (body.featured_listing_included !== undefined) updateData.featured_listing_included = body.featured_listing_included
    if (body.featured_listing_months !== undefined) updateData.featured_listing_months = body.featured_listing_months
    if (body.price_monthly !== undefined) updateData.price_monthly = body.price_monthly
    if (body.price_yearly !== undefined) updateData.price_yearly = body.price_yearly
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    if (body.is_featured !== undefined) updateData.is_featured = body.is_featured
    if (body.display_order !== undefined) updateData.display_order = body.display_order
    if (body.stripe_product_id !== undefined) updateData.stripe_product_id = body.stripe_product_id
    if (body.stripe_price_id_monthly !== undefined) updateData.stripe_price_id_monthly = body.stripe_price_id_monthly
    if (body.stripe_price_id_yearly !== undefined) updateData.stripe_price_id_yearly = body.stripe_price_id_yearly

    const { data: updatedPackage, error } = await supabaseAdmin
      .from('sponsorship_packages')
      .update(updateData)
      .eq('id', id)
      .eq('publication_id', PUBLICATION_ID)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Package not found' }, { status: 404 })
      }
      console.error('[Packages] Error updating package:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Packages] Package updated:', id)

    return NextResponse.json({ success: true, package: updatedPackage })
  } catch (error) {
    console.error('[Packages] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a package
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Check if package has any active entitlements before deleting
    const { count: entitlementCount } = await supabaseAdmin
      .from('customer_entitlements')
      .select('id', { count: 'exact', head: true })
      .eq('package_id', id)
      .eq('status', 'active')

    if (entitlementCount && entitlementCount > 0) {
      return NextResponse.json({
        error: 'Cannot delete package with active customer entitlements. Deactivate it instead.'
      }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('sponsorship_packages')
      .delete()
      .eq('id', id)
      .eq('publication_id', PUBLICATION_ID)

    if (error) {
      console.error('[Packages] Error deleting package:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Packages] Package deleted:', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Packages] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
