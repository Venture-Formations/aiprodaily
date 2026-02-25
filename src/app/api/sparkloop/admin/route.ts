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

    let query = supabaseAdmin
      .from('sparkloop_recommendations')
      .select('*')
      .eq('publication_id', PUBLICATION_ID)

    if (filter === 'active') {
      query = query.eq('status', 'active').or('excluded.is.null,excluded.eq.false')
    } else if (filter === 'excluded') {
      query = query.eq('excluded', true)
    } else if (filter === 'paused') {
      query = query.eq('status', 'paused').or('excluded.is.null,excluded.eq.false')
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    // Load configurable defaults from publication_settings
    const defaults = await getPublicationSettings(PUBLICATION_ID, [
      'sparkloop_default_cr',
      'sparkloop_default_rcr',
    ])
    const defaultCr = defaults.sparkloop_default_cr ? parseFloat(defaults.sparkloop_default_cr) : FALLBACK_DEFAULT_CR
    const defaultRcr = defaults.sparkloop_default_rcr ? parseFloat(defaults.sparkloop_default_rcr) : FALLBACK_DEFAULT_RCR

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

      const cr = effectiveCr / 100
      const rcr = effectiveRcr / 100
      const cpa = (rec.cpa || 0) / 100
      const score = cr * cpa * rcr

      return {
        ...rec,
        calculated_score: score,
        effective_cr: effectiveCr,
        effective_rcr: effectiveRcr,
        cr_source: crSource,
        rcr_source: rcrSource,
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
    const [metrics14d, metrics30d] = await Promise.all([
      SparkLoopService.calculateRollingWindowMetrics(14, PUBLICATION_ID),
      SparkLoopService.calculateRollingWindowMetrics(30, PUBLICATION_ID),
    ])

    // Merge rolling metrics into each recommendation
    const withRollingMetrics = withIpStats.map(rec => {
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
