import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getPublicationSettings } from '@/lib/publication-settings'
import { PUBLICATION_ID } from '@/lib/config'
const FALLBACK_DEFAULT_RCR = 25

interface DailyStats {
  date: string
  pending: number
  confirmed: number
  rejected: number
  projectedEarnings: number
  confirmedEarnings: number
  newPending: number | null  // daily change in pending from snapshots
}

/**
 * GET /api/sparkloop/stats
 *
 * Fetches SparkLoop statistics for charts and summaries.
 * Uses sparkloop_referrals joined with sparkloop_recommendations
 * to calculate per-referral projected and confirmed earnings.
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

    // Load default RCR from publication_settings
    const defaults = await getPublicationSettings(PUBLICATION_ID, [
      'sparkloop_default_rcr',
    ])
    const defaultRcr = defaults.sparkloop_default_rcr
      ? parseFloat(defaults.sparkloop_default_rcr) / 100
      : FALLBACK_DEFAULT_RCR / 100

    // Get all recommendations with CPA and RCR data (keyed by ref_code)
    const { data: recommendations } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('ref_code, cpa, sparkloop_rcr, override_rcr, our_pending, our_confirms, our_rejections, our_total_subscribes, sparkloop_earnings')
      .eq('publication_id', PUBLICATION_ID)

    // Build a lookup: ref_code -> { cpaDollars, rcr }
    const recLookup = new Map<string, { cpaDollars: number; rcr: number }>()
    for (const rec of recommendations || []) {
      const cpaDollars = (rec.cpa || 0) / 100
      const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) : null
      const hasSLRcr = slRcr !== null && slRcr > 0
      const hasOverrideRcr = rec.override_rcr !== null && rec.override_rcr !== undefined
      // RCR priority: override > sparkloop > default
      const rcr = hasOverrideRcr ? Number(rec.override_rcr) / 100
        : hasSLRcr ? slRcr! / 100
        : defaultRcr
      recLookup.set(rec.ref_code, { cpaDollars, rcr })
    }

    // Get all referrals in the date range with ref_code and status
    // Paginate to avoid Supabase default 1000-row limit
    let referrals: { ref_code: string; status: string; subscribed_at: string; confirmed_at: string | null }[] = []
    let pageFrom = 0
    const pageSize = 1000
    while (true) {
      const { data: page } = await supabaseAdmin
        .from('sparkloop_referrals')
        .select('ref_code, status, subscribed_at, confirmed_at')
        .eq('publication_id', PUBLICATION_ID)
        .in('source', ['custom_popup', 'recs_page'])
        .gte('subscribed_at', fromDate.toISOString())
        .lte('subscribed_at', toDate.toISOString())
        .order('subscribed_at', { ascending: true })
        .order('ref_code', { ascending: true })
        .range(pageFrom, pageFrom + pageSize - 1)
      if (!page || page.length === 0) break
      referrals = referrals.concat(page)
      if (page.length < pageSize) break
      pageFrom += pageSize
    }

    // Aggregate by day
    const dailyMap = new Map<string, {
      pending: number
      confirmed: number
      rejected: number
      projectedEarnings: number
      confirmedEarnings: number
      newPending: number | null
    }>()

    // Initialize all days in range
    const currentDate = new Date(fromDate)
    while (currentDate <= toDate) {
      const dateKey = currentDate.toISOString().split('T')[0]
      dailyMap.set(dateKey, { pending: 0, confirmed: 0, rejected: 0, projectedEarnings: 0, confirmedEarnings: 0, newPending: null })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Fetch daily snapshots for new pending calculation
    // We need one extra day before the range to compute the first day's delta
    const snapshotFromDate = new Date(fromDate)
    snapshotFromDate.setDate(snapshotFromDate.getDate() - 1)
    let snapshots: { ref_code: string; snapshot_date: string; sparkloop_pending: number; sparkloop_confirmed: number; sparkloop_rejected: number }[] = []
    let snapPageFrom = 0
    while (true) {
      const { data: snapPage } = await supabaseAdmin
        .from('sparkloop_daily_snapshots')
        .select('ref_code, snapshot_date, sparkloop_pending, sparkloop_confirmed, sparkloop_rejected')
        .eq('publication_id', PUBLICATION_ID)
        .gte('snapshot_date', snapshotFromDate.toISOString().split('T')[0])
        .lte('snapshot_date', toDate.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: true })
        .order('ref_code', { ascending: true })
        .range(snapPageFrom, snapPageFrom + pageSize - 1)
      if (!snapPage || snapPage.length === 0) break
      snapshots = snapshots.concat(snapPage)
      if (snapPage.length < pageSize) break
      snapPageFrom += pageSize
    }

    // Group snapshots by ref_code, then by date
    const snapshotsByRefCode = new Map<string, Map<string, { pending: number; confirmed: number; rejected: number }>>()
    for (const snap of snapshots || []) {
      let refMap = snapshotsByRefCode.get(snap.ref_code)
      if (!refMap) {
        refMap = new Map()
        snapshotsByRefCode.set(snap.ref_code, refMap)
      }
      refMap.set(snap.snapshot_date, {
        pending: snap.sparkloop_pending || 0,
        confirmed: snap.sparkloop_confirmed || 0,
        rejected: snap.sparkloop_rejected || 0,
      })
    }

    // Compute new pending per ref_code, then sum into daily totals.
    // Only include deltas for ref_codes present on BOTH consecutive days
    // so newly-synced recommendations don't dump lifetime totals into one day.
    const newPendingByDate = new Map<string, number>()
    Array.from(snapshotsByRefCode.values()).forEach(refMap => {
      const dates = Array.from(refMap.keys()).sort()
      for (let i = 1; i < dates.length; i++) {
        const prev = refMap.get(dates[i - 1])!
        const curr = refMap.get(dates[i])!
        const delta = (curr.pending - prev.pending) + (curr.confirmed - prev.confirmed) + (curr.rejected - prev.rejected)
        const currDate = dates[i]
        newPendingByDate.set(currDate, (newPendingByDate.get(currDate) || 0) + delta)
      }
    })

    Array.from(newPendingByDate.entries()).forEach(([dateKey, delta]) => {
      if (dailyMap.has(dateKey)) {
        dailyMap.get(dateKey)!.newPending = Math.max(0, delta)
      }
    })

    // Process each referral
    for (const ref of referrals) {
      const dateKey = ref.subscribed_at?.split('T')[0]
      if (!dateKey || !dailyMap.has(dateKey)) continue

      const day = dailyMap.get(dateKey)!
      const info = recLookup.get(ref.ref_code) || { cpaDollars: 0, rcr: defaultRcr }

      if (ref.status === 'confirmed') {
        day.confirmed += 1
        day.confirmedEarnings += info.cpaDollars
      } else if (ref.status === 'rejected') {
        day.rejected += 1
      } else {
        // 'subscribed' or 'pending'
        day.pending += 1
        day.projectedEarnings += info.cpaDollars * info.rcr
      }
    }

    // Compute summary totals from the date-filtered referral data
    let totalPending = 0
    let totalConfirmed = 0
    let totalRejected = 0
    let totalConfirmedEarnings = 0
    let totalProjectedEarnings = 0
    for (const day of Array.from(dailyMap.values())) {
      totalPending += day.pending
      totalConfirmed += day.confirmed
      totalRejected += day.rejected
      totalConfirmedEarnings += day.confirmedEarnings
      totalProjectedEarnings += day.projectedEarnings
    }

    // Convert to array
    const dailyStats: DailyStats[] = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      pending: stats.pending,
      confirmed: stats.confirmed,
      rejected: stats.rejected,
      projectedEarnings: Math.round(stats.projectedEarnings * 100) / 100,
      confirmedEarnings: Math.round(stats.confirmedEarnings * 100) / 100,
      newPending: stats.newPending,
    }))

    // Get top earning recommendations
    const { data: topRecs } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('publication_name, publication_logo, our_confirms, sparkloop_earnings')
      .eq('publication_id', PUBLICATION_ID)
      .gt('sparkloop_earnings', 0)
      .order('sparkloop_earnings', { ascending: false })
      .limit(9)

    return NextResponse.json({
      success: true,
      summary: {
        totalPending,
        totalConfirmed,
        totalRejected,
        totalSubscribes: totalPending + totalConfirmed + totalRejected,
        totalEarnings: Math.round(totalConfirmedEarnings * 100) / 100,
        projectedFromPending: Math.round(totalProjectedEarnings * 100) / 100,
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
