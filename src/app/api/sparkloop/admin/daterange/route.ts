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

    // 2. Referrals in date range (by subscribed_at), split by source - paginated
    let referrals: { ref_code: string; status: string; source: string }[] = []
    pageFrom = 0
    while (true) {
      const { data: page, error } = await supabaseAdmin
        .from('sparkloop_referrals')
        .select('ref_code, status, source')
        .eq('publication_id', PUBLICATION_ID)
        .in('source', ['custom_popup', 'recs_page'])
        .gte('subscribed_at', startDate)
        .lte('subscribed_at', endDate)
        .range(pageFrom, pageFrom + PAGE_SIZE - 1)
      if (error) throw new Error(`Referrals query failed: ${error.message}`)
      if (!page || page.length === 0) break
      referrals = referrals.concat(page)
      if (page.length < PAGE_SIZE) break
      pageFrom += PAGE_SIZE
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
