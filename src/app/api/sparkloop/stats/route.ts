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
 * Fetches SparkLoop statistics for charts and summaries.
 * Uses our sparkloop_referrals table for popup-sourced data
 * and sparkloop_recommendations aggregate columns for summary totals.
 * Supports timeframe filtering (7d, 30d, 90d, custom).
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

    // Get current totals from our aggregate columns on sparkloop_recommendations
    const { data: recommendations } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('our_pending, our_confirms, our_total_subscribes, sparkloop_earnings, cpa')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)

    const totalPending = recommendations?.reduce((sum, r) => sum + (r.our_pending || 0), 0) || 0
    const totalConfirmed = recommendations?.reduce((sum, r) => sum + (r.our_confirms || 0), 0) || 0
    const totalSubscribes = recommendations?.reduce((sum, r) => sum + (r.our_total_subscribes || 0), 0) || 0
    const totalEarnings = recommendations?.reduce((sum, r) => sum + (r.sparkloop_earnings || 0), 0) || 0

    // Calculate average CPA for projecting pending earnings
    const avgCPA = recommendations?.length
      ? recommendations.reduce((sum, r) => sum + (r.cpa || 0), 0) / recommendations.length
      : 100 // Default $1.00

    const projectedFromPending = (totalPending * avgCPA * 0.25) / 100 // Assume 25% RCR for pending

    // Get daily confirmed data from sparkloop_referrals (our popup referrals)
    const { data: confirmedByDay } = await supabaseAdmin
      .from('sparkloop_referrals')
      .select('confirmed_at')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .eq('source', 'custom_popup')
      .eq('status', 'confirmed')
      .not('confirmed_at', 'is', null)
      .gte('confirmed_at', fromDate.toISOString())
      .lte('confirmed_at', toDate.toISOString())

    // Get daily subscribed data from sparkloop_referrals (our popup referrals)
    const { data: subscribedByDay } = await supabaseAdmin
      .from('sparkloop_referrals')
      .select('subscribed_at')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .eq('source', 'custom_popup')
      .not('subscribed_at', 'is', null)
      .gte('subscribed_at', fromDate.toISOString())
      .lte('subscribed_at', toDate.toISOString())

    // Aggregate by day
    const dailyMap = new Map<string, { pending: number; confirmed: number; earnings: number }>()

    // Initialize all days in range
    const currentDate = new Date(fromDate)
    while (currentDate <= toDate) {
      const dateKey = currentDate.toISOString().split('T')[0]
      dailyMap.set(dateKey, { pending: 0, confirmed: 0, earnings: 0 })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Count confirmed per day
    confirmedByDay?.forEach(row => {
      const dateKey = row.confirmed_at?.split('T')[0]
      if (dateKey && dailyMap.has(dateKey)) {
        const existing = dailyMap.get(dateKey)!
        existing.confirmed += 1
        existing.earnings += avgCPA / 100
      }
    })

    // Count subscribed per day as pending
    subscribedByDay?.forEach(row => {
      const dateKey = row.subscribed_at?.split('T')[0]
      if (dateKey && dailyMap.has(dateKey)) {
        const existing = dailyMap.get(dateKey)!
        existing.pending += 1
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
      .select('publication_name, publication_logo, our_confirms, sparkloop_earnings')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .gt('sparkloop_earnings', 0)
      .order('sparkloop_earnings', { ascending: false })
      .limit(9)

    return NextResponse.json({
      success: true,
      summary: {
        totalPending,
        totalConfirmed,
        totalSubscribes,
        totalEarnings: totalEarnings / 100, // Convert cents to dollars
        projectedFromPending: projectedFromPending,
        avgCPA: avgCPA / 100,
      },
      dailyStats,
      topEarners: topRecs?.map(r => ({
        name: r.publication_name,
        logo: r.publication_logo,
        referrals: r.our_confirms || 0,
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
