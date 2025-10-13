import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
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
        console.error(`Error updating ad ${update.id}:`, error)
        throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update order error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update order' },
      { status: 500 }
    )
  }
}
