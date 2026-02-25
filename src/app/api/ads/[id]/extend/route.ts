import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/ads/[id]/extend
 * Add weeks to an existing ad's times_paid
 * Also reactivates the ad if it was completed due to exhaustion
 */
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'ads/[id]/extend' },
  async ({ params, request, logger }) => {
    const id = params.id
    const { weeks } = await request.json()

    if (!weeks || typeof weeks !== 'number' || weeks <= 0) {
      return NextResponse.json({ error: 'Invalid weeks value' }, { status: 400 })
    }

    // Get current ad
    const { data: ad, error } = await supabaseAdmin
      .from('advertisements')
      .select('id, times_paid, status, title')
      .eq('id', id)
      .single()

    if (error || !ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 })
    }

    // Update times_paid and reactivate if completed due to exhaustion
    const newTimesPaid = (ad.times_paid || 0) + weeks
    const updates: Record<string, any> = {
      times_paid: newTimesPaid,
      paid: true, // Ensure paid flag is set for weekly limit logic
      updated_at: new Date().toISOString()
    }

    // Reactivate if was completed due to exhaustion
    if (ad.status === 'completed') {
      updates.status = 'active'
    }

    const { error: updateError } = await supabaseAdmin
      .from('advertisements')
      .update(updates)
      .eq('id', id)

    if (updateError) {
      logger.error({ err: updateError }, 'Error updating ad')
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`[Ads Extend] Extended ad "${ad.title}" by ${weeks} weeks (new total: ${newTimesPaid})`)

    return NextResponse.json({
      success: true,
      new_times_paid: newTimesPaid,
      reactivated: ad.status === 'completed'
    })
  }
)
