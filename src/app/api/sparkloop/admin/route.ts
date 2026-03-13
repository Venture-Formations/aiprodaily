import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { getPublicationSettings, updatePublicationSetting } from '@/lib/publication-settings'
import { SparkLoopService } from '@/lib/sparkloop-client'
import { PUBLICATION_ID } from '@/lib/config'

// Hardcoded fallbacks if no publication_settings exist
const FALLBACK_DEFAULT_CR = 22
const FALLBACK_DEFAULT_RCR = 25

/**
 * GET /api/sparkloop/admin
 *
 * Get all recommendations for admin management
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'sparkloop/admin' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all' // all, active, excluded

    const REC_COLUMNS = [
      'id', 'publication_id', 'ref_code', 'sparkloop_uuid',
      'publication_name', 'publication_logo', 'description',
      'type', 'status', 'cpa', 'screening_period', 'sparkloop_rcr',
      'pinned', 'position', 'max_payout', 'partner_program_uuid',
      'sparkloop_pending', 'sparkloop_rejected', 'sparkloop_confirmed',
      'sparkloop_earnings', 'sparkloop_net_earnings',
      'impressions', 'selections', 'submissions', 'confirms', 'rejections', 'pending',
      'our_total_subscribes', 'our_confirms', 'our_rejections', 'our_pending',
      'our_cr', 'our_rcr', 'override_cr', 'override_rcr', 'override_slip',
      'excluded', 'excluded_reason', 'paused_reason',
      'remaining_budget_dollars', 'eligible_for_module',
      'last_seen_in_generate', 'page_impressions', 'page_submissions', 'page_cr',
      'last_synced_at', 'created_at', 'updated_at',
    ].join(', ')

    let query = supabaseAdmin
      .from('sparkloop_recommendations')
      .select(REC_COLUMNS)
      .eq('publication_id', PUBLICATION_ID)

    if (filter === 'active') {
      query = query.eq('status', 'active').or('excluded.is.null,excluded.eq.false')
    } else if (filter === 'excluded') {
      query = query.eq('excluded', true)
    } else if (filter === 'paused') {
      query = query.eq('status', 'paused').or('excluded.is.null,excluded.eq.false')
    }

    const { data: rawData, error } = await query

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    const data = rawData as unknown as any[] | null

    // Load configurable defaults from publication_settings
    const defaults = await getPublicationSettings(PUBLICATION_ID, [
      'sparkloop_default_cr',
      'sparkloop_default_rcr',
      'sparkloop_min_conversions_budget',
    ])
    const defaultCr = defaults.sparkloop_default_cr ? parseFloat(defaults.sparkloop_default_cr) : FALLBACK_DEFAULT_CR
    const defaultRcr = defaults.sparkloop_default_rcr ? parseFloat(defaults.sparkloop_default_rcr) : FALLBACK_DEFAULT_RCR
    const minConversionsBudget = defaults.sparkloop_min_conversions_budget ? parseInt(defaults.sparkloop_min_conversions_budget) : 10

    // All-time slippage: count matured sends and snapshot-based confirms/rejects per ref_code.
    // Matured send = sent more than S (screening_period) days ago.
    // Confirms/rejects come from snapshot deltas, excluding the first snapshot (which captures
    // pre-existing cumulative totals and would inflate the numbers). The baseline snapshot is
    // the first one recorded after (first_send_date + S), so we only count confirms/rejects
    // that correspond to subs we actually sent.
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // 1. Count matured sends per ref_code, grouped by screening_period
    const screeningGroups = new Map<number, string[]>()
    for (const rec of data || []) {
      const s = rec.screening_period || 14
      if (!screeningGroups.has(s)) screeningGroups.set(s, [])
      screeningGroups.get(s)!.push(rec.ref_code)
    }

    const maturedSendsByRefCode = new Map<string, number>()
    const firstSendByRefCode = new Map<string, string>()
    await Promise.all(
      Array.from(screeningGroups.entries()).map(async ([s, refCodes]) => {
        const cutoff = new Date(today)
        cutoff.setDate(cutoff.getDate() - s)
        const cutoffStr = cutoff.toISOString().split('T')[0]

        // Paginate to avoid Supabase's 1000-row limit
        let offset = 0
        const PAGE = 1000
        const counts = new Map<string, number>()
        while (true) {
          const { data: page } = await supabaseAdmin
            .from('sparkloop_referrals')
            .select('ref_code, subscribed_at')
            .eq('publication_id', PUBLICATION_ID)
            .in('ref_code', refCodes)
            .lte('subscribed_at', cutoffStr)
            .range(offset, offset + PAGE - 1)
          if (!page || page.length === 0) break
          for (const row of page) {
            counts.set(row.ref_code, (counts.get(row.ref_code) || 0) + 1)
            const existing = firstSendByRefCode.get(row.ref_code)
            if (!existing || row.subscribed_at < existing) {
              firstSendByRefCode.set(row.ref_code, row.subscribed_at)
            }
          }
          if (page.length < PAGE) break
          offset += PAGE
        }
        counts.forEach((count, rc) => {
          maturedSendsByRefCode.set(rc, count)
        })
      })
    )

    // 2. Fetch all daily snapshots and compute delta-based confirms/rejects per ref_code.
    //    Baseline = first snapshot after (first_send + S days), excluding the very first
    //    snapshot ever recorded for each rec (day-1 inflation).
    type SnapRow = { ref_code: string; snapshot_date: string; sparkloop_confirmed: number; sparkloop_rejected: number }
    const allSnapshots: SnapRow[] = []
    let snapOffset = 0
    const SNAP_PAGE = 1000
    while (true) {
      const { data: page } = await supabaseAdmin
        .from('sparkloop_daily_snapshots')
        .select('ref_code, snapshot_date, sparkloop_confirmed, sparkloop_rejected')
        .eq('publication_id', PUBLICATION_ID)
        .order('snapshot_date', { ascending: true })
        .range(snapOffset, snapOffset + SNAP_PAGE - 1)
      if (!page || page.length === 0) break
      allSnapshots.push(...(page as SnapRow[]))
      if (page.length < SNAP_PAGE) break
      snapOffset += SNAP_PAGE
    }

    // Group snapshots by ref_code (sorted ascending by date from the query)
    const snapsByRefCode = new Map<string, SnapRow[]>()
    for (const snap of allSnapshots) {
      if (!snapsByRefCode.has(snap.ref_code)) snapsByRefCode.set(snap.ref_code, [])
      snapsByRefCode.get(snap.ref_code)!.push(snap)
    }

    // For each ref_code, compute delta confirms/rejects from baseline to latest snapshot
    const slipDataByRefCode = new Map<string, { confirmsGained: number; rejectsGained: number }>()
    for (const rec of data || []) {
      const s = rec.screening_period || 14
      const snaps = snapsByRefCode.get(rec.ref_code)
      if (!snaps || snaps.length < 2) continue

      const firstSend = firstSendByRefCode.get(rec.ref_code)
      if (!firstSend) continue

      // Baseline date = first_send + S days
      const baselineDate = new Date(firstSend)
      baselineDate.setDate(baselineDate.getDate() + s)
      const baselineDateStr = baselineDate.toISOString().split('T')[0]

      // Skip the very first snapshot (index 0) — it has inflated cumulative totals.
      // Find baseline: first snapshot on or after baselineDate, excluding index 0.
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

    // Calculate scores for each recommendation
    const withScores = (data || []).map(rec => {
      const hasOverrideCr = rec.override_cr !== null && rec.override_cr !== undefined
      const hasOverrideRcr = rec.override_rcr !== null && rec.override_rcr !== undefined
      const hasEnoughData = (rec.impressions || 0) >= 50
      const hasOurCr = hasEnoughData && rec.our_cr !== null && Number(rec.our_cr) > 0
      const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) : null
      const hasSLRcr = slRcr !== null && slRcr > 0

      let effectiveCr: number
      let crSource: string
      if (hasOverrideCr) {
        effectiveCr = Number(rec.override_cr)
        crSource = hasOurCr ? 'override_with_data' : 'override'
      } else if (hasOurCr) {
        effectiveCr = Number(rec.our_cr)
        crSource = 'ours'
      } else {
        effectiveCr = defaultCr
        crSource = 'default'
      }

      let effectiveRcr: number
      let rcrSource: string
      if (hasOverrideRcr) {
        effectiveRcr = Number(rec.override_rcr)
        rcrSource = hasSLRcr ? 'override_with_sl' : 'override'
      } else if (hasSLRcr) {
        effectiveRcr = slRcr!
        rcrSource = 'sparkloop'
      } else {
        effectiveRcr = defaultRcr
        rcrSource = 'default'
      }

      // All-time slippage using matured sends and snapshot-based confirms/rejects.
      // maturedSends = subs sent more than S days ago (had time to clear screening).
      // confirmsGained/rejectsGained = snapshot delta from (first_send + S) to today,
      // excluding the first snapshot (inflated with pre-existing cumulative totals).
      const maturedSends = maturedSendsByRefCode.get(rec.ref_code) || 0
      const slipData = slipDataByRefCode.get(rec.ref_code)
      const confirmsGained = slipData?.confirmsGained ?? 0
      const rejectsGained = slipData?.rejectsGained ?? 0
      const allTimeSlip = maturedSends > 0
        ? Math.max(0, maturedSends - (confirmsGained + rejectsGained))
        : 0
      const allTimeSlipRate = maturedSends > 0 ? (allTimeSlip / maturedSends) * 100 : 0

      // Override slip
      const hasOverrideSlip = rec.override_slip !== null && rec.override_slip !== undefined
      let effectiveSlip: number
      let slipSource: string
      if (hasOverrideSlip) {
        effectiveSlip = Number(rec.override_slip)
        slipSource = maturedSends > 0 ? 'override_with_data' : 'override'
      } else {
        effectiveSlip = allTimeSlipRate
        slipSource = 'calculated'
      }

      const cr = effectiveCr / 100
      const rcr = effectiveRcr / 100
      const cpa = (rec.cpa || 0) / 100
      const score = cr * cpa * rcr * (1 - effectiveSlip / 100)

      return {
        ...rec,
        calculated_score: score,
        effective_cr: effectiveCr,
        effective_rcr: effectiveRcr,
        cr_source: crSource,
        rcr_source: rcrSource,
        alltime_slip: allTimeSlipRate,
        effective_slip: effectiveSlip,
        slip_source: slipSource,
        matured_sends: maturedSends,
        submission_capped: !hasSLRcr && !hasOverrideRcr && (rec.submissions || 0) >= 50,
      }
    })

    // Get full counts from unfiltered data (mutually exclusive categories)
    const { data: allData } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('status, excluded')
      .eq('publication_id', PUBLICATION_ID)

    // Query unique IPs and avg offers from sparkloop_events
    let uniqueIpsByRefCode: Record<string, number> = {}
    let globalUniqueIps = 0
    let avgOffersSelected = 0

    try {
      const { data: subscribeEvents } = await supabaseAdmin
        .from('sparkloop_events')
        .select('raw_payload')
        .eq('publication_id', PUBLICATION_ID)
        .eq('event_type', 'api_subscribe_confirmed')

      if (subscribeEvents && subscribeEvents.length > 0) {
        const globalIps = new Set<string>()
        const refCodeIps: Record<string, Set<string>> = {}

        for (const evt of subscribeEvents) {
          const payload = evt.raw_payload as Record<string, unknown> | null
          if (!payload) continue
          const ipHash = payload.ip_hash as string | null
          const refCodes = payload.ref_codes as string[] | null

          if (ipHash) {
            globalIps.add(ipHash)
            if (refCodes) {
              for (const rc of refCodes) {
                if (!refCodeIps[rc]) refCodeIps[rc] = new Set()
                refCodeIps[rc].add(ipHash)
              }
            }
          }
        }

        globalUniqueIps = globalIps.size
        for (const [rc, ips] of Object.entries(refCodeIps)) {
          uniqueIpsByRefCode[rc] = ips.size
        }
      }

      const { data: successEvents } = await supabaseAdmin
        .from('sparkloop_events')
        .select('raw_payload')
        .eq('publication_id', PUBLICATION_ID)
        .eq('event_type', 'subscriptions_success')

      if (successEvents && successEvents.length > 0) {
        let totalSelected = 0
        let countWithData = 0
        for (const evt of successEvents) {
          const payload = evt.raw_payload as Record<string, unknown> | null
          const selected = payload?.selected_count as number | undefined
          if (selected !== undefined && selected !== null) {
            totalSelected += selected
            countWithData++
          }
        }
        if (countWithData > 0) {
          avgOffersSelected = totalSelected / countWithData
        }
      }
    } catch (statsError) {
      logger.error({ err: statsError }, 'Failed to compute IP/offer stats')
    }

    // Add unique_ips to each recommendation
    const withIpStats = withScores.map(rec => ({
      ...rec,
      unique_ips: uniqueIpsByRefCode[rec.ref_code] || 0,
    }))

    // Calculate rolling window metrics (14D and 30D) in parallel
    // Wrapped in try/catch so a failure here doesn't block the entire response
    let withRollingMetrics = withIpStats.map(rec => ({
      ...rec,
      rcr_14d: null as number | null,
      rcr_30d: null as number | null,
      slippage_14d: null as number | null,
      slippage_30d: null as number | null,
      sends_14d: 0,
      sends_30d: 0,
      confirms_gained_14d: 0,
      confirms_gained_30d: 0,
    }))

    try {
      const [metrics14d, metrics30d] = await Promise.all([
        SparkLoopService.calculateRollingWindowMetrics(14, PUBLICATION_ID),
        SparkLoopService.calculateRollingWindowMetrics(30, PUBLICATION_ID),
      ])

      withRollingMetrics = withIpStats.map(rec => {
        const m14 = metrics14d.get(rec.ref_code)
        const m30 = metrics30d.get(rec.ref_code)
        return {
          ...rec,
          rcr_14d: m14?.rcr ?? null,
          rcr_30d: m30?.rcr ?? null,
          slippage_14d: m14?.slippage_rate ?? null,
          slippage_30d: m30?.slippage_rate ?? null,
          sends_14d: m14?.sends ?? 0,
          sends_30d: m30?.sends ?? 0,
          confirms_gained_14d: m14?.confirms_gained ?? 0,
          confirms_gained_30d: m30?.confirms_gained ?? 0,
        }
      })
    } catch (metricsError) {
      logger.error({ err: metricsError }, 'Failed to calculate rolling window metrics — returning data without rolling metrics')
    }

    // Sort by score descending
    withRollingMetrics.sort((a, b) => (b.calculated_score || 0) - (a.calculated_score || 0))

    return NextResponse.json({
      success: true,
      recommendations: withRollingMetrics,
      counts: {
        total: allData?.length || 0,
        active: allData?.filter(r => r.status === 'active' && !r.excluded).length || 0,
        excluded: allData?.filter(r => r.excluded).length || 0,
        paused: allData?.filter(r => r.status === 'paused' && !r.excluded).length || 0,
        archived: allData?.filter(r => (r.status === 'archived' || r.status === 'awaiting_approval') && !r.excluded).length || 0,
      },
      globalStats: {
        uniqueIps: globalUniqueIps,
        avgOffersSelected: Math.round(avgOffersSelected * 100) / 100,
      },
      defaults: {
        cr: defaultCr,
        rcr: defaultRcr,
        minConversionsBudget,
      },
    })
  }
)

/**
 * PATCH /api/sparkloop/admin
 *
 * Update recommendation (exclude/reactivate/pause/unpause)
 */
export const PATCH = withApiHandler(
  { authTier: 'admin', logContext: 'sparkloop/admin' },
  async ({ request, logger }) => {
    const body = await request.json()
    const { id, excluded, excluded_reason, action } = body

    // set_defaults doesn't need an id -- handle it before the id check
    if (action === 'set_defaults') {
      const results: string[] = []
      if ('default_cr' in body && body.default_cr !== undefined) {
        const val = parseFloat(body.default_cr)
        if (isNaN(val) || val < 0 || val > 100) {
          return NextResponse.json(
            { success: false, error: 'default_cr must be between 0 and 100' },
            { status: 400 }
          )
        }
        await updatePublicationSetting(PUBLICATION_ID, 'sparkloop_default_cr', String(val))
        results.push(`CR=${val}%`)
      }
      if ('default_rcr' in body && body.default_rcr !== undefined) {
        const val = parseFloat(body.default_rcr)
        if (isNaN(val) || val < 0 || val > 100) {
          return NextResponse.json(
            { success: false, error: 'default_rcr must be between 0 and 100' },
            { status: 400 }
          )
        }
        await updatePublicationSetting(PUBLICATION_ID, 'sparkloop_default_rcr', String(val))
        results.push(`RCR=${val}%`)
      }
      if ('min_conversions_budget' in body && body.min_conversions_budget !== undefined) {
        const val = parseInt(body.min_conversions_budget)
        if (isNaN(val) || val < 1 || val > 100) {
          return NextResponse.json(
            { success: false, error: 'min_conversions_budget must be between 1 and 100' },
            { status: 400 }
          )
        }
        await updatePublicationSetting(PUBLICATION_ID, 'sparkloop_min_conversions_budget', String(val))
        results.push(`MCB=${val}`)
      }
      logger.info({ updated: results }, 'Updated defaults')
      return NextResponse.json({ success: true, updated: results })
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Recommendation ID is required' },
        { status: 400 }
      )
    }

    let updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (action === 'set_overrides') {
      if ('override_cr' in body) {
        updateData.override_cr = body.override_cr
      }
      if ('override_rcr' in body) {
        updateData.override_rcr = body.override_rcr
      }
      if ('override_slip' in body) {
        updateData.override_slip = body.override_slip
      }
    } else if (action === 'pause') {
      updateData.status = 'paused'
      updateData.paused_reason = 'manual'
    } else if (action === 'unpause') {
      updateData.status = 'active'
      updateData.paused_reason = null
    } else if (action === 'toggle_module_eligible') {
      updateData.eligible_for_module = body.eligible_for_module ?? false
    } else {
      updateData.excluded = excluded ?? false
      updateData.excluded_reason = excluded ? (excluded_reason || 'manual_exclusion') : null
    }

    const { data, error } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    const actionLabel = action === 'set_overrides' ? 'Updated overrides for' : action === 'pause' ? 'Paused' : action === 'unpause' ? 'Unpaused' : excluded ? 'Excluded' : 'Reactivated'
    logger.info({ action: actionLabel, name: data.publication_name }, 'Recommendation updated')

    return NextResponse.json({
      success: true,
      recommendation: data,
    })
  }
)

/**
 * POST /api/sparkloop/admin
 *
 * Bulk update recommendations
 */
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'sparkloop/admin' },
  async ({ request, logger }) => {
    const body = await request.json()
    const { action, ids, excluded_reason } = body

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Action and IDs array are required' },
        { status: 400 }
      )
    }

    let updateData: Record<string, unknown> = {}

    if (action === 'exclude') {
      updateData = {
        excluded: true,
        excluded_reason: excluded_reason || 'bulk_exclusion',
        updated_at: new Date().toISOString(),
      }
    } else if (action === 'reactivate') {
      updateData = {
        excluded: false,
        excluded_reason: null,
        status: 'active',
        paused_reason: null,
        updated_at: new Date().toISOString(),
      }
    } else if (action === 'pause') {
      updateData = {
        status: 'paused',
        paused_reason: 'manual',
        updated_at: new Date().toISOString(),
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "exclude", "reactivate", or "pause"' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .update(updateData)
      .in('id', ids)
      .select()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    logger.info({ action, count: data?.length || 0 }, 'Bulk update completed')

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
    })
  }
)
