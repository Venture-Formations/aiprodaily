/**
 * Data Access Layer — Excluded IPs Domain
 *
 * Centralizes the `excluded_ips` fetch+normalize that's needed by every
 * analytics endpoint and cron that filters bot/honeypot traffic. The shape
 * mirrors `IPExclusion` from `ip-utils.ts` so callers can pass the result
 * directly into `isIPExcluded()`.
 *
 * The query is paginated past Supabase's 1000-row default — bot-detection
 * lists for long-running publications can grow past that, and silent
 * truncation causes false-positive clicker detection.
 *
 * Conventions match `dal/posts.ts`:
 *  - Returns `IPExclusion[]` (never null); empty array on error or no rows.
 *  - Errors are logged and swallowed — analytics still works without
 *    exclusions, just unfiltered.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { fetchAllPaginated } from '@/lib/dal/paginate'
import type { IPExclusion } from '@/lib/ip-utils'

const log = createLogger({ module: 'dal:excluded-ips' })

/**
 * Fetch all excluded IPs for a publication, normalized to the `IPExclusion`
 * shape used by `isIPExcluded()`.
 *
 * @param publicationId - Tenant scope. Must be non-empty.
 * @param label - Optional context tag for the pagination log line.
 */
export async function getExcludedIPs(
  publicationId: string,
  label?: string,
): Promise<IPExclusion[]> {
  if (!publicationId) return []

  try {
    const rows = await fetchAllPaginated<{
      ip_address: string
      is_range: boolean | null
      cidr_prefix: number | null
    }>(
      () =>
        supabaseAdmin
          .from('excluded_ips')
          .select('ip_address, is_range, cidr_prefix')
          .eq('publication_id', publicationId),
      { label: label ?? `dal:excluded-ips:${publicationId}` },
    )

    return rows.map(e => ({
      ip_address: e.ip_address,
      is_range: e.is_range || false,
      cidr_prefix: e.cidr_prefix,
    }))
  } catch (err) {
    log.error({ err, publicationId, label }, 'getExcludedIPs failed')
    return []
  }
}
