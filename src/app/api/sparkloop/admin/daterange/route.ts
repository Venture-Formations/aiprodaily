import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Default publication ID for AI Pro Daily
const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

/**
 * GET /api/sparkloop/admin/daterange
 *
 * Returns per-ref_code metrics filtered by date range.
 * - Impressions: from popup_opened events (event_timestamp in range)
 * - Submissions/Confirms/Rejections/Pending: from sparkloop_referrals
 *   where source='custom_popup' and subscribed_at in range
 *
 * Query params: start (YYYY-MM-DD), end (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
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

    // 1. Impressions: popup_opened events in range (split by source)
    const { data: popupEvents, error: popupError } = await supabaseAdmin
      .from('sparkloop_events')
      .select('raw_payload')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .eq('event_type', 'popup_opened')
      .gte('event_timestamp', startDate)
      .lte('event_timestamp', endDate)

    if (popupError) {
      throw new Error(`Popup events query failed: ${popupError.message}`)
    }

    const impressionsByRef: Record<string, number> = {}
    const pageImpressionsByRef: Record<string, number> = {}
    if (popupEvents) {
      for (const evt of popupEvents) {
        const payload = evt.raw_payload as Record<string, unknown> | null
        const refCodes = payload?.ref_codes as string[] | null
        const source = payload?.source as string | null
        if (refCodes) {
          const target = source === 'recs_page' ? pageImpressionsByRef : impressionsByRef
          for (const rc of refCodes) {
            target[rc] = (target[rc] || 0) + 1
          }
        }
      }
    }

    // 2. Referrals in date range (by subscribed_at), split by source
    const { data: referrals, error: refError } = await supabaseAdmin
      .from('sparkloop_referrals')
      .select('ref_code, status, source')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .in('source', ['custom_popup', 'recs_page'])
      .gte('subscribed_at', startDate)
      .lte('subscribed_at', endDate)

    if (refError) {
      throw new Error(`Referrals query failed: ${refError.message}`)
    }

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

    if (referrals) {
      for (const r of referrals) {
        const target = r.source === 'recs_page' ? pageRefMetrics : refMetrics
        if (!target[r.ref_code]) {
          target[r.ref_code] = { submissions: 0, confirms: 0, rejections: 0, pending: 0 }
        }
        target[r.ref_code].submissions++
        if (r.status === 'confirmed') {
          target[r.ref_code].confirms++
        } else if (r.status === 'rejected') {
          target[r.ref_code].rejections++
        } else {
          target[r.ref_code].pending++
        }
      }
    }

    // 3. Unique IPs from api_subscribe_confirmed events in range
    const { data: subscribeEvents } = await supabaseAdmin
      .from('sparkloop_events')
      .select('raw_payload')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .eq('event_type', 'api_subscribe_confirmed')
      .gte('event_timestamp', startDate)
      .lte('event_timestamp', endDate)

    let uniqueIps = 0
    if (subscribeEvents && subscribeEvents.length > 0) {
      const ips = new Set<string>()
      for (const evt of subscribeEvents) {
        const payload = evt.raw_payload as Record<string, unknown> | null
        const ipHash = payload?.ip_hash as string | null
        if (ipHash) ips.add(ipHash)
      }
      uniqueIps = ips.size
    }

    // 4. Avg offers selected from subscriptions_success events in range
    const { data: successEvents } = await supabaseAdmin
      .from('sparkloop_events')
      .select('raw_payload')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .eq('event_type', 'subscriptions_success')
      .gte('event_timestamp', startDate)
      .lte('event_timestamp', endDate)

    let avgOffersSelected = 0
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

    console.log(`[SparkLoop Admin] Date range ${start} to ${end}: ${popupEvents?.length || 0} popup events, ${referrals?.length || 0} referrals, ${uniqueIps} unique IPs`)

    return NextResponse.json({
      success: true,
      metrics,
      dateRange: { start, end },
      rangeStats: {
        uniqueIps,
        avgOffersSelected,
      },
    })
  } catch (error) {
    console.error('[SparkLoop Admin] Date range query failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
