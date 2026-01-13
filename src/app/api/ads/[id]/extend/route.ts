import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/ads/[id]/extend
 * Add weeks to an existing ad's times_paid
 * Also reactivates the ad if it was completed due to exhaustion
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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
      console.error('[Ads Extend] Error updating ad:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`[Ads Extend] Extended ad "${ad.title}" by ${weeks} weeks (new total: ${newTimesPaid})`)

    return NextResponse.json({
      success: true,
      new_times_paid: newTimesPaid,
      reactivated: ad.status === 'completed'
    })

  } catch (error) {
    console.error('[Ads Extend] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
