/**
 * Data Access Layer — Posts Domain
 *
 * Centralizes queries against `rss_posts` and `post_ratings`. `post_ratings`
 * is only ever joined (never directly read), so insert helpers live here too.
 *
 * Conventions match `dal/issues.ts`:
 *  - Reads return `T | null` for single, `T[]` for list, never throw.
 *  - Writes return `boolean` (or the inserted row when callers need the id).
 *  - Errors are logged with structured pino fields and swallowed.
 *  - Multi-tenant isolation: rss_posts is publication-scoped via feed_id.
 *    Callers pass feed-id arrays they already filtered by publication.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { fetchAllPaginated } from '@/lib/dal/paginate'
import type { RssPost, PostRating, ExtractionStatus } from '@/types/database'

const log = createLogger({ module: 'dal:posts' })

// Column sets. Internal shapes stay private to the DAL; only the brief
// rating-join shape is exported because external scoring callers select it.
const POST_COLUMNS_FULL = `
  id, feed_id, issue_id, article_module_id, external_id,
  title, description, content, full_article_text,
  author, publication_date, source_url, image_url, image_alt,
  processed_at, extraction_status, extraction_error,
  ticker, member_name, transaction_type
` as const

const POST_FOR_SCORING_COLUMNS = `
  id, title, description, content, source_url, full_article_text,
  article_module_id, feed_id, ticker, transaction_type
` as const

const POST_FOR_TITLE_GEN_COLUMNS = `
  id, title, description, content, full_article_text,
  source_url, image_url, image_alt, feed_id, issue_id,
  article_module_id, ticker, member_name, transaction_type,
  post_ratings(total_score, criteria_1_score, criteria_2_score, criteria_3_score, criteria_4_score, criteria_5_score)
` as const

export const POST_WITH_RATINGS_BRIEF = `
  id, ticker,
  post_ratings(total_score, criteria_1_score, criteria_2_score, criteria_3_score, criteria_4_score, criteria_5_score)
` as const


// ==================== READ OPERATIONS ====================

/**
 * Look up the IDs that already exist for a given (external_id, feed_id) pair.
 * Returns a Set for fast `.has()` checks during ingestion.
 */
export async function getExistingExternalIds(
  externalIds: string[],
  feedIds: string[]
): Promise<Set<string>> {
  if (externalIds.length === 0 || feedIds.length === 0) return new Set()
  try {
    const rows = await fetchAllPaginated<{ external_id: string }>(
      () =>
        supabaseAdmin
          .from('rss_posts')
          .select('external_id')
          .in('external_id', externalIds)
          .in('feed_id', feedIds),
      { label: 'dal:posts:getExistingExternalIds' }
    )
    return new Set(rows.map(r => r.external_id))
  } catch (err) {
    log.error({ err, externalIds: externalIds.length, feedIds: feedIds.length }, 'getExistingExternalIds failed')
    return new Set()
  }
}

/**
 * List posts assigned to an issue. Returns full rows by default; pass
 * `{ idsOnly: true }` for the lighter id-only shape used by unassignment.
 *
 * Overloads keep the return type honest so callers don't need to cast.
 */
export async function listPostsByIssue(
  issueId: string,
  opts: { idsOnly: true }
): Promise<Array<Pick<RssPost, 'id'>>>
export async function listPostsByIssue(
  issueId: string,
  opts?: { idsOnly?: false }
): Promise<RssPost[]>
export async function listPostsByIssue(
  issueId: string,
  opts: { idsOnly?: boolean } = {}
): Promise<Array<Pick<RssPost, 'id'>> | RssPost[]> {
  try {
    const cols = opts.idsOnly ? 'id' : POST_COLUMNS_FULL
    const { data, error } = await supabaseAdmin
      .from('rss_posts')
      .select(cols)
      .eq('issue_id', issueId)

    if (error) {
      log.error({ err: error, issueId }, 'listPostsByIssue failed')
      return []
    }
    return (data || []) as any
  } catch (err) {
    log.error({ err, issueId }, 'listPostsByIssue exception')
    return []
  }
}

/**
 * List posts in a feed-set with their ratings. Used by both module-level
 * scoring queries and the issue-level "top posts from pool" assignment.
 */
export async function listPostsForScoring(
  feedIds: string[],
  opts: {
    unassignedOnly?: boolean
    sinceTimestamp?: string
    requireRating?: boolean
    columns?: string
  } = {}
): Promise<any[]> {
  if (feedIds.length === 0) return []
  try {
    let query = supabaseAdmin
      .from('rss_posts')
      .select(opts.columns ?? POST_WITH_RATINGS_BRIEF)
      .in('feed_id', feedIds)

    if (opts.unassignedOnly) query = query.is('issue_id', null)
    if (opts.sinceTimestamp) query = query.gte('processed_at', opts.sinceTimestamp)
    if (opts.requireRating) query = query.not('post_ratings', 'is', null)

    const { data, error } = await query

    if (error) {
      log.error({ err: error, feedIds: feedIds.length }, 'listPostsForScoring failed')
      return []
    }
    return data || []
  } catch (err) {
    log.error({ err, feedIds: feedIds.length }, 'listPostsForScoring exception')
    return []
  }
}

/**
 * List posts already assigned to a (issue, module) for title generation.
 * Includes the joined post_ratings shape needed by the generator.
 */
export async function listAssignedPostsForModule(
  issueId: string,
  moduleId: string,
  feedIds: string[]
): Promise<any[]> {
  if (feedIds.length === 0) return []
  try {
    const { data, error } = await supabaseAdmin
      .from('rss_posts')
      .select(POST_FOR_TITLE_GEN_COLUMNS)
      .eq('issue_id', issueId)
      .eq('article_module_id', moduleId)
      .in('feed_id', feedIds)

    if (error) {
      log.error({ err: error, issueId, moduleId }, 'listAssignedPostsForModule failed')
      return []
    }
    return data || []
  } catch (err) {
    log.error({ err, issueId, moduleId }, 'listAssignedPostsForModule exception')
    return []
  }
}

/**
 * Fetch posts by id where extraction succeeded. Used during scoring when
 * we want to skip posts whose extraction failed or is still pending.
 */
export async function listExtractedPostsByIds(
  postIds: string[]
): Promise<any[]> {
  if (postIds.length === 0) return []
  try {
    const { data, error } = await supabaseAdmin
      .from('rss_posts')
      .select(POST_FOR_SCORING_COLUMNS)
      .in('id', postIds)
      .eq('extraction_status', 'success')
      .not('full_article_text', 'is', null)

    if (error) {
      log.error({ err: error, count: postIds.length }, 'listExtractedPostsByIds failed')
      return []
    }
    return data || []
  } catch (err) {
    log.error({ err, count: postIds.length }, 'listExtractedPostsByIds exception')
    return []
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Catch-up queue: oldest pending-extraction posts in a feed, optionally
 * excluding a set of ids that we've just processed in this same run.
 *
 * `excludeIds` is interpolated directly into a Postgrest IN clause for
 * `.not('id', 'in', ...)`. Non-UUID values are filtered out and logged as
 * a structural guard against accidental injection.
 */
export async function listPendingExtractionPosts(
  feedId: string,
  opts: { limit?: number; excludeIds?: string[] } = {}
): Promise<Array<{ id: string; source_url: string | null }>> {
  try {
    let query = supabaseAdmin
      .from('rss_posts')
      .select('id, source_url')
      .eq('feed_id', feedId)
      .eq('extraction_status', 'pending')

    if (opts.excludeIds && opts.excludeIds.length > 0) {
      const safe = opts.excludeIds.filter(id => UUID_RE.test(id))
      if (safe.length !== opts.excludeIds.length) {
        log.error(
          { feedId, dropped: opts.excludeIds.length - safe.length },
          'listPendingExtractionPosts: non-UUID excludeIds filtered out',
        )
      }
      if (safe.length > 0) {
        query = query.not('id', 'in', `(${safe.join(',')})`)
      }
    }

    const { data, error } = await query
      .order('processed_at', { ascending: true })
      .limit(opts.limit ?? 20)

    if (error) {
      log.error({ err: error, feedId }, 'listPendingExtractionPosts failed')
      return []
    }
    return data || []
  } catch (err) {
    log.error({ err, feedId }, 'listPendingExtractionPosts exception')
    return []
  }
}

/**
 * List posts on an issue that need full-text extraction. Optional `sinceHours`
 * restricts to recently processed posts (used for fast warm-cache enrichment).
 */
export async function listPostsForExtractionByIssue(
  issueId: string,
  opts: { sinceHours?: number } = {}
): Promise<Array<Pick<RssPost, 'id' | 'source_url' | 'title' | 'full_article_text' | 'processed_at'>>> {
  try {
    let query = supabaseAdmin
      .from('rss_posts')
      .select('id, source_url, title, full_article_text, processed_at')
      .eq('issue_id', issueId)
      .not('source_url', 'is', null)

    if (opts.sinceHours !== undefined) {
      const since = new Date(Date.now() - opts.sinceHours * 60 * 60 * 1000).toISOString()
      query = query.gte('processed_at', since)
    }

    const { data, error } = await query

    if (error) {
      log.error({ err: error, issueId }, 'listPostsForExtractionByIssue failed')
      return []
    }
    return (data || []) as any
  } catch (err) {
    log.error({ err, issueId }, 'listPostsForExtractionByIssue exception')
    return []
  }
}

/**
 * Filter a set of post ids down to those that already have a post_ratings row.
 * Used for catch-up scoring to avoid double-rating.
 */
export async function getRatedPostIds(postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set()
  try {
    const rows = await fetchAllPaginated<{ post_id: string }>(
      () =>
        supabaseAdmin
          .from('post_ratings')
          .select('post_id')
          .in('post_id', postIds),
      { label: 'dal:posts:getRatedPostIds' }
    )
    return new Set(rows.map(r => r.post_id))
  } catch (err) {
    log.error({ err, count: postIds.length }, 'getRatedPostIds failed')
    return new Set()
  }
}

// ==================== WRITE OPERATIONS ====================

/**
 * Insert a single new RSS post. Returns the inserted id + source_url, the
 * shape feed-ingestion needs to seed full-text extraction. The type is
 * intentionally loose (extra columns like `ticker`, `member_name`,
 * `transaction_type` exist on the table but aren't in the stale `RssPost`
 * interface; fixing database.ts is out of scope for this DAL).
 */
export async function insertPost(
  post: { feed_id: string; external_id: string; title: string } & Record<string, any>
): Promise<{ id: string; source_url: string | null } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('rss_posts')
      .insert([post])
      .select('id, source_url')
      .single()

    if (error || !data) {
      log.error({ err: error, feedId: post.feed_id, externalId: post.external_id }, 'insertPost failed')
      return null
    }
    return data
  } catch (err) {
    log.error({ err, feedId: post.feed_id }, 'insertPost exception')
    return null
  }
}

/**
 * Update extraction status + (optionally) full text on a single post.
 *
 * On a `success` status the function ALWAYS clears `extraction_error`,
 * regardless of what the caller passes. This prevents stale error text
 * lingering on rows that subsequently extract successfully.
 */
export async function updatePostExtraction(
  postId: string,
  patch: {
    fullArticleText?: string
    extractionStatus: ExtractionStatus
    extractionError?: string | null
  }
): Promise<boolean> {
  try {
    const updateData: Record<string, any> = {
      extraction_status: patch.extractionStatus,
    }
    if (patch.fullArticleText !== undefined) updateData.full_article_text = patch.fullArticleText
    if (patch.extractionStatus === 'success') {
      updateData.extraction_error = null
    } else if (patch.extractionError !== undefined) {
      updateData.extraction_error = patch.extractionError
    }

    const { error } = await supabaseAdmin
      .from('rss_posts')
      .update(updateData)
      .eq('id', postId)

    if (error) {
      log.error({ err: error, postId }, 'updatePostExtraction failed')
      return false
    }
    return true
  } catch (err) {
    log.error({ err, postId }, 'updatePostExtraction exception')
    return false
  }
}

/**
 * Bulk-assign posts to an issue. Optionally also stamp `article_module_id`.
 */
export async function assignPostsToIssue(
  postIds: string[],
  issueId: string,
  opts: { moduleId?: string } = {}
): Promise<boolean> {
  if (postIds.length === 0) return true
  try {
    const updateData: Record<string, any> = { issue_id: issueId }
    if (opts.moduleId) updateData.article_module_id = opts.moduleId

    const { error } = await supabaseAdmin
      .from('rss_posts')
      .update(updateData)
      .in('id', postIds)

    if (error) {
      log.error({ err: error, issueId, count: postIds.length }, 'assignPostsToIssue failed')
      return false
    }
    return true
  } catch (err) {
    log.error({ err, issueId }, 'assignPostsToIssue exception')
    return false
  }
}

/**
 * Bulk-unassign a set of posts back to the pool (issue_id = null).
 * Used by Stage 1 unassignment after generation drops some posts.
 */
export async function unassignPosts(postIds: string[]): Promise<boolean> {
  if (postIds.length === 0) return true
  try {
    const { error } = await supabaseAdmin
      .from('rss_posts')
      .update({ issue_id: null })
      .in('id', postIds)

    if (error) {
      log.error({ err: error, count: postIds.length }, 'unassignPosts failed')
      return false
    }
    return true
  } catch (err) {
    log.error({ err }, 'unassignPosts exception')
    return false
  }
}

/**
 * Common pattern at every extraction site: a `result` object from the
 * extractor reports either `{ success: true, fullText }` or a failure with
 * `status` + `error`. This helper handles both branches and returns enough
 * information for the caller to drive its own counters.
 *
 * Returns `{ updated, status }` — `status` is `'skipped'` when result is
 * undefined (no extraction attempted for this URL), otherwise the status
 * that was written to the DB.
 */
export async function applyExtractionResult(
  postId: string,
  result: { success: boolean; fullText?: string; status?: ExtractionStatus; error?: string } | undefined
): Promise<{ updated: boolean; status: ExtractionStatus }> {
  if (!result) return { updated: false, status: 'skipped' }

  if (result.success && result.fullText) {
    const ok = await updatePostExtraction(postId, {
      fullArticleText: result.fullText,
      extractionStatus: 'success',
    })
    return { updated: ok, status: 'success' }
  }

  const status = result.status || 'failed'
  const ok = await updatePostExtraction(postId, {
    extractionStatus: status,
    extractionError: result.error?.substring(0, 500) || null,
  })
  return { updated: ok, status }
}

/**
 * Insert a post_ratings row. The table is insert-only; updates use the
 * scoring re-run pattern (insert a new rating row).
 *
 * Returns the Postgrest error message on failure so the caller can include
 * it in any thrown exception (the structured pino log captures the full
 * error object; this lets callers surface useful context in stack traces).
 */
export async function insertPostRating(
  rating: Partial<PostRating> & { post_id: string }
): Promise<{ ok: boolean; errorMessage?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('post_ratings')
      .insert([rating])

    if (error) {
      log.error({ err: error, postId: rating.post_id }, 'insertPostRating failed')
      return { ok: false, errorMessage: error.message }
    }
    return { ok: true }
  } catch (err) {
    log.error({ err, postId: rating.post_id }, 'insertPostRating exception')
    const message = err instanceof Error ? err.message : 'unknown error'
    return { ok: false, errorMessage: message }
  }
}
