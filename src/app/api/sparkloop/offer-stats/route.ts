import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

export async function GET(request: NextRequest) {
  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '30', 10)

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString()

    // Get daily aggregates
    const { data: events, error } = await supabaseAdmin
      .from('sparkloop_offer_events')
      .select('event_type, created_at, subscriber_email, ip_address')
      .eq('publication_id', PUBLICATION_ID)
      .gte('created_at', sinceStr)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[OfferStats] Query error:', error.message)
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    // Aggregate by day
    const dailyMap: Record<string, { impressions: number; claims: number }> = {}
    let totalImpressions = 0
    let totalClaims = 0
    let todayImpressions = 0
    let todayClaims = 0

    const todayStr = new Date().toISOString().split('T')[0]

    for (const event of events || []) {
      const day = event.created_at.split('T')[0]
      if (!dailyMap[day]) {
        dailyMap[day] = { impressions: 0, claims: 0 }
      }

      if (event.event_type === 'impression') {
        dailyMap[day].impressions++
        totalImpressions++
        if (day === todayStr) todayImpressions++
      } else if (event.event_type === 'claim') {
        dailyMap[day].claims++
        totalClaims++
        if (day === todayStr) todayClaims++
      }
    }

    // Build sorted daily array
    const dailyStats = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        impressions: stats.impressions,
        claims: stats.claims,
        claimRate: stats.impressions > 0
          ? Math.round((stats.claims / stats.impressions) * 1000) / 10
          : 0,
      }))

    // Recent events for table (last 50)
    const recentEvents = (events || []).slice(0, 50).map(e => ({
      date: e.created_at,
      email: e.subscriber_email,
      event_type: e.event_type,
      ip: e.ip_address,
    }))

    const claimRate = totalImpressions > 0
      ? Math.round((totalClaims / totalImpressions) * 1000) / 10
      : 0

    return NextResponse.json({
      success: true,
      summary: {
        totalImpressions,
        totalClaims,
        claimRate,
        todayImpressions,
        todayClaims,
      },
      dailyStats,
      recentEvents,
    })
  } catch (err) {
    console.error('[OfferStats] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
