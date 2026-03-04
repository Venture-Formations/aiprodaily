import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'
const PAGE_SIZE = 1000

/**
 * GET /api/sparkloop/admin/daterange
 *
 * Returns per-ref_code metrics filtered by date range.
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'sparkloop/admin/daterange' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json(
        { success: false, error: 'start and end date params required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const startDate = `${start}T00:00:00.000Z`
    const endDate = `${end}T23:59:59.999Z`

    // 1. Impressions: popup_opened events in range (split by source) - paginated
    let popupEvents: { raw_payload: Record<string, unknown> | null }[] = []
    let pageFrom = 0
    while (true) {
      const { data: page, error } = await supabaseAdmin
        .from('sparkloop_events')
        .select('raw_payload')
        .eq('publication_id', PUBLICATION_ID)
        .eq('event_type', 'popup_opened')
        .gte('event_timestamp', startDate)
        .lte('event_timestamp', endDate)
        .range(pageFrom, pageFrom + PAGE_SIZE - 1)
      if (error) throw new Error(`Popup events query failed: ${error.message}`)
      if (!page || page.length === 0) break
      popupEvents = popupEvents.concat(page)
      if (page.length < PAGE_SIZE) break
      pageFrom += PAGE_SIZE
    }

    const impressionsByRef: Record<string, number> = {}
    const pageImpressionsByRef: Record<string, number> = {}
    for (const evt of popupEvents) {
      const payload = evt.raw_payload
      const refCodes = payload?.ref_codes as string[] | null
      const source = payload?.source as string | null
      if (refCodes) {
        const target = source === 'recs_page' ? pageImpressionsByRef : impressionsByRef
        for (const rc of refCodes) {
          target[rc] = (target[rc] || 0) + 1
        }
      }
    }

    // 2. Referrals in date range (by subscribed_at), split by source — for submission counts
    let referrals: { ref_code: string; source: string }[] = []
    pageFrom = 0
    while (true) {
      const { data: page, error } = await supabaseAdmin
        .from('sparkloop_referrals')
        .select('ref_code, source')
        .eq('publication_id', PUBLICATION_ID)
        .in('source', ['custom_popup', 'recs_page', 'newsletter_module'])
        .gte('subscribed_at', startDate)
        .lte('subscribed_at', endDate)
        .range(pageFrom, pageFrom + PAGE_SIZE - 1)
      if (error) throw new Error(`Referrals query failed: ${error.message}`)
      if (!page || page.length === 0) break
      referrals = referrals.concat(page)
      if (page.length < PAGE_SIZE) break
      pageFrom += PAGE_SIZE
    }

    // Count submissions per ref_code per source
    const refSubmissions: Record<string, number> = {}
    const pageRefSubmissions: Record<string, number> = {}
    for (const r of referrals) {
      const target = r.source === 'recs_page' ? pageRefSubmissions : refSubmissions
      target[r.ref_code] = (target[r.ref_code] || 0) + 1
    }

    // 2b. Confirmed/rejected from daily snapshot deltas, backdated by screening period.
    // For subscribers who signed up during [start, end], their confirms/rejects arrive
    // at [start + screening_period, end + screening_period]. We need snapshot data for
    // that shifted window per recommendation.
    //
    // Fetch screening_period per recommendation
    const { data: recScreening } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('ref_code, screening_period')
      .eq('publication_id', PUBLICATION_ID)

    const screeningByRef: Record<string, number> = {}
    for (const rec of recScreening || []) {
      screeningByRef[rec.ref_code] = rec.screening_period || 14
    }

    // Determine the widest snapshot window we need (max screening period)
    const allScreeningPeriods = Object.values(screeningByRef)
    const maxScreening = allScreeningPeriods.length > 0 ? Math.max(...allScreeningPeriods) : 14
    const todayStr = new Date().toISOString().split('T')[0]

    // We need snapshots from (start - 1) to (end + maxScreening), capped at today
    const snapStartDate = new Date(start)
    snapStartDate.setDate(snapStartDate.getDate() - 1)
    const snapStartStr = snapStartDate.toISOString().split('T')[0]

    const snapEndDate = new Date(end)
    snapEndDate.setDate(snapEndDate.getDate() + maxScreening)
    const snapEndStr = snapEndDate.toISOString().split('T')[0] < todayStr
      ? snapEndDate.toISOString().split('T')[0]
      : todayStr

    let snapshots: { ref_code: string; snapshot_date: string; sparkloop_confirmed: number; sparkloop_rejected: number }[] = []
    let snapPageFrom = 0
    while (true) {
      const { data: snapPage } = await supabaseAdmin
        .from('sparkloop_daily_snapshots')
        .select('ref_code, snapshot_date, sparkloop_confirmed, sparkloop_rejected')
        .eq('publication_id', PUBLICATION_ID)
        .gte('snapshot_date', snapStartStr)
        .lte('snapshot_date', snapEndStr)
        .order('snapshot_date', { ascending: true })
        .range(snapPageFrom, snapPageFrom + PAGE_SIZE - 1)
      if (!snapPage || snapPage.length === 0) break
      snapshots = snapshots.concat(snapPage)
      if (snapPage.length < PAGE_SIZE) break
      snapPageFrom += PAGE_SIZE
    }

    // Group snapshots by ref_code -> date -> { confirmed, rejected }
    const snapshotsByRefCode: Record<string, Record<string, { confirmed: number; rejected: number }>> = {}
    for (const snap of snapshots) {
      if (!snapshotsByRefCode[snap.ref_code]) {
        snapshotsByRefCode[snap.ref_code] = {}
      }
      snapshotsByRefCode[snap.ref_code][snap.snapshot_date] = {
        confirmed: snap.sparkloop_confirmed || 0,
        rejected: snap.sparkloop_rejected || 0,
      }
    }

    // Helper to find nearest snapshot on or before a date
    const findSnapshot = (refSnapshots: Record<string, { confirmed: number; rejected: number }>, targetDate: string): { confirmed: number; rejected: number } | null => {
      const dates = Object.keys(refSnapshots).sort()
      // Find the last date <= targetDate
      let best: string | null = null
      for (const d of dates) {
        if (d <= targetDate) best = d
        else break
      }
      return best ? refSnapshots[best] : null
    }

    // Compute per-ref_code confirms/rejections
    // For each rec: snapshot at (start + screening - 1) vs snapshot at min(end + screening, today)
    const refMetrics: Record<string, {
      submissions: number
      confirms: number
      rejections: number
      pending: number
    }> = {}

    const pageRefMetrics: Record<string, {
      submissions: number
      confirms: number
      rejections: number
      pending: number
    }> = {}

    // Get all ref_codes that have either submissions or snapshot data
    const snapshotRefCodes = Array.from(new Set([
      ...Object.keys(refSubmissions),
      ...Object.keys(pageRefSubmissions),
      ...Object.keys(snapshotsByRefCode),
    ]))

    for (const refCode of snapshotRefCodes) {
      const screening = screeningByRef[refCode] || 14
      const refSnapshots = snapshotsByRefCode[refCode] || {}

      // "Before" snapshot: day before (start + screening)
      const beforeDate = new Date(start)
      beforeDate.setDate(beforeDate.getDate() + screening - 1)
      const beforeDateStr = beforeDate.toISOString().split('T')[0]

      // "After" snapshot: (end + screening), capped at today
      const afterDate = new Date(end)
      afterDate.setDate(afterDate.getDate() + screening)
      const afterDateStr = afterDate.toISOString().split('T')[0] < todayStr
        ? afterDate.toISOString().split('T')[0]
        : todayStr

      const beforeSnap = findSnapshot(refSnapshots, beforeDateStr)
      const afterSnap = findSnapshot(refSnapshots, afterDateStr)

      const beforeConfirmed = beforeSnap?.confirmed ?? 0
      const beforeRejected = beforeSnap?.rejected ?? 0
      const afterConfirmed = afterSnap?.confirmed ?? beforeConfirmed
      const afterRejected = afterSnap?.rejected ?? beforeRejected

      const confirms = Math.max(0, afterConfirmed - beforeConfirmed)
      const rejections = Math.max(0, afterRejected - beforeRejected)

      const subs = refSubmissions[refCode] || 0
      refMetrics[refCode] = {
        submissions: subs,
        confirms,
        rejections,
        pending: Math.max(0, subs - confirms - rejections),
      }

      const pageSubs = pageRefSubmissions[refCode] || 0
      if (pageSubs > 0) {
        pageRefMetrics[refCode] = {
          submissions: pageSubs,
          confirms: 0,
          rejections: 0,
          pending: pageSubs,
        }
      }
    }

    // 3. Unique IPs from api_subscribe_confirmed events in range - paginated
    let subscribeEvents: { raw_payload: Record<string, unknown> | null }[] = []
    pageFrom = 0
    while (true) {
      const { data: page } = await supabaseAdmin
        .from('sparkloop_events')
        .select('raw_payload')
        .eq('publication_id', PUBLICATION_ID)
        .eq('event_type', 'api_subscribe_confirmed')
        .gte('event_timestamp', startDate)
        .lte('event_timestamp', endDate)
        .range(pageFrom, pageFrom + PAGE_SIZE - 1)
      if (!page || page.length === 0) break
      subscribeEvents = subscribeEvents.concat(page)
      if (page.length < PAGE_SIZE) break
      pageFrom += PAGE_SIZE
    }

    let uniqueIps = 0
    if (subscribeEvents.length > 0) {
      const ips = new Set<string>()
      for (const evt of subscribeEvents) {
        const payload = evt.raw_payload
        const ipHash = payload?.ip_hash as string | null
        if (ipHash) ips.add(ipHash)
      }
      uniqueIps = ips.size
    }

    // 4. Avg offers selected from subscriptions_success events in range - paginated
    let successEvents: { raw_payload: Record<string, unknown> | null }[] = []
    pageFrom = 0
    while (true) {
      const { data: page } = await supabaseAdmin
        .from('sparkloop_events')
        .select('raw_payload')
        .eq('publication_id', PUBLICATION_ID)
        .eq('event_type', 'subscriptions_success')
        .gte('event_timestamp', startDate)
        .lte('event_timestamp', endDate)
        .range(pageFrom, pageFrom + PAGE_SIZE - 1)
      if (!page || page.length === 0) break
      successEvents = successEvents.concat(page)
      if (page.length < PAGE_SIZE) break
      pageFrom += PAGE_SIZE
    }

    let avgOffersSelected = 0
    if (successEvents.length > 0) {
      let totalSelected = 0
      let countWithData = 0
      for (const evt of successEvents) {
        const payload = evt.raw_payload
        const selected = payload?.selected_count as number | undefined
        if (selected !== undefined && selected !== null) {
          totalSelected += selected
          countWithData++
        }
      }
      if (countWithData > 0) {
        avgOffersSelected = Math.round((totalSelected / countWithData) * 100) / 100
      }
    }

    // Merge into single response keyed by ref_code
    const allRefCodes = Array.from(new Set([
      ...Object.keys(impressionsByRef),
      ...Object.keys(refMetrics),
      ...Object.keys(pageImpressionsByRef),
      ...Object.keys(pageRefMetrics),
    ]))

    const metrics: Record<string, {
      impressions: number
      submissions: number
      confirms: number
      rejections: number
      pending: number
      page_impressions: number
      page_submissions: number
    }> = {}

    for (const rc of allRefCodes) {
      metrics[rc] = {
        impressions: impressionsByRef[rc] || 0,
        submissions: refMetrics[rc]?.submissions || 0,
        confirms: refMetrics[rc]?.confirms || 0,
        rejections: refMetrics[rc]?.rejections || 0,
        pending: refMetrics[rc]?.pending || 0,
        page_impressions: pageImpressionsByRef[rc] || 0,
        page_submissions: pageRefMetrics[rc]?.submissions || 0,
      }
    }

    logger.info({ start, end, popupEvents: popupEvents.length, referrals: referrals.length, uniqueIps }, 'Date range query completed')

    return NextResponse.json({
      success: true,
      metrics,
      dateRange: { start, end },
      rangeStats: {
        uniqueIps,
        avgOffersSelected,
      },
    })
  }
)
