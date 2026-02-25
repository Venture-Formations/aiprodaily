import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

// GET - Fetch a single entitlement by ID
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'tools/entitlements/[id]' },
  async ({ params }) => {
    const id = params.id

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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      entitlement: {
        ...entitlement,
        quantity_remaining: entitlement.quantity_total - entitlement.quantity_used
      }
    })
  }
)

// PUT - Update an entitlement (status, quantity, etc.)
export const PUT = withApiHandler(
  { authTier: 'admin', logContext: 'tools/entitlements/[id]' },
  async ({ params, request, logger }) => {
    const id = params.id
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
      logger.error({ err: error }, 'Error updating entitlement')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logger.info({ entitlementId: id }, 'Entitlement updated')

    return NextResponse.json({ success: true, entitlement: updatedEntitlement })
  }
)

// DELETE - Delete an entitlement
export const DELETE = withApiHandler(
  { authTier: 'admin', logContext: 'tools/entitlements/[id]' },
  async ({ params, logger }) => {
    const id = params.id

    const { error } = await supabaseAdmin
      .from('customer_entitlements')
      .delete()
      .eq('id', id)
      .eq('publication_id', PUBLICATION_ID)

    if (error) {
      logger.error({ err: error }, 'Error deleting entitlement')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logger.info({ entitlementId: id }, 'Entitlement deleted')

    return NextResponse.json({ success: true })
  }
)
