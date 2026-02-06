import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Default publication ID for AI Pro Daily
const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

interface DailyStats {
  date: string
  pending: number
  confirmed: number
  projectedEarnings: number
}

/**
 * GET /api/sparkloop/stats
 *
 * Fetches SparkLoop statistics for charts and summaries
 * Supports timeframe filtering (7d, 30d, 90d, custom)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    // Calculate date range
    let fromDate: Date
    let toDate: Date = new Date()

    if (startDate && endDate) {
      fromDate = new Date(startDate)
      toDate = new Date(endDate)
    } else {
      fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - days)
    }

    // Get current totals from sparkloop_recommendations
    const { data: recommendations } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('sparkloop_pending, sparkloop_confirmed, sparkloop_earnings, cpa')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)

    const totalPending = recommendations?.reduce((sum, r) => sum + (r.sparkloop_pending || 0), 0) || 0
    const totalConfirmed = recommendations?.reduce((sum, r) => sum + (r.sparkloop_confirmed || 0), 0) || 0
    const totalEarnings = recommendations?.reduce((sum, r) => sum + (r.sparkloop_earnings || 0), 0) || 0

    // Calculate average CPA for projecting pending earnings
    const avgCPA = recommendations?.length
      ? recommendations.reduce((sum, r) => sum + (r.cpa || 0), 0) / recommendations.length
      : 100 // Default $1.00

    const projectedFromPending = (totalPending * avgCPA * 0.25) / 100 // Assume 25% RCR for pending

    // Get daily data from sparkloop_events (delta tracking)
    const { data: confirmEvents } = await supabaseAdmin
      .from('sparkloop_events')
      .select('event_timestamp, raw_payload')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .eq('event_type', 'sync_confirm_delta')
      .gte('event_timestamp', fromDate.toISOString())
      .lte('event_timestamp', toDate.toISOString())
      .order('event_timestamp', { ascending: true })

    // Also get submission events for pending tracking
    const { data: submissionEvents } = await supabaseAdmin
      .from('sparkloop_events')
      .select('event_timestamp, raw_payload')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .eq('event_type', 'subscriptions_success')
      .gte('event_timestamp', fromDate.toISOString())
      .lte('event_timestamp', toDate.toISOString())
      .order('event_timestamp', { ascending: true })

    // Aggregate by day
    const dailyMap = new Map<string, { pending: number; confirmed: number; earnings: number }>()

    // Initialize all days in range
    const currentDate = new Date(fromDate)
    while (currentDate <= toDate) {
      const dateKey = currentDate.toISOString().split('T')[0]
      dailyMap.set(dateKey, { pending: 0, confirmed: 0, earnings: 0 })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Add confirmed deltas
    confirmEvents?.forEach(event => {
      const dateKey = event.event_timestamp?.split('T')[0]
      if (dateKey && dailyMap.has(dateKey)) {
        const delta = (event.raw_payload as { delta?: number })?.delta || 0
        const existing = dailyMap.get(dateKey)!
        existing.confirmed += delta
        // Estimate earnings based on average CPA
        existing.earnings += (delta * avgCPA) / 100
      }
    })

    // Count submissions per day as pending
    submissionEvents?.forEach(event => {
      const dateKey = event.event_timestamp?.split('T')[0]
      if (dateKey && dailyMap.has(dateKey)) {
        const refCodes = (event.raw_payload as { refCodes?: string[] })?.refCodes || []
        const existing = dailyMap.get(dateKey)!
        existing.pending += refCodes.length
      }
    })

    // Convert to array
    const dailyStats: DailyStats[] = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      pending: stats.pending,
      confirmed: stats.confirmed,
      projectedEarnings: stats.earnings,
    }))

    // Get top earning recommendations
    const { data: topRecs } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('publication_name, publication_logo, sparkloop_confirmed, sparkloop_earnings')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .gt('sparkloop_earnings', 0)
      .order('sparkloop_earnings', { ascending: false })
      .limit(9)

    return NextResponse.json({
      success: true,
      summary: {
        totalPending,
        totalConfirmed,
        totalEarnings: totalEarnings / 100, // Convert cents to dollars
        projectedFromPending: projectedFromPending,
        avgCPA: avgCPA / 100,
      },
      dailyStats,
      topEarners: topRecs?.map(r => ({
        name: r.publication_name,
        logo: r.publication_logo,
        referrals: r.sparkloop_confirmed,
        earnings: (r.sparkloop_earnings || 0) / 100,
      })) || [],
      dateRange: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
      },
    })
  } catch (error) {
    console.error('[SparkLoop Stats] Failed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
