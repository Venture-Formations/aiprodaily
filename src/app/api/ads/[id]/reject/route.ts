import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { rejection_reason, rejected_by } = body

    if (!rejection_reason) {
      return NextResponse.json({ error: 'rejection_reason is required' }, { status: 400 })
    }

    // Update ad status to rejected
    const { data: ad, error } = await supabaseAdmin
      .from('advertisements')
      .update({
        status: 'rejected',
        rejection_reason,
        approved_by: rejected_by, // Use same field for tracking who took action
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // TODO: Send rejection email to submitter with reason

    return NextResponse.json({
      success: true,
      ad
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to reject ad',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
