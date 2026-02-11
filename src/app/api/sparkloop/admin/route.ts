import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Default publication ID for AI Pro Daily
const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

/**
 * GET /api/sparkloop/admin
 *
 * Get all recommendations for admin management
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all' // all, active, excluded

    let query = supabaseAdmin
      .from('sparkloop_recommendations')
      .select('*')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)

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

    // Calculate scores for each recommendation
    // Priority: override > calculated/sparkloop > default
    // CR:  override_cr > our_cr (if 50+ impressions) > 22% default
    // RCR: override_rcr > sparkloop_rcr > 25% default
    const withScores = (data || []).map(rec => {
      const hasOverrideCr = rec.override_cr !== null && rec.override_cr !== undefined
      const hasOverrideRcr = rec.override_rcr !== null && rec.override_rcr !== undefined
      const hasEnoughData = (rec.impressions || 0) >= 50
      const hasOurCr = hasEnoughData && rec.our_cr !== null && Number(rec.our_cr) > 0
      const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) : null
      const hasSLRcr = slRcr !== null && slRcr > 0

      // Effective CR: override > ours > default 22%
      let effectiveCr: number
      let crSource: string
      if (hasOverrideCr) {
        effectiveCr = Number(rec.override_cr)
        crSource = 'override'
      } else if (hasOurCr) {
        effectiveCr = Number(rec.our_cr)
        crSource = 'ours'
      } else {
        effectiveCr = 22
        crSource = 'default'
      }

      // Effective RCR: override > sparkloop > default 25%
      let effectiveRcr: number
      let rcrSource: string
      if (hasOverrideRcr) {
        effectiveRcr = Number(rec.override_rcr)
        rcrSource = 'override'
      } else if (hasSLRcr) {
        effectiveRcr = slRcr!
        rcrSource = 'sparkloop'
      } else {
        effectiveRcr = 25
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
      .eq('publication_id', DEFAULT_PUBLICATION_ID)

    // Query unique IPs and avg offers from sparkloop_events
    let uniqueIpsByRefCode: Record<string, number> = {}
    let globalUniqueIps = 0
    let avgOffersSelected = 0

    try {
      // Get all subscribe-confirmed events with ip_hash
      const { data: subscribeEvents } = await supabaseAdmin
        .from('sparkloop_events')
        .select('raw_payload')
        .eq('publication_id', DEFAULT_PUBLICATION_ID)
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

      // Get avg offers selected from subscriptions_success events
      const { data: successEvents } = await supabaseAdmin
        .from('sparkloop_events')
        .select('raw_payload')
        .eq('publication_id', DEFAULT_PUBLICATION_ID)
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
      console.error('[SparkLoop Admin] Failed to compute IP/offer stats:', statsError)
    }

    // Add unique_ips to each recommendation
    const withIpStats = withScores.map(rec => ({
      ...rec,
      unique_ips: uniqueIpsByRefCode[rec.ref_code] || 0,
    }))

    // Sort by score descending (highest expected revenue per impression first)
    withIpStats.sort((a, b) => (b.calculated_score || 0) - (a.calculated_score || 0))

    // Categories are mutually exclusive:
    // - Active: status=active AND not excluded
    // - Excluded: any status but excluded=true
    // - Paused: status=paused AND not excluded
    // - Archived: status in (archived, awaiting_approval) AND not excluded
    return NextResponse.json({
      success: true,
      recommendations: withIpStats,
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
    })
  } catch (error) {
    console.error('[SparkLoop Admin] Failed to fetch recommendations:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/sparkloop/admin
 *
 * Update recommendation (exclude/reactivate/pause/unpause)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, excluded, excluded_reason, action } = body

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
      // Set or clear CR/RCR overrides
      // Number = set override, null = clear override, field absent = don't touch
      if ('override_cr' in body) {
        updateData.override_cr = body.override_cr
      }
      if ('override_rcr' in body) {
        updateData.override_rcr = body.override_rcr
      }
    } else if (action === 'pause') {
      // Manual pause: set status to paused, mark reason as manual
      updateData.status = 'paused'
      updateData.paused_reason = 'manual'
    } else if (action === 'unpause') {
      // Unpause: restore to active, clear paused_reason
      updateData.status = 'active'
      updateData.paused_reason = null
    } else {
      // Legacy exclude/reactivate toggle
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
    console.log(`[SparkLoop Admin] ${actionLabel} recommendation: ${data.publication_name}`)

    return NextResponse.json({
      success: true,
      recommendation: data,
    })
  } catch (error) {
    console.error('[SparkLoop Admin] Failed to update recommendation:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sparkloop/admin
 *
 * Bulk update recommendations
 */
export async function POST(request: NextRequest) {
  try {
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

    console.log(`[SparkLoop Admin] Bulk ${action}: ${data?.length || 0} recommendations`)

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
    })
  } catch (error) {
    console.error('[SparkLoop Admin] Bulk update failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
