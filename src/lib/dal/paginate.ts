/**
 * Shared Supabase pagination wrapper.
 *
 * Supabase silently truncates `.select()` at 1000 rows per request. This
 * helper transparently pages past that limit by re-issuing the query with
 * advancing `.range()` windows until a short page is returned.
 *
 * Pass a builder function — NOT a built query — because Supabase's fluent
 * builders are mutable and cannot be reused across awaited calls.
 */

import type { PostgrestError } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'

const log = createLogger({ module: 'dal:paginate' })

const DEFAULT_PAGE_SIZE = 1000

// Minimal shape we need from a Postgrest filter builder. Avoids tight
// coupling to a specific @supabase/postgrest-js generic signature, which
// changes across versions. The real builder returns this shape from .range().
type AwaitableQuery<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
type RangeableQuery<T> = {
  range: (from: number, to: number) => AwaitableQuery<T>
}

export interface FetchAllPaginatedOptions {
  /** Rows per page. Default 1000 (Supabase's hard cap per request). */
  pageSize?: number
  /** Safety cap on number of pages. Throws if exceeded. Default 1000 (1M rows). */
  maxPages?: number
  /** Optional context tag for the log line. */
  label?: string
}

/**
 * Fetch every row from a Supabase query, paging past the 1000-row default.
 *
 * The builder MUST NOT call `.range()` or `.limit()` — this helper owns those.
 * Errors propagate via `throw` so callers' try/catch can surface them.
 *
 * @example
 *   const rows = await fetchAllPaginated<{ id: string }>(() =>
 *     supabaseAdmin
 *       .from('sparkloop_referrals')
 *       .select('id')
 *       .eq('publication_id', pubId),
 *   )
 */
export async function fetchAllPaginated<T>(
  buildQuery: () => RangeableQuery<T>,
  options: FetchAllPaginatedOptions = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const maxPages = options.maxPages ?? 1000
  const startedAt = Date.now()

  if (pageSize <= 0) throw new Error('fetchAllPaginated: pageSize must be > 0')
  if (maxPages <= 0) throw new Error('fetchAllPaginated: maxPages must be > 0')

  const all: T[] = []
  let offset = 0
  let page = 0

  while (true) {
    if (page >= maxPages) {
      throw new Error(
        `fetchAllPaginated: maxPages (${maxPages}) exceeded — query returned more than ${maxPages * pageSize} rows`,
      )
    }

    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1)

    if (error) {
      log.error({ err: error, label: options.label, page, offset }, 'fetchAllPaginated query failed')
      throw error
    }

    const rows = data ?? []
    all.push(...rows)
    page += 1

    if (rows.length < pageSize) break
    offset += pageSize
  }

  log.info(
    {
      label: options.label,
      pages: page,
      rows: all.length,
      durationMs: Date.now() - startedAt,
    },
    'fetchAllPaginated complete',
  )

  return all
}
