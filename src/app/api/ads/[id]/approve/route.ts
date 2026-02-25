import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'ads/[id]/approve' },
  async ({ params, request }) => {
    const id = params.id
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
  }
)
