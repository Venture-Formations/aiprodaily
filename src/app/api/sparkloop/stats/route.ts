import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
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
 *
 * Confirmed/rejected counts come from daily snapshot deltas (sparkloop_daily_snapshots),
 * NOT from sparkloop_referrals.status — SparkLoop doesn't send per-subscriber
 * confirm/reject webhooks for outbound referrals. The sync process records aggregate
 * confirmed/rejected totals per recommendation; we diff consecutive snapshots to get
 * daily deltas and assign confirmed earnings using a CPA-weighted average across
 * recommendations that had confirms that day.
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'sparkloop/stats' },
  async ({ request, logger }) => {
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

    // Get all recommendations with CPA, RCR, and screening_period data
    const { data: recommendations } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('ref_code, publication_name, publication_logo, cpa, sparkloop_rcr, override_rcr, sparkloop_confirmed, sparkloop_rejected, sparkloop_pending, sparkloop_earnings, screening_period')
      .eq('publication_id', PUBLICATION_ID)

    // Build a lookup: ref_code -> { cpaDollars, rcr, screeningPeriod }
    const recLookup = new Map<string, { cpaDollars: number; rcr: number; screeningPeriod: number }>()
    for (const rec of recommendations || []) {
      const cpaDollars = (rec.cpa || 0) / 100
      const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) : null
      const hasSLRcr = slRcr !== null && slRcr > 0
      const hasOverrideRcr = rec.override_rcr !== null && rec.override_rcr !== undefined
      const rcr = hasOverrideRcr ? Number(rec.override_rcr) / 100
        : hasSLRcr ? slRcr! / 100
        : defaultRcr
      recLookup.set(rec.ref_code, { cpaDollars, rcr, screeningPeriod: rec.screening_period || 14 })
    }

    const pageSize = 1000

    // Get all referrals in the date range — used for daily subscribe counts only
    let referrals: { ref_code: string; subscribed_at: string }[] = []
    let pageFrom = 0
    while (true) {
      const { data: page } = await supabaseAdmin
        .from('sparkloop_referrals')
        .select('ref_code, subscribed_at')
        .eq('publication_id', PUBLICATION_ID)
        .in('source', ['custom_popup', 'recs_page', 'newsletter_module'])
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
      subscribes: number
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
      dailyMap.set(dateKey, { subscribes: 0, confirmed: 0, rejected: 0, projectedEarnings: 0, confirmedEarnings: 0, newPending: null })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Fetch daily snapshots — need day before fromDate to compute deltas for the first day
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

    // Compute daily deltas from snapshots: new pending, confirmed, rejected
    // Confirmed/rejected are backdated by the recommendation's screening_period
    // so they appear on the day the subscriber originally signed up, not the day
    // SparkLoop reported the result.
    const newPendingByDate = new Map<string, number>()
    const confirmedByDate = new Map<string, number>()
    const rejectedByDate = new Map<string, number>()
    const confirmedEarningsByDate = new Map<string, number>()
    // Per-recommendation totals within the date range (for top earners)
    const confirmedByRef = new Map<string, number>()
    const earningsByRef = new Map<string, number>()

    // Helper to subtract N days from a YYYY-MM-DD string
    const subtractDays = (dateStr: string, days: number): string => {
      const d = new Date(dateStr + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() - days)
      return d.toISOString().split('T')[0]
    }

    Array.from(snapshotsByRefCode.entries()).forEach(([refCode, refMap]) => {
      const dates = Array.from(refMap.keys()).sort()
      const info = recLookup.get(refCode) || { cpaDollars: 0, rcr: defaultRcr, screeningPeriod: 14 }

      for (let i = 1; i < dates.length; i++) {
        const prev = refMap.get(dates[i - 1])!
        const curr = refMap.get(dates[i])!
        const currDate = dates[i]

        // New pending = total new referrals entering the system (shown on snapshot date)
        const newPendingDelta = (curr.pending - prev.pending) + (curr.confirmed - prev.confirmed) + (curr.rejected - prev.rejected)
        newPendingByDate.set(currDate, (newPendingByDate.get(currDate) || 0) + newPendingDelta)

        // Confirmed/rejected deltas — backdate by screening period
        // A confirm reported on Mar 4 with 14-day screening → subscriber from ~Feb 18
        const confirmDelta = Math.max(0, curr.confirmed - prev.confirmed)
        const rejectDelta = Math.max(0, curr.rejected - prev.rejected)
        const attributionDate = subtractDays(currDate, info.screeningPeriod)

        if (confirmDelta > 0) {
          confirmedByDate.set(attributionDate, (confirmedByDate.get(attributionDate) || 0) + confirmDelta)
          confirmedEarningsByDate.set(attributionDate, (confirmedEarningsByDate.get(attributionDate) || 0) + (confirmDelta * info.cpaDollars))
          // Accumulate per-recommendation totals for top earners (only if attribution date is in range)
          if (dailyMap.has(attributionDate)) {
            confirmedByRef.set(refCode, (confirmedByRef.get(refCode) || 0) + confirmDelta)
            earningsByRef.set(refCode, (earningsByRef.get(refCode) || 0) + (confirmDelta * info.cpaDollars))
          }
        }
        if (rejectDelta > 0) {
          rejectedByDate.set(attributionDate, (rejectedByDate.get(attributionDate) || 0) + rejectDelta)
        }
      }
    })

    // Apply snapshot deltas to daily map
    Array.from(newPendingByDate.entries()).forEach(([dateKey, delta]) => {
      if (dailyMap.has(dateKey)) {
        dailyMap.get(dateKey)!.newPending = Math.max(0, delta)
      }
    })
    Array.from(confirmedByDate.entries()).forEach(([dateKey, count]) => {
      if (dailyMap.has(dateKey)) {
        dailyMap.get(dateKey)!.confirmed = count
      }
    })
    Array.from(rejectedByDate.entries()).forEach(([dateKey, count]) => {
      if (dailyMap.has(dateKey)) {
        dailyMap.get(dateKey)!.rejected = count
      }
    })
    Array.from(confirmedEarningsByDate.entries()).forEach(([dateKey, earnings]) => {
      if (dailyMap.has(dateKey)) {
        dailyMap.get(dateKey)!.confirmedEarnings = earnings
      }
    })

    // Count subscribes per day and compute projected earnings for pending referrals
    for (const ref of referrals) {
      const dateKey = ref.subscribed_at?.split('T')[0]
      if (!dateKey || !dailyMap.has(dateKey)) continue

      const day = dailyMap.get(dateKey)!
      const info = recLookup.get(ref.ref_code) || { cpaDollars: 0, rcr: defaultRcr }

      day.subscribes += 1
      day.projectedEarnings += info.cpaDollars * info.rcr
    }

    // Compute summary totals
    // Use aggregate sparkloop_confirmed/rejected/pending from recommendations (source of truth)
    let aggConfirmed = 0
    let aggRejected = 0
    let aggPending = 0
    for (const rec of recommendations || []) {
      aggConfirmed += rec.sparkloop_confirmed || 0
      aggRejected += rec.sparkloop_rejected || 0
      aggPending += rec.sparkloop_pending || 0
    }

    // Sum daily chart totals within the selected date range
    let totalConfirmedInRange = 0
    let totalRejectedInRange = 0
    let totalSubscribesInRange = 0
    let totalConfirmedEarnings = 0
    let totalProjectedEarnings = 0
    Array.from(dailyMap.values()).forEach(day => {
      totalConfirmedInRange += day.confirmed
      totalRejectedInRange += day.rejected
      totalSubscribesInRange += day.subscribes
      totalConfirmedEarnings += day.confirmedEarnings
      totalProjectedEarnings += day.projectedEarnings
    })

    // Pending in range = subscribes - confirmed - rejected (within the date window)
    const totalPendingInRange = Math.max(0, totalSubscribesInRange - totalConfirmedInRange - totalRejectedInRange)

    // Convert to array — "pending" bar shows subscribes (all start as pending)
    const dailyStats: DailyStats[] = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      pending: stats.subscribes,
      confirmed: stats.confirmed,
      rejected: stats.rejected,
      projectedEarnings: Math.round(stats.projectedEarnings * 100) / 100,
      confirmedEarnings: Math.round(stats.confirmedEarnings * 100) / 100,
      newPending: stats.newPending,
    }))

    // Build top earners from in-range snapshot deltas
    const recNameLookup = new Map<string, { name: string; logo: string | null }>()
    for (const rec of recommendations || []) {
      recNameLookup.set(rec.ref_code, {
        name: rec.publication_name || rec.ref_code,
        logo: rec.publication_logo || null,
      })
    }
    const topEarners = Array.from(earningsByRef.entries())
      .filter(([, earnings]) => earnings > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([refCode, earnings]) => ({
        name: recNameLookup.get(refCode)?.name || refCode,
        logo: recNameLookup.get(refCode)?.logo || null,
        referrals: confirmedByRef.get(refCode) || 0,
        earnings: Math.round(earnings * 100) / 100,
      }))

    return NextResponse.json({
      success: true,
      summary: {
        totalPending: aggPending,
        totalConfirmed: aggConfirmed,
        totalRejected: aggRejected,
        totalSubscribes: aggPending + aggConfirmed + aggRejected,
        totalEarnings: Math.round(totalConfirmedEarnings * 100) / 100,
        projectedFromPending: Math.round(totalProjectedEarnings * 100) / 100,
      },
      dailyStats,
      topEarners,
      dateRange: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
      },
    })
  }
)
