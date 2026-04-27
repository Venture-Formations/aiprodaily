import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { buildDateRangeBoundaries, toLocalDateStr, type SupportedTz } from '@/lib/date-utils'

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16)
}
const PAGE_SIZE = 1000

/**
 * GET /api/sparkloop/admin/daterange
 *
 * Returns per-ref_code metrics filtered by date range.
 */
export const maxDuration = 60

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'sparkloop/admin/daterange', requirePublicationId: true },
  async ({ request, publicationId, logger }) => {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const tz = (searchParams.get('tz') || 'CST') as SupportedTz

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
    if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
      return NextResponse.json(
        { success: false, error: 'start and end must be YYYY-MM-DD format' },
        { status: 400 }
      )
    }
    if (new Date(start) > new Date(end)) {
      return NextResponse.json(
        { success: false, error: 'end must be >= start' },
        { status: 400 }
      )
    }

    const { startDate: startDateObj, endDate: endDateObj } = buildDateRangeBoundaries(start, end, tz)
    const startDate = startDateObj.toISOString()
    const endDate = endDateObj.toISOString()

    // 1a. Get subscriptions_success events (confirmed email hashes + avg offers selected in one pass)
    const confirmedEmailHashes = new Set<string>()
    const successEvents: { subscriber_email: string | null; raw_payload: Record<string, unknown> | null }[] = []
    let ceFrom = 0
    while (true) {
      const { data: page, error: ceErr } = await supabaseAdmin
        .from('sparkloop_events')
        .select('subscriber_email, raw_payload')
        .eq('publication_id', publicationId)
        .eq('event_type', 'subscriptions_success')
        .gte('event_timestamp', startDate)
        .lte('event_timestamp', endDate)
        .range(ceFrom, ceFrom + PAGE_SIZE - 1)
      if (ceErr) throw new Error(`Subscriptions success query failed: ${ceErr.message}`)
      if (!page || page.length === 0) break
      for (const evt of page) {
        if (evt.subscriber_email) confirmedEmailHashes.add(hashEmail(evt.subscriber_email))
        successEvents.push(evt)
      }
      if (page.length < PAGE_SIZE) break
      ceFrom += PAGE_SIZE
    }

    // 1b. Impressions: popup_opened events in range (split by source) - paginated
    // Track both raw impressions and confirmed impressions (only from confirmed subscribers)
    let popupEvents: { subscriber_email: string | null; raw_payload: Record<string, unknown> | null }[] = []
    let pageFrom = 0
    while (true) {
      const { data: page, error } = await supabaseAdmin
        .from('sparkloop_events')
        .select('subscriber_email, raw_payload')
        .eq('publication_id', publicationId)
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
    const confirmedImpressionsByRef: Record<string, number> = {}
    const pageImpressionsByRef: Record<string, number> = {}
    const confirmedPageImpressionsByRef: Record<string, number> = {}
    // Track unique emails per ref_code to deduplicate repeat opens
    const seenPopupEmails: Record<string, Set<string>> = {}
    const seenPageEmails: Record<string, Set<string>> = {}
    for (const evt of popupEvents) {
      const payload = evt.raw_payload
      const refCodes = payload?.ref_codes as string[] | null
      const source = payload?.source as string | null
      const emailHash = evt.subscriber_email ? hashEmail(evt.subscriber_email) : null
      const isConfirmed = emailHash ? confirmedEmailHashes.has(emailHash) : false
      if (refCodes && emailHash) {
        const isPage = source === 'recs_page'
        for (const rc of refCodes) {
          if (isPage) {
            if (!seenPageEmails[rc]) seenPageEmails[rc] = new Set()
            if (seenPageEmails[rc].has(emailHash)) continue  // dedupe
            seenPageEmails[rc].add(emailHash)
            pageImpressionsByRef[rc] = (pageImpressionsByRef[rc] || 0) + 1
            if (isConfirmed) confirmedPageImpressionsByRef[rc] = (confirmedPageImpressionsByRef[rc] || 0) + 1
          } else {
            if (!seenPopupEmails[rc]) seenPopupEmails[rc] = new Set()
            if (seenPopupEmails[rc].has(emailHash)) continue  // dedupe
            seenPopupEmails[rc].add(emailHash)
            impressionsByRef[rc] = (impressionsByRef[rc] || 0) + 1
            if (isConfirmed) confirmedImpressionsByRef[rc] = (confirmedImpressionsByRef[rc] || 0) + 1
          }
        }
      }
    }

    // 2. Referrals in date range (by subscribed_at), split by source — for submission counts + unique subs
    let referrals: { ref_code: string; source: string; subscriber_email: string }[] = []
    pageFrom = 0
    while (true) {
      const { data: page, error } = await supabaseAdmin
        .from('sparkloop_referrals')
        .select('ref_code, source, subscriber_email')
        .eq('publication_id', publicationId)
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
      .select('ref_code, screening_period, cpa, sparkloop_rcr, override_rcr')
      .eq('publication_id', publicationId)

    const screeningByRef: Record<string, number> = {}
    const recCpaMap: Record<string, number> = {}
    const recRcrMap: Record<string, number> = {}
    const DEFAULT_RCR = 0.25
    for (const rec of recScreening || []) {
      screeningByRef[rec.ref_code] = rec.screening_period || 14
      recCpaMap[rec.ref_code] = rec.cpa || 0
      // RCR: override > SparkLoop > default
      const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) : null
      const hasOverrideRcr = rec.override_rcr !== null && rec.override_rcr !== undefined
      recRcrMap[rec.ref_code] = hasOverrideRcr ? Number(rec.override_rcr) / 100
        : (slRcr && slRcr > 0) ? slRcr / 100
        : DEFAULT_RCR
    }

    // Determine the widest snapshot window we need (max screening period)
    const allScreeningPeriods = Object.values(screeningByRef)
    const maxScreening = allScreeningPeriods.length > 0 ? Math.max(...allScreeningPeriods) : 14
    const todayStr = toLocalDateStr(new Date())

    // We need snapshots from (start - 1) to (end + maxScreening), capped at today
    const snapStartDate = new Date(start)
    snapStartDate.setDate(snapStartDate.getDate() - 1)
    const snapStartStr = toLocalDateStr(snapStartDate)

    const snapEndDate = new Date(end)
    snapEndDate.setDate(snapEndDate.getDate() + maxScreening)
    const snapEndStr = toLocalDateStr(snapEndDate) < todayStr
      ? toLocalDateStr(snapEndDate)
      : todayStr

    let snapshots: { ref_code: string; snapshot_date: string; sparkloop_confirmed: number; sparkloop_rejected: number }[] = []
    let snapPageFrom = 0
    while (true) {
      const { data: snapPage } = await supabaseAdmin
        .from('sparkloop_daily_snapshots')
        .select('ref_code, snapshot_date, sparkloop_confirmed, sparkloop_rejected, sparkloop_earnings')
        .eq('publication_id', publicationId)
        .gte('snapshot_date', snapStartStr)
        .lte('snapshot_date', snapEndStr)
        .order('snapshot_date', { ascending: true })
        .range(snapPageFrom, snapPageFrom + PAGE_SIZE - 1)
      if (!snapPage || snapPage.length === 0) break
      snapshots = snapshots.concat(snapPage)
      if (snapPage.length < PAGE_SIZE) break
      snapPageFrom += PAGE_SIZE
    }

    // Group snapshots by ref_code -> date -> { confirmed, rejected, earnings }
    const snapshotsByRefCode: Record<string, Record<string, { confirmed: number; rejected: number; earnings: number }>> = {}
    for (const snap of snapshots) {
      if (!snapshotsByRefCode[snap.ref_code]) {
        snapshotsByRefCode[snap.ref_code] = {}
      }
      snapshotsByRefCode[snap.ref_code][snap.snapshot_date] = {
        confirmed: snap.sparkloop_confirmed || 0,
        rejected: snap.sparkloop_rejected || 0,
        earnings: (snap as Record<string, unknown>).sparkloop_earnings as number || 0,
      }
    }

    // Helper to find nearest snapshot on or before a date
    const findSnapshot = (refSnapshots: Record<string, { confirmed: number; rejected: number; earnings: number }>, targetDate: string): { confirmed: number; rejected: number; earnings: number } | null => {
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
      earningsCents: number
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
      const beforeDateStr = toLocalDateStr(beforeDate)

      // "After" snapshot: (end + screening), capped at today
      const afterDate = new Date(end)
      afterDate.setDate(afterDate.getDate() + screening)
      const afterDateStr = toLocalDateStr(afterDate) < todayStr
        ? toLocalDateStr(afterDate)
        : todayStr

      const beforeSnap = findSnapshot(refSnapshots, beforeDateStr)
      const afterSnap = findSnapshot(refSnapshots, afterDateStr)

      const beforeConfirmed = beforeSnap?.confirmed ?? 0
      const beforeRejected = beforeSnap?.rejected ?? 0
      const afterConfirmed = afterSnap?.confirmed ?? beforeConfirmed
      const afterRejected = afterSnap?.rejected ?? beforeRejected

      const confirms = Math.max(0, afterConfirmed - beforeConfirmed)
      const rejections = Math.max(0, afterRejected - beforeRejected)

      // Actual SparkLoop earnings delta for this ref_code in the period
      const beforeEarnings = beforeSnap?.earnings ?? 0
      const afterEarnings = afterSnap?.earnings ?? beforeEarnings
      const earningsDelta = Math.max(0, afterEarnings - beforeEarnings)

      const subs = refSubmissions[refCode] || 0
      refMetrics[refCode] = {
        submissions: subs,
        confirms,
        rejections,
        pending: Math.max(0, subs - confirms - rejections),
        earningsCents: earningsDelta,
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

    // 3. Unique newsletter subscribers (unique emails from popup_opened, excluding recs_page)
    // Already computed from popupEvents — reuse the deduped popup email set
    const uniquePopupEmails = new Set<string>()
    for (const evt of popupEvents) {
      const source = (evt.raw_payload as Record<string, unknown>)?.source as string | null
      if (source !== 'recs_page' && evt.subscriber_email) {
        uniquePopupEmails.add(evt.subscriber_email)
      }
    }
    const uniqueIps = uniquePopupEmails.size

    // 4. Avg offers selected — computed from successEvents already fetched in step 1a
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
      confirmed_impressions: number
      submissions: number
      confirms: number
      rejections: number
      pending: number
      page_impressions: number
      confirmed_page_impressions: number
      page_submissions: number
    }> = {}

    for (const rc of allRefCodes) {
      metrics[rc] = {
        impressions: impressionsByRef[rc] || 0,
        confirmed_impressions: confirmedImpressionsByRef[rc] || 0,
        submissions: refMetrics[rc]?.submissions || 0,
        confirms: refMetrics[rc]?.confirms || 0,
        rejections: refMetrics[rc]?.rejections || 0,
        pending: refMetrics[rc]?.pending || 0,
        page_impressions: pageImpressionsByRef[rc] || 0,
        confirmed_page_impressions: confirmedPageImpressionsByRef[rc] || 0,
        page_submissions: pageRefMetrics[rc]?.submissions || 0,
      }
    }

    // Compute avg value per subscriber:
    // Total net earnings from S=14/15 recs / unique matured impressions from S=14 and S=15 windows.
    // Only include S=14 and S=15 recs (vast majority) to avoid noise from long-screening recs.
    const INCLUDED_SCREENINGS = [14, 15]

    // Sum earnings from included recs
    let totalNetEarnings = 0
    for (const rec of recScreening || []) {
      const s = rec.screening_period || 14
      if (!INCLUDED_SCREENINGS.includes(s)) continue
      const refCode = rec.ref_code
      const refSnapshots = snapshotsByRefCode[refCode] || {}

      const snapStartDate = new Date(start)
      snapStartDate.setDate(snapStartDate.getDate() - 1)
      const beforeSnap = findSnapshot(refSnapshots, toLocalDateStr(snapStartDate))
      const afterSnap = findSnapshot(refSnapshots, end)

      const beforeEarnings = beforeSnap?.earnings ?? 0
      const afterEarnings = afterSnap?.earnings ?? 0
      const prevHasEarnings = beforeEarnings > 0
      const earningsDelta = prevHasEarnings ? Math.max(0, afterEarnings - beforeEarnings) : 0

      if (earningsDelta > 0) {
        totalNetEarnings += (earningsDelta / 100) * (1 - 0.233)
      } else {
        const beforeConfirmed = beforeSnap?.confirmed ?? 0
        const afterConfirmed = afterSnap?.confirmed ?? beforeConfirmed
        const confirmsDelta = Math.max(0, afterConfirmed - beforeConfirmed)
        totalNetEarnings += confirmsDelta * ((recCpaMap[refCode] || 0) / 100) * (1 - 0.233)
      }
    }

    // Count unique matured impressions: subscribers who saw the popup in the matured window.
    // Use a single window from (start - maxS) to (end - minS) to cover all S=14/15 sends
    // that could have matured into confirms during the selected range.
    const maxS = Math.max(...INCLUDED_SCREENINGS)
    const minS = Math.min(...INCLUDED_SCREENINGS)
    const maturedStartDate = new Date(start)
    maturedStartDate.setDate(maturedStartDate.getDate() - maxS)
    const maturedEndDate = new Date(end)
    maturedEndDate.setDate(maturedEndDate.getDate() - minS)
    const maturedBounds = buildDateRangeBoundaries(
      toLocalDateStr(maturedStartDate),
      toLocalDateStr(maturedEndDate),
      tz
    )

    const maturedImpressionEmails = new Set<string>()
    let maturedOffset = 0
    while (true) {
      const { data: page } = await supabaseAdmin
        .from('sparkloop_events')
        .select('subscriber_email, raw_payload')
        .eq('publication_id', publicationId)
        .eq('event_type', 'popup_opened')
        .gte('event_timestamp', maturedBounds.startDate.toISOString())
        .lte('event_timestamp', maturedBounds.endDate.toISOString())
        .range(maturedOffset, maturedOffset + PAGE_SIZE - 1)
      if (!page || page.length === 0) break
      for (const evt of page) {
        if (!evt.subscriber_email) continue
        const payload = evt.raw_payload as Record<string, unknown> | null
        const source = payload?.source as string | null
        if (source === 'recs_page') continue
        maturedImpressionEmails.add(evt.subscriber_email)
      }
      if (page.length < PAGE_SIZE) break
      maturedOffset += PAGE_SIZE
    }


    const avgValuePerSubscriber = maturedImpressionEmails.size > 0
      ? Math.round((totalNetEarnings / maturedImpressionEmails.size) * 100) / 100
      : 0

    // Unique subscribers = unique emails that saw the popup (newsletter subscribers in the range)
    const uniqueSubscribers = uniquePopupEmails.size
    // Unique sends = unique emails that subscribed to at least one SL recommendation
    const uniqueSends = new Set(referrals.map(r => r.subscriber_email)).size

    logger.info({ start, end, popupEvents: popupEvents.length, referrals: referrals.length, uniqueIps }, 'Date range query completed')

    return NextResponse.json({
      success: true,
      metrics,
      dateRange: { start, end },
      rangeStats: {
        uniqueIps,
        avgOffersSelected,
        avgValuePerSubscriber,
        uniqueSubscribers,
        uniqueSends,
      },
    })
  }
)
