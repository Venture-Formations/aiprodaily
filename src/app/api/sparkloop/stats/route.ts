import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { getPublicationSettings } from '@/lib/publication-settings'
import { PUBLICATION_ID } from '@/lib/config'
import { toLocalDateStr as toDateStr, buildDateRangeBoundaries, getTodayStr, getDaysAgoStr, type SupportedTz } from '@/lib/date-utils'
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
export const maxDuration = 60

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'sparkloop/stats' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '30') || 30))
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    const tz = (searchParams.get('tz') || 'CST') as SupportedTz

    // Calculate date range (DST-aware via buildDateRangeBoundaries)
    let fromDate: Date
    let toDate: Date

    if (startDate && endDate) {
      const bounds = buildDateRangeBoundaries(startDate, endDate, tz)
      fromDate = bounds.startDate
      toDate = bounds.endDate
    } else {
      const todayStr = getTodayStr(tz)
      const fromStr = getDaysAgoStr(days, tz)
      const bounds = buildDateRangeBoundaries(fromStr, todayStr, tz)
      fromDate = bounds.startDate
      toDate = bounds.endDate
    }

    // Load default RCR from publication_settings
    const defaults = await getPublicationSettings(PUBLICATION_ID, [
      'sparkloop_default_rcr',
    ])
    const defaultRcr = defaults.sparkloop_default_rcr
      ? parseFloat(defaults.sparkloop_default_rcr) / 100
      : FALLBACK_DEFAULT_RCR / 100

    // Get all recommendations with CPA, RCR, screening_period, and override_slip
    const { data: recommendations } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('ref_code, publication_name, publication_logo, cpa, sparkloop_rcr, override_rcr, override_slip, sparkloop_confirmed, sparkloop_rejected, sparkloop_pending, sparkloop_earnings, screening_period')
      .eq('publication_id', PUBLICATION_ID)

    // --- Compute AT Slip % per recommendation (same logic as admin route) ---
    const today = new Date()

    // Group ref_codes by screening period for matured-sends query
    const screeningGroups = new Map<number, string[]>()
    for (const rec of recommendations || []) {
      const s = rec.screening_period || 14
      if (!screeningGroups.has(s)) screeningGroups.set(s, [])
      screeningGroups.get(s)!.push(rec.ref_code)
    }

    // Count matured sends (subscribed > S days ago) per ref_code
    const maturedSendsByRefCode = new Map<string, number>()
    const firstSendByRefCode = new Map<string, string>()
    const slipPageSize = 1000
    await Promise.all(
      Array.from(screeningGroups.entries()).map(async ([s, refCodes]) => {
        const cutoff = new Date(today)
        cutoff.setDate(cutoff.getDate() - s)
        const cutoffStr = cutoff.toISOString().split('T')[0] + 'T23:59:59.999Z'

        let offset = 0
        const counts = new Map<string, number>()
        while (true) {
          const { data: page, error: pageErr } = await supabaseAdmin
            .from('sparkloop_referrals')
            .select('ref_code, subscribed_at')
            .eq('publication_id', PUBLICATION_ID)
            .in('ref_code', refCodes)
            .lte('subscribed_at', cutoffStr)
            .order('subscribed_at', { ascending: true })
            .order('ref_code', { ascending: true })
            .range(offset, offset + slipPageSize - 1)
          if (pageErr) { logger.error({ error: pageErr }, 'Matured sends query failed'); break }
          if (!page || page.length === 0) break
          for (const row of page) {
            counts.set(row.ref_code, (counts.get(row.ref_code) || 0) + 1)
            const existing = firstSendByRefCode.get(row.ref_code)
            if (!existing || row.subscribed_at < existing) {
              firstSendByRefCode.set(row.ref_code, row.subscribed_at)
            }
          }
          if (page.length < slipPageSize) break
          offset += slipPageSize
        }
        counts.forEach((count, rc) => {
          maturedSendsByRefCode.set(rc, count)
        })
      })
    )

    // Fetch daily snapshots for delta-based confirms/rejects — bounded by earliest first send
    type SnapRow = { ref_code: string; snapshot_date: string; sparkloop_confirmed: number; sparkloop_rejected: number }
    const allSnapshots: SnapRow[] = []
    // Compute lower bound: earliest firstSend date (or 180 days fallback)
    const earliestFirstSend = firstSendByRefCode.size > 0
      ? Array.from(firstSendByRefCode.values()).reduce((min, d) => (d < min ? d : min))
      : null
    const snapLowerBound = earliestFirstSend
      ? earliestFirstSend.split('T')[0]
      : toDateStr(new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000))

    let snapOffset = 0
    while (true) {
      const { data: page, error: snapErr } = await supabaseAdmin
        .from('sparkloop_daily_snapshots')
        .select('ref_code, snapshot_date, sparkloop_confirmed, sparkloop_rejected')
        .eq('publication_id', PUBLICATION_ID)
        .gte('snapshot_date', snapLowerBound)
        .order('snapshot_date', { ascending: true })
        .range(snapOffset, snapOffset + slipPageSize - 1)
      if (snapErr) { logger.error({ error: snapErr }, 'AT slip snapshot query failed'); break }
      if (!page || page.length === 0) break
      allSnapshots.push(...(page as SnapRow[]))
      if (page.length < slipPageSize) break
      snapOffset += slipPageSize
    }

    // Group snapshots by ref_code
    const snapsByRefCode = new Map<string, SnapRow[]>()
    for (const snap of allSnapshots) {
      if (!snapsByRefCode.has(snap.ref_code)) snapsByRefCode.set(snap.ref_code, [])
      snapsByRefCode.get(snap.ref_code)!.push(snap)
    }

    // Compute AT slip data per ref_code
    const slipDataByRefCode = new Map<string, { confirmsGained: number; rejectsGained: number }>()
    for (const rec of recommendations || []) {
      const s = rec.screening_period || 14
      const snaps = snapsByRefCode.get(rec.ref_code)
      if (!snaps || snaps.length < 2) continue

      const firstSend = firstSendByRefCode.get(rec.ref_code)
      if (!firstSend) continue

      const baselineDate = new Date(firstSend)
      baselineDate.setDate(baselineDate.getDate() + s)
      const baselineDateStr = baselineDate.toISOString().split('T')[0]

      let baselineSnap: SnapRow | null = null
      for (let i = 1; i < snaps.length; i++) {
        if (snaps[i].snapshot_date >= baselineDateStr) {
          baselineSnap = snaps[i]
          break
        }
      }
      if (!baselineSnap) continue

      const latestSnap = snaps[snaps.length - 1]
      slipDataByRefCode.set(rec.ref_code, {
        confirmsGained: Math.max(0, latestSnap.sparkloop_confirmed - baselineSnap.sparkloop_confirmed),
        rejectsGained: Math.max(0, latestSnap.sparkloop_rejected - baselineSnap.sparkloop_rejected),
      })
    }

    // Build a lookup: ref_code -> { cpaDollars, rcr, nonSlipRate, screeningPeriod, name, logo }
    // Projected earnings per pending referral = CPA × RCR × (1 - AT Slip %)
    const recLookup = new Map<string, { cpaDollars: number; rcr: number; nonSlipRate: number; screeningPeriod: number; name: string; logo: string | null }>()
    for (const rec of recommendations || []) {
      const cpaDollars = (rec.cpa || 0) / 100

      // RCR: override > SparkLoop > default
      const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) : null
      const hasSLRcr = slRcr !== null && slRcr > 0
      const hasOverrideRcr = rec.override_rcr !== null && rec.override_rcr !== undefined
      const rcr = hasOverrideRcr ? Number(rec.override_rcr) / 100
        : hasSLRcr ? slRcr! / 100
        : defaultRcr

      // AT non-slip rate: 1 - (slipped / maturedSends)
      const maturedSends = maturedSendsByRefCode.get(rec.ref_code) || 0
      const slipData = slipDataByRefCode.get(rec.ref_code)
      const confirmsGained = slipData?.confirmsGained ?? 0
      const rejectsGained = slipData?.rejectsGained ?? 0
      const nonSlipRate = maturedSends > 0
        ? Math.min(1, (confirmsGained + rejectsGained) / maturedSends)
        : 1  // no slip data yet, assume no slippage

      recLookup.set(rec.ref_code, {
        cpaDollars, rcr, nonSlipRate, screeningPeriod: rec.screening_period || 14,
        name: rec.publication_name || rec.ref_code,
        logo: rec.publication_logo || null,
      })
    }

    const pageSize = 1000

    // Get all referrals in the date range — used for daily subscribe counts only
    let referrals: { ref_code: string; subscribed_at: string }[] = []
    let pageFrom = 0
    while (true) {
      const { data: page, error: refErr } = await supabaseAdmin
        .from('sparkloop_referrals')
        .select('ref_code, subscribed_at')
        .eq('publication_id', PUBLICATION_ID)
        .in('source', ['custom_popup', 'recs_page', 'newsletter_module'])
        .gte('subscribed_at', fromDate.toISOString())
        .lte('subscribed_at', toDate.toISOString())
        .order('subscribed_at', { ascending: true })
        .order('ref_code', { ascending: true })
        .range(pageFrom, pageFrom + pageSize - 1)
      if (refErr) { logger.error({ error: refErr }, 'Referrals query failed'); break }
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
      const dateKey = toDateStr(currentDate)
      dailyMap.set(dateKey, { subscribes: 0, confirmed: 0, rejected: 0, projectedEarnings: 0, confirmedEarnings: 0, newPending: null })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Fetch daily snapshots — need day before fromDate to compute deltas for the first day
    const snapshotFromDate = new Date(fromDate)
    snapshotFromDate.setDate(snapshotFromDate.getDate() - 1)
    let snapshots: { ref_code: string; snapshot_date: string; sparkloop_pending: number; sparkloop_confirmed: number; sparkloop_rejected: number; sparkloop_earnings: number }[] = []
    let snapPageFrom = 0
    while (true) {
      const { data: snapPage, error: chartSnapErr } = await supabaseAdmin
        .from('sparkloop_daily_snapshots')
        .select('ref_code, snapshot_date, sparkloop_pending, sparkloop_confirmed, sparkloop_rejected, sparkloop_earnings')
        .eq('publication_id', PUBLICATION_ID)
        .gte('snapshot_date', toDateStr(snapshotFromDate))
        .lte('snapshot_date', toDateStr(toDate))
        .order('snapshot_date', { ascending: true })
        .order('ref_code', { ascending: true })
        .range(snapPageFrom, snapPageFrom + pageSize - 1)
      if (chartSnapErr) { logger.error({ error: chartSnapErr }, 'Chart snapshot query failed'); break }
      if (!snapPage || snapPage.length === 0) break
      snapshots = snapshots.concat(snapPage)
      if (snapPage.length < pageSize) break
      snapPageFrom += pageSize
    }

    // Group snapshots by ref_code, then by date
    const snapshotsByRefCode = new Map<string, Map<string, { pending: number; confirmed: number; rejected: number; earnings: number }>>()
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
        earnings: snap.sparkloop_earnings || 0,
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
      const [year, month, day] = dateStr.split('-').map(Number)
      const d = new Date(year, month - 1, day) // Local constructor avoids UTC parse
      d.setDate(d.getDate() - days)
      return toDateStr(d)
    }

    Array.from(snapshotsByRefCode.entries()).forEach(([refCode, refMap]) => {
      const dates = Array.from(refMap.keys()).sort()
      const info = recLookup.get(refCode) || { cpaDollars: 0, rcr: defaultRcr, nonSlipRate: 1, screeningPeriod: 14 }

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
          // Use actual SparkLoop earnings delta when available, fall back to confirms × CPA
          const earningsDelta = Math.max(0, (curr.earnings || 0) - (prev.earnings || 0))
          const earningsForDay = earningsDelta > 0 ? earningsDelta / 100 : confirmDelta * info.cpaDollars
          confirmedEarningsByDate.set(attributionDate, (confirmedEarningsByDate.get(attributionDate) || 0) + earningsForDay)
          // Accumulate per-recommendation totals for top earners (only if attribution date is in range)
          if (dailyMap.has(attributionDate)) {
            confirmedByRef.set(refCode, (confirmedByRef.get(refCode) || 0) + confirmDelta)
            earningsByRef.set(refCode, (earningsByRef.get(refCode) || 0) + earningsForDay)
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

    // Count subscribes per day and compute projected earnings for pending referrals.
    // Only referrals still within their screening period are "pending" and contribute
    // to projected earnings. Matured referrals have already been confirmed/rejected/slipped.
    const todayTime = today.getTime()
    for (const ref of referrals) {
      const dateKey = ref.subscribed_at?.split('T')[0]
      if (!dateKey || !dailyMap.has(dateKey)) continue

      const day = dailyMap.get(dateKey)!
      const info = recLookup.get(ref.ref_code) || { cpaDollars: 0, rcr: defaultRcr, nonSlipRate: 1, screeningPeriod: 14 }

      day.subscribes += 1

      // Only project earnings for referrals still in screening period
      const subscribedAt = new Date(ref.subscribed_at).getTime()
      const daysSinceSend = (todayTime - subscribedAt) / (1000 * 60 * 60 * 24)
      if (daysSinceSend <= info.screeningPeriod) {
        day.projectedEarnings += info.cpaDollars * info.rcr * info.nonSlipRate
      }
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

    // Convert to array — pending = subscribes that haven't been confirmed or rejected yet
    const dailyStats: DailyStats[] = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      pending: Math.max(0, stats.subscribes - stats.confirmed - stats.rejected),
      confirmed: stats.confirmed,
      rejected: stats.rejected,
      projectedEarnings: Math.round(stats.projectedEarnings * 100) / 100,
      confirmedEarnings: Math.round(stats.confirmedEarnings * 100) / 100,
      newPending: stats.newPending,
    }))

    // Build top earners from in-range snapshot deltas
    const topEarners = Array.from(earningsByRef.entries())
      .filter(([, earnings]) => earnings > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([refCode, earnings]) => {
        const info = recLookup.get(refCode)
        return {
          name: info?.name || refCode,
          logo: info?.logo || null,
          referrals: confirmedByRef.get(refCode) || 0,
          earnings: Math.round(earnings * 100) / 100,
        }
      })

    logger.info({
      recommendations: recommendations?.length ?? 0,
      slipSnapshots: allSnapshots.length,
      chartSnapshots: snapshots.length,
      referrals: referrals.length,
    }, 'Stats request complete')

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
        from: toDateStr(fromDate),
        to: toDateStr(toDate),
      },
    })
  }
)
