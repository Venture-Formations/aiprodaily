import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { isIPExcluded, type IPExclusion } from '@/lib/ip-utils'
import type { SubscribeAbEventType, VariantStatsRow } from '@/lib/ab-tests'

const EVENT_KEYS: SubscribeAbEventType[] = [
  'page_view',
  'signup',
  'reached_offers',
  'completed_info',
  'sparkloop_signup',
]

// Map event_type -> VariantStatsRow counter field. Hoisted so we don't
// recreate the object on every row during aggregation.
const EVENT_TYPE_TO_STAT_FIELD: Record<SubscribeAbEventType, keyof VariantStatsRow> = {
  page_view: 'page_views',
  signup: 'signups',
  reached_offers: 'reached_offers',
  completed_info: 'completed_info',
  sparkloop_signup: 'sparkloop_signups',
}

const MAX_EVENTS_PER_TEST = 500_000

const statsInputSchema = z.object({
  publication_id: z.string().uuid(),
  exclude_ips: z.enum(['true', 'false']).optional(),
})

export const GET = withApiHandler(
  {
    authTier: 'authenticated',
    logContext: 'ab-tests-stats',
    requirePublicationId: true,
    inputSchema: statsInputSchema,
  },
  async ({ input, publicationId, params, logger }) => {
    const { exclude_ips } = input as z.infer<typeof statsInputSchema>
    const excludeIps = exclude_ips !== 'false'

    // Load the test and its variants (tenant-scoped)
    const { data: test } = await supabaseAdmin
      .from('subscribe_ab_tests')
      .select('id, name, status, started_at, ended_at')
      .eq('id', params.id)
      .eq('publication_id', publicationId!)
      .maybeSingle()

    if (!test) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: variants } = await supabaseAdmin
      .from('subscribe_ab_test_variants')
      .select(`
        id, label, weight, display_order, page_id,
        page:subscribe_pages!inner(id, name)
      `)
      .eq('test_id', test.id)
      .order('display_order', { ascending: true })

    if (!variants || variants.length === 0) {
      return NextResponse.json({ success: true, test, variants: [], stats: [] })
    }

    // Load exclusions (publication-scoped) once
    const { data: exclusionRows } = await supabaseAdmin
      .from('excluded_ips')
      .select('ip_address, is_range, cidr_prefix')
      .eq('publication_id', publicationId!)

    const exclusions: IPExclusion[] = (exclusionRows || []) as IPExclusion[]

    // Stream events in bounded pages — enough for expected volumes, filter in JS.
    // (Stats are per-test so even long-running tests are bounded.)
    const rows: Array<{ variant_id: string; event_type: string; ip_address: string | null; is_bot_ua: boolean }> = []
    const PAGE = 1000
    let offset = 0
    let truncated = false
    while (offset < MAX_EVENTS_PER_TEST) {
      const { data: chunk, error } = await supabaseAdmin
        .from('subscribe_ab_events')
        .select('variant_id, event_type, ip_address, is_bot_ua')
        .eq('test_id', test.id)
        .eq('is_bot_ua', false)
        .order('occurred_at', { ascending: true })
        .range(offset, offset + PAGE - 1)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!chunk || chunk.length === 0) break

      rows.push(...chunk)
      if (chunk.length < PAGE) break
      offset += PAGE

      if (offset >= MAX_EVENTS_PER_TEST) {
        truncated = true
        logger.warn(
          { testId: test.id, loaded: rows.length, cap: MAX_EVENTS_PER_TEST },
          'Stats aggregation hit event cap — results are partial'
        )
      }
    }

    // Aggregate
    type StatsWithDisplay = VariantStatsRow & { page_name: string; display_order: number }
    const stats: Record<string, StatsWithDisplay> = {}
    for (const v of variants) {
      const pageObj: any = Array.isArray((v as any).page) ? (v as any).page[0] : (v as any).page
      stats[v.id] = {
        variant_id: v.id,
        label: v.label,
        weight: v.weight,
        page_views: 0,
        signups: 0,
        reached_offers: 0,
        completed_info: 0,
        sparkloop_signups: 0,
        page_name: pageObj?.name || '',
        display_order: v.display_order,
      }
    }

    let excludedCount = 0
    for (const row of rows) {
      if (excludeIps && isIPExcluded(row.ip_address, exclusions)) {
        excludedCount++
        continue
      }
      const s = stats[row.variant_id]
      if (!s) continue

      const field = EVENT_TYPE_TO_STAT_FIELD[row.event_type as SubscribeAbEventType]
      if (field) {
        ;(s as any)[field] = ((s as any)[field] as number) + 1
      }
    }

    return NextResponse.json({
      success: true,
      test,
      stats: Object.values(stats),
      meta: {
        event_types: EVENT_KEYS,
        excluded_by_ip: excludedCount,
        total_events_considered: rows.length,
        truncated,
      },
    })
  }
)
