import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_type, email, offer_id } = body

    if (!event_type || !offer_id) {
      return NextResponse.json({ error: 'Missing event_type or offer_id' }, { status: 400 })
    }

    if (!['impression', 'claim'].includes(event_type)) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || ''

    const { error } = await supabaseAdmin
      .from('sparkloop_offer_events')
      .insert({
        publication_id: PUBLICATION_ID,
        offer_recommendation_id: offer_id,
        event_type,
        subscriber_email: email || null,
        ip_address: ip,
        user_agent: userAgent,
      })

    if (error) {
      console.error('[OfferTrack] Insert error:', error.message)
      return NextResponse.json({ error: 'Failed to track event' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[OfferTrack] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
