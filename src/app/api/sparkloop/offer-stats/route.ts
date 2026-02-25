import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'
const PAGE_SIZE = 1000

export const GET = withApiHandler(
  { authTier: 'public', logContext: 'sparkloop-offer-stats' },
  async ({ request, logger }) => {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '30', 10)

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString()

    // Get all events with pagination to avoid 1000-row default limit
    let events: { event_type: string; created_at: string; subscriber_email: string | null; ip_address: string | null }[] = []
    let pageFrom = 0
    while (true) {
      const { data: page, error } = await supabaseAdmin
        .from('sparkloop_offer_events')
        .select('event_type, created_at, subscriber_email, ip_address')
        .eq('publication_id', PUBLICATION_ID)
        .gte('created_at', sinceStr)
        .order('created_at', { ascending: false })
        .range(pageFrom, pageFrom + PAGE_SIZE - 1)
      if (error) {
        console.error('[OfferStats] Query error:', error.message)
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
      }
      if (!page || page.length === 0) break
      events = events.concat(page)
      if (page.length < PAGE_SIZE) break
      pageFrom += PAGE_SIZE
    }

    // Aggregate by day
    const dailyMap: Record<string, { impressions: number; claims: number }> = {}
    let totalImpressions = 0
    let totalClaims = 0
    let todayImpressions = 0
    let todayClaims = 0

    const todayStr = new Date().toISOString().split('T')[0]

    for (const event of events) {
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
    const recentEvents = events.slice(0, 50).map(e => ({
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
  }
)
