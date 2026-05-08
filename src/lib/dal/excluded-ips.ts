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
 *  - Default returns `IPExclusion[]` (never null); empty array on error
 *    or no rows. Errors are logged via pino and swallowed.
 *  - Pass `{ throwOnError: true }` for callers (e.g. crons writing to
 *    external systems) where empty-on-error would cause incorrect downstream
 *    writes. The error then propagates to the caller's try/catch.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { fetchAllPaginated } from '@/lib/dal/paginate'
import type { IPExclusion } from '@/lib/ip-utils'

const log = createLogger({ module: 'dal:excluded-ips' })

export interface GetExcludedIPsOptions {
  /**
   * When true, DB errors propagate to the caller instead of being swallowed.
   * Use for callers that drive external writes (e.g. MailerLite cron) where
   * an empty exclusion list silently promotes bot clicks to real ones.
   * Default: false (swallow + return []).
   */
  throwOnError?: boolean
}

/**
 * Fetch all excluded IPs for a publication, normalized to the `IPExclusion`
 * shape used by `isIPExcluded()`.
 *
 * Pagination order is keyed on `id` (PK) so offset windows are stable —
 * concurrent inserts can't shift rows across page boundaries.
 *
 * @param publicationId - Tenant scope. Must be non-empty.
 * @param label - Optional context tag for the pagination log line.
 * @param options - See `GetExcludedIPsOptions`.
 */
export async function getExcludedIPs(
  publicationId: string,
  label?: string,
  options: GetExcludedIPsOptions = {},
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
          .eq('publication_id', publicationId)
          .order('id'),
      { label: label ?? `dal:excluded-ips:${publicationId}` },
    )

    return rows.map(e => ({
      ip_address: e.ip_address,
      is_range: e.is_range || false,
      cidr_prefix: e.cidr_prefix,
    }))
  } catch (err) {
    log.error({ err, publicationId, label }, 'getExcludedIPs failed')
    if (options.throwOnError) throw err
    return []
  }
}
