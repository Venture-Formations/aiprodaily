import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { approved_by } = body

    if (!approved_by) {
      return NextResponse.json({ error: 'approved_by is required' }, { status: 400 })
    }

    // Update ad status to approved
    const { data: ad, error } = await supabaseAdmin
      .from('advertisements')
      .update({
        status: 'approved',
        approved_by,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // TODO: Send approval email to submitter

    return NextResponse.json({
      success: true,
      ad
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to approve ad',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
