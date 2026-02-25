import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'ads/update-order' },
  async ({ request, logger }) => {
    const { adId, newOrder } = await request.json()

    if (!adId || !newOrder) {
      return NextResponse.json({ error: 'Missing adId or newOrder' }, { status: 400 })
    }

    // Get all active ads sorted by current display_order
    const { data: ads, error: fetchError } = await supabaseAdmin
      .from('advertisements')
      .select('id, display_order')
      .eq('status', 'active')
      .not('display_order', 'is', null)
      .order('display_order', { ascending: true })

    if (fetchError) throw fetchError

    // Find the ad being moved
    const movingAd = ads.find(ad => ad.id === adId)
    if (!movingAd) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 })
    }

    const oldOrder = movingAd.display_order
    if (oldOrder === newOrder) {
      return NextResponse.json({ success: true, message: 'No change needed' })
    }

    // Prepare updates
    const updates = []

    if (newOrder > oldOrder) {
      // Moving down: shift ads between old and new position up
      for (const ad of ads) {
        if (ad.id === adId) {
          updates.push({ id: ad.id, display_order: newOrder })
        } else if (ad.display_order > oldOrder && ad.display_order <= newOrder) {
          updates.push({ id: ad.id, display_order: ad.display_order - 1 })
        }
      }
    } else {
      // Moving up: shift ads between new and old position down
      for (const ad of ads) {
        if (ad.id === adId) {
          updates.push({ id: ad.id, display_order: newOrder })
        } else if (ad.display_order >= newOrder && ad.display_order < oldOrder) {
          updates.push({ id: ad.id, display_order: ad.display_order + 1 })
        }
      }
    }

    // Apply updates
    for (const update of updates) {
      const { error } = await supabaseAdmin
        .from('advertisements')
        .update({ display_order: update.display_order })
        .eq('id', update.id)

      if (error) {
        logger.error({ adId: update.id, err: error }, 'Error updating ad order')
        throw error
      }
    }

    return NextResponse.json({ success: true })
  }
)
