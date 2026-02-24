import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

// GET - Fetch a single entitlement by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { data: entitlement, error } = await supabaseAdmin
      .from('customer_entitlements')
      .select(`
        *,
        package:sponsorship_packages(id, name)
      `)
      .eq('id', id)
      .eq('publication_id', PUBLICATION_ID)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Entitlement not found' }, { status: 404 })
      }
      console.error('[Entitlements] Error fetching entitlement:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      entitlement: {
        ...entitlement,
        quantity_remaining: entitlement.quantity_total - entitlement.quantity_used
      }
    })
  } catch (error) {
    console.error('[Entitlements] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update an entitlement (status, quantity, etc.)
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

    if (body.status !== undefined) {
      if (!['active', 'expired', 'cancelled', 'paused'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updateData.status = body.status
    }

    if (body.quantity_total !== undefined) {
      if (body.quantity_total < 1) {
        return NextResponse.json({ error: 'quantity_total must be at least 1' }, { status: 400 })
      }
      updateData.quantity_total = body.quantity_total
    }

    if (body.quantity_used !== undefined) {
      if (body.quantity_used < 0) {
        return NextResponse.json({ error: 'quantity_used cannot be negative' }, { status: 400 })
      }
      updateData.quantity_used = body.quantity_used
    }

    if (body.valid_until !== undefined) {
      updateData.valid_until = body.valid_until
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes
    }

    const { data: updatedEntitlement, error } = await supabaseAdmin
      .from('customer_entitlements')
      .update(updateData)
      .eq('id', id)
      .eq('publication_id', PUBLICATION_ID)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Entitlement not found' }, { status: 404 })
      }
      console.error('[Entitlements] Error updating entitlement:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Entitlements] Entitlement updated:', id)

    return NextResponse.json({ success: true, entitlement: updatedEntitlement })
  } catch (error) {
    console.error('[Entitlements] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete an entitlement
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
    const { error } = await supabaseAdmin
      .from('customer_entitlements')
      .delete()
      .eq('id', id)
      .eq('publication_id', PUBLICATION_ID)

    if (error) {
      console.error('[Entitlements] Error deleting entitlement:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Entitlements] Entitlement deleted:', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Entitlements] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
