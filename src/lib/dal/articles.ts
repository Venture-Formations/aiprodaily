/**
 * Data Access Layer — Articles Domain
 *
 * Centralizes queries against `module_articles` (per-issue generated articles)
 * and `manual_articles` (per-publication authored articles).
 *
 * Conventions match `dal/issues.ts`:
 *  - Reads return `T | null` for single, `T[]` for list, never throw.
 *  - Writes return `boolean` (or the inserted row when callers need the id).
 *  - Errors are logged with structured pino fields and swallowed.
 *  - Multi-tenant isolation: module_articles is scoped via issue_id;
 *    manual_articles is directly scoped via publication_id.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { fetchAllPaginated } from './paginate'
import { toLocalDateStr } from '@/lib/date-utils'
import type { ModuleArticle, ManualArticleStatus } from '@/types/database'

const log = createLogger({ module: 'dal:articles' })

// ==================== module_articles ====================

export const MODULE_ARTICLE_COLUMNS = `
  id, post_id, issue_id, article_module_id,
  headline, content, rank, is_active, skipped,
  fact_check_score, fact_check_details, word_count,
  review_position, final_position,
  ticker, member_name, transaction_type,
  trade_image_url, trade_image_alt,
  created_at, updated_at
` as const

export const MODULE_ARTICLE_BODY_GEN_SELECT = `
  id, headline, content, post_id,
  rss_posts(id, title, description, content, full_article_text, source_url, transaction_type)
` as const

export const MODULE_ARTICLE_FACT_CHECK_SELECT = `
  id, content, fact_check_score,
  rss_posts(id, content, description)
` as const

/**
 * List module_articles for an issue. Use `idsOnly` for `{ id }`-only rows,
 * `postIdsOnly` for `{ post_id }`-only rows, or default for the full shape.
 */
export async function listModuleArticlesByIssue(
  issueId: string,
  opts: { idsOnly: true; moduleId?: string; activeOnly?: boolean }
): Promise<Array<{ id: string }>>
export async function listModuleArticlesByIssue(
  issueId: string,
  opts: { postIdsOnly: true; moduleId?: string; activeOnly?: boolean }
): Promise<Array<{ post_id: string | null }>>
export async function listModuleArticlesByIssue(
  issueId: string,
  opts?: { moduleId?: string; activeOnly?: boolean; idsOnly?: false; postIdsOnly?: false }
): Promise<ModuleArticle[]>
export async function listModuleArticlesByIssue(
  issueId: string,
  opts: {
    moduleId?: string
    activeOnly?: boolean
    idsOnly?: boolean
    postIdsOnly?: boolean
  } = {}
): Promise<any[]> {
  try {
    let cols: string = MODULE_ARTICLE_COLUMNS
    if (opts.idsOnly) cols = 'id'
    else if (opts.postIdsOnly) cols = 'post_id'

    let query = supabaseAdmin
      .from('module_articles')
      .select(cols)
      .eq('issue_id', issueId)

    if (opts.moduleId) query = query.eq('article_module_id', opts.moduleId)
    if (opts.activeOnly) query = query.eq('is_active', true)

    const { data, error } = await query

    if (error) {
      log.error({ err: error, issueId }, 'listModuleArticlesByIssue failed')
      return []
    }
    return data || []
  } catch (err) {
    log.error({ err, issueId }, 'listModuleArticlesByIssue exception')
    return []
  }
}

/**
 * Check whether a (post, issue, module) row already exists. Used to short-
 * circuit re-generation of titles for the same post.
 */
export async function moduleArticleExists(
  postId: string,
  issueId: string,
  moduleId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('module_articles')
      .select('id')
      .eq('post_id', postId)
      .eq('issue_id', issueId)
      .eq('article_module_id', moduleId)
      .maybeSingle()

    if (error) {
      log.error({ err: error, postId, issueId, moduleId }, 'moduleArticleExists failed')
      return false
    }
    return !!data
  } catch (err) {
    log.error({ err, postId }, 'moduleArticleExists exception')
    return false
  }
}

/**
 * List articles awaiting body generation for a (issue, module).
 * Definition: `content === ''` AND `headline` IS NOT NULL, ordered by post_id
 * for deterministic batching, capped by `limit`.
 */
export async function listArticlesNeedingBody(
  issueId: string,
  moduleId: string,
  limit: number
): Promise<any[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('module_articles')
      .select(MODULE_ARTICLE_BODY_GEN_SELECT)
      .eq('issue_id', issueId)
      .eq('article_module_id', moduleId)
      .eq('content', '')
      .not('headline', 'is', null)
      .order('post_id', { ascending: true })
      .limit(limit)

    if (error) {
      log.error({ err: error, issueId, moduleId }, 'listArticlesNeedingBody failed')
      return []
    }
    return data || []
  } catch (err) {
    log.error({ err, issueId, moduleId }, 'listArticlesNeedingBody exception')
    return []
  }
}

/**
 * List articles awaiting fact-check for a (issue, module).
 * Definition: content NOT empty AND fact_check_score IS NULL.
 */
export async function listArticlesNeedingFactCheck(
  issueId: string,
  moduleId: string
): Promise<any[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('module_articles')
      .select(MODULE_ARTICLE_FACT_CHECK_SELECT)
      .eq('issue_id', issueId)
      .eq('article_module_id', moduleId)
      .neq('content', '')
      .not('content', 'is', null)
      .is('fact_check_score', null)

    if (error) {
      log.error({ err: error, issueId, moduleId }, 'listArticlesNeedingFactCheck failed')
      return []
    }
    return data || []
  } catch (err) {
    log.error({ err, issueId, moduleId }, 'listArticlesNeedingFactCheck exception')
    return []
  }
}

export type NewModuleArticle = {
  post_id: string
  issue_id: string
  article_module_id: string
} & Record<string, any> // The ModuleArticle type in database.ts is missing
  // some columns the table actually has (e.g., `member_name`); fixing the
  // type is out of scope for this DAL.

/**
 * Insert a single module_article row. Duplicate-key (23505) is silently
 * tolerated — preserves the existing pattern used by title generation.
 */
export async function insertModuleArticle(
  article: NewModuleArticle
): Promise<{ ok: boolean; duplicate: boolean }> {
  try {
    const { error } = await supabaseAdmin
      .from('module_articles')
      .insert([article])

    if (error) {
      if (error.code === '23505') return { ok: false, duplicate: true }
      log.error({ err: error, postId: article.post_id }, 'insertModuleArticle failed')
      return { ok: false, duplicate: false }
    }
    return { ok: true, duplicate: false }
  } catch (err) {
    log.error({ err, postId: article.post_id }, 'insertModuleArticle exception')
    return { ok: false, duplicate: false }
  }
}

/**
 * Update body content + word count on a module_article.
 */
export async function updateModuleArticleContent(
  id: string,
  patch: { content: string; wordCount: number }
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('module_articles')
      .update({ content: patch.content, word_count: patch.wordCount })
      .eq('id', id)

    if (error) {
      log.error({ err: error, articleId: id }, 'updateModuleArticleContent failed')
      return false
    }
    return true
  } catch (err) {
    log.error({ err, articleId: id }, 'updateModuleArticleContent exception')
    return false
  }
}

/**
 * Update fact-check fields on a module_article. Used both on success
 * (numeric score + details) and failure (score=0 + error string).
 */
export async function updateModuleArticleFactCheck(
  id: string,
  patch: { score: number; details: string | null }
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('module_articles')
      .update({ fact_check_score: patch.score, fact_check_details: patch.details })
      .eq('id', id)

    if (error) {
      log.error({ err: error, articleId: id }, 'updateModuleArticleFactCheck failed')
      return false
    }
    return true
  } catch (err) {
    log.error({ err, articleId: id }, 'updateModuleArticleFactCheck exception')
    return false
  }
}

/**
 * Tickers featured as an active article in a publication's recent issues.
 * Used to enforce a cross-issue ticker cooldown during article selection.
 *
 * Returns the distinct set of UPPER-CASED tickers that were `is_active`
 * module_articles in issues dated within `[issueDate - cooldownDays, issueDate]`,
 * excluding the issue currently being built. Issue status is intentionally NOT
 * filtered — sent, in-review, and draft issues all count. On any failure
 * returns an empty set, degrading safely to "no cooldown".
 */
export async function listRecentlyFeaturedTickers(
  publicationId: string,
  issueDate: string,
  cooldownDays: number,
  excludeIssueId: string
): Promise<Set<string>> {
  try {
    // Local-date arithmetic (no toISOString/UTC shift) — issueDate is a plain
    // YYYY-MM-DD; parse, subtract, and format all in the same (local) frame.
    const cutoff = new Date(`${issueDate}T00:00:00`)
    cutoff.setDate(cutoff.getDate() - cooldownDays)
    const cutoffDate = toLocalDateStr(cutoff)

    // fetchAllPaginated pages past Supabase's silent 1000-row cap. The
    // publication_issues!inner join is required: the publication_issues.*
    // dot-notation filters only run as a server-side WHERE with an !inner
    // join — a !left join would filter client-side and leak other
    // publications' rows.
    const rows = await fetchAllPaginated<{ ticker: string | null }>(() =>
      supabaseAdmin
        .from('module_articles')
        .select('ticker, publication_issues!inner(publication_id, date)')
        .eq('is_active', true)
        .not('ticker', 'is', null)
        .eq('publication_issues.publication_id', publicationId)
        .gte('publication_issues.date', cutoffDate)
        .lte('publication_issues.date', issueDate)
        .neq('issue_id', excludeIssueId) as any
    )

    const tickers = new Set<string>()
    for (const row of rows) {
      if (row.ticker) tickers.add(String(row.ticker).toUpperCase())
    }
    return tickers
  } catch (err) {
    log.error({ err, publicationId }, 'listRecentlyFeaturedTickers failed')
    return new Set()
  }
}

// ==================== manual_articles ====================
//
// Note: the `ManualArticle` type in src/types/database.ts is stale; the actual
// table schema is { publication_id, title, slug, body, image_url, section_type,
// category_id, publish_date, status }. Local types here reflect the real shape;
// fixing database.ts is out of scope for step 2.

export type ManualArticleRow = {
  id: string
  publication_id: string
  title: string
  slug: string
  body: string
  image_url: string | null
  section_type: string
  category_id: string | null
  publish_date: string
  status: ManualArticleStatus
  created_at?: string
  updated_at?: string
}

export const MANUAL_ARTICLE_COLUMNS = `
  id, publication_id, title, slug, body, image_url, section_type,
  category_id, publish_date, status, created_at, updated_at
` as const

export const MANUAL_ARTICLE_WITH_CATEGORY_SELECT = `
  ${MANUAL_ARTICLE_COLUMNS},
  category:article_categories(id, name, slug)
` as const

/**
 * List manual articles for a publication, optionally filtered by status.
 */
export async function listManualArticlesByPublication(
  publicationId: string,
  opts: { status?: ManualArticleStatus | ManualArticleStatus[] } = {}
): Promise<any[]> {
  try {
    let query = supabaseAdmin
      .from('manual_articles')
      .select(MANUAL_ARTICLE_WITH_CATEGORY_SELECT)
      .eq('publication_id', publicationId)
      .order('publish_date', { ascending: false })

    if (opts.status) {
      if (Array.isArray(opts.status)) query = query.in('status', opts.status)
      else query = query.eq('status', opts.status)
    }

    const { data, error } = await query

    if (error) {
      log.error({ err: error, publicationId }, 'listManualArticlesByPublication failed')
      return []
    }
    return data || []
  } catch (err) {
    log.error({ err, publicationId }, 'listManualArticlesByPublication exception')
    return []
  }
}

/**
 * Resolve a slug for a publication, suffixing `-2`, `-3`, ... until a free
 * slot is found. Single round-trip: fetch all slugs starting with the base
 * via `LIKE 'baseSlug%'`, then scan in memory for the first free candidate.
 */
export async function findNextAvailableSlug(
  baseSlug: string,
  publicationId: string
): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .from('manual_articles')
      .select('slug')
      .eq('publication_id', publicationId)
      .like('slug', `${baseSlug}%`)

    if (error) {
      log.error({ err: error, baseSlug, publicationId }, 'findNextAvailableSlug query failed')
      return baseSlug
    }

    const taken = new Set((data || []).map(r => r.slug))
    if (!taken.has(baseSlug)) return baseSlug

    // Walk -2, -3, ... until we find a free slot. Bounded by `taken.size + 1`
    // — at most one more than the number of rows fetched.
    for (let counter = 2; counter <= taken.size + 1; counter += 1) {
      const candidate = `${baseSlug}-${counter}`
      if (!taken.has(candidate)) return candidate
    }
    // Unreachable in practice, but a defensive fallback.
    return `${baseSlug}-${taken.size + 1}`
  } catch (err) {
    log.error({ err, baseSlug }, 'findNextAvailableSlug exception')
    return baseSlug
  }
}

export type NewManualArticle = Omit<ManualArticleRow, 'id' | 'created_at' | 'updated_at'>

/**
 * Insert a manual article. Returns the inserted row (with category join) or
 * null on failure.
 */
export async function insertManualArticle(
  article: NewManualArticle
): Promise<ManualArticleRow | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('manual_articles')
      .insert([article])
      .select(MANUAL_ARTICLE_WITH_CATEGORY_SELECT)
      .single()

    if (error || !data) {
      log.error({ err: error, publicationId: article.publication_id }, 'insertManualArticle failed')
      return null
    }
    return data as any
  } catch (err) {
    log.error({ err, publicationId: article.publication_id }, 'insertManualArticle exception')
    return null
  }
}

/**
 * Update a manual article. Requires `publicationId` for tenant isolation.
 */
export async function updateManualArticle(
  id: string,
  publicationId: string,
  patch: Partial<Omit<ManualArticleRow, 'id' | 'publication_id' | 'created_at'>>
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('manual_articles')
      .update(patch)
      .eq('id', id)
      .eq('publication_id', publicationId)

    if (error) {
      log.error({ err: error, id, publicationId }, 'updateManualArticle failed')
      return false
    }
    return true
  } catch (err) {
    log.error({ err, id }, 'updateManualArticle exception')
    return false
  }
}

/**
 * Delete a manual article. Requires `publicationId` for tenant isolation.
 */
export async function deleteManualArticle(
  id: string,
  publicationId: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('manual_articles')
      .delete()
      .eq('id', id)
      .eq('publication_id', publicationId)

    if (error) {
      log.error({ err: error, id, publicationId }, 'deleteManualArticle failed')
      return false
    }
    return true
  } catch (err) {
    log.error({ err, id }, 'deleteManualArticle exception')
    return false
  }
}
