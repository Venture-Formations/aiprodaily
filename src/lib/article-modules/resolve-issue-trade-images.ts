import { supabaseAdmin } from '../supabase'
import { buildTradeImageKey } from '../trade-image-key'
import { fetchAllPaginated } from '../dal/paginate'

export interface ResolveModuleResult {
  moduleId: string
  matched: number
  cleared: number
  unchanged: number
  total: number
}

export interface ResolveIssueTradeImagesResult {
  ok: boolean
  /** Set when ok === false. */
  error?: string
  /** HTTP-ish status hint for callers (404 issue not found, 500 query failure). */
  status?: number
  /** Owning publication, for tenant-scoped follow-up queries by callers. */
  publicationId?: string
  results: ResolveModuleResult[]
}

/**
 * Re-resolve trade card images for every module_article in an issue.
 *
 * Each article's image is matched strictly by its (ticker, member_name,
 * transaction_type) tuple against `congress_trades.image_url`, after verifying
 * the underlying PNG still exists in Supabase Storage. There is intentionally
 * NO ticker-only fallback and NO rss_posts.image_url fallback: a ticker-level
 * image showed the wrong member's photo and buy/sell side, and rss_posts is the
 * stale source we're correcting. When no exact tuple image exists, the article's
 * trade_image_url is cleared to null — a missing image beats a wrong one.
 *
 * Shared by the recheck-images API route and the backfill endpoint.
 */
/**
 * List every generated trade card PNG under the `img/st/t` storage prefix.
 * Returns the set of filenames and whether the listing failed (so callers can
 * avoid wiping good URLs on a transient Storage error). Expensive — callers that
 * resolve many issues should list once and pass `existingFiles` into
 * resolveIssueTradeImages rather than re-listing per issue.
 */
export async function listTradeImageFiles(): Promise<{ files: Set<string>; failed: boolean }> {
  const files = new Set<string>()
  const pageSize = 1000
  const maxPages = 200 // 200k files — a backstop so a runaway listing can't hang the request
  let offset = 0
  let page = 0
  while (true) {
    if (page++ >= maxPages) {
      console.error(`[resolveIssueTradeImages] Storage listing exceeded ${maxPages} pages — treating as failed`)
      return { files, failed: true }
    }
    const { data, error } = await supabaseAdmin.storage
      .from('img')
      .list('st/t', { limit: pageSize, offset })

    if (error) {
      console.error('[resolveIssueTradeImages] Storage list error:', error.message)
      return { files, failed: true }
    }
    // Null data without an error (seen under rate limiting) means we can't trust
    // the listing — treat as failed so callers preserve existing URLs rather
    // than clearing images for files we simply didn't see.
    if (!data) {
      console.error('[resolveIssueTradeImages] Storage list returned null data without error')
      return { files, failed: true }
    }
    if (data.length === 0) break
    for (const f of data) files.add(f.name)
    if (data.length < pageSize) break
    offset += pageSize
  }
  return { files, failed: false }
}

export async function resolveIssueTradeImages(
  issueId: string,
  opts: { existingFiles?: Set<string>; storageListFailed?: boolean } = {}
): Promise<ResolveIssueTradeImagesResult> {
  // Confirm the issue exists (publication_id used for module-name scoping only).
  const { data: issue, error: issueError } = await supabaseAdmin
    .from('publication_issues')
    .select('id, publication_id')
    .eq('id', issueId)
    .single()

  if (issueError || !issue) {
    return { ok: false, error: 'Issue not found', status: 404, results: [] }
  }

  let articles: Array<{
    id: string
    article_module_id: string
    trade_image_url: string | null
    trade_image_alt: string | null
    ticker: string | null
    member_name: string | null
    transaction_type: string | null
    rss_post: unknown
  }>
  try {
    articles = await fetchAllPaginated(
      () =>
        supabaseAdmin
          .from('module_articles')
          .select(`
            id,
            article_module_id,
            trade_image_url,
            trade_image_alt,
            ticker,
            member_name,
            transaction_type,
            rss_post:rss_posts(ticker, member_name, transaction_type)
          `)
          .eq('issue_id', issueId),
      { label: 'resolveIssueTradeImages:module-articles' }
    )
  } catch (articlesError) {
    console.error('[resolveIssueTradeImages] Failed to fetch module articles:', articlesError instanceof Error ? articlesError.message : articlesError)
    return { ok: false, error: 'Failed to fetch module articles', status: 500, results: [] }
  }

  if (!articles || articles.length === 0) {
    return { ok: true, publicationId: issue.publication_id, results: [] }
  }

  const getRssPost = (a: unknown): { ticker?: string | null; member_name?: string | null; transaction_type?: string | null } | null => {
    const rp = (a as { rss_post?: unknown }).rss_post
    return (Array.isArray(rp) ? rp[0] : rp) || null
  }

  // Collect tickers from articles and their linked rss_posts.
  const tickers = Array.from(new Set(
    articles.flatMap((a) => {
      const rssPost = getRssPost(a)
      return [a.ticker, rssPost?.ticker].filter(Boolean)
    })
  )) as string[]

  const validImageByKey = new Map<string, string>()

  if (tickers.length > 0) {
    // All congress_trades rows for these tickers with a generated image.
    // Newest first so the most recent row per tuple wins. Paginate — active
    // tickers can exceed Supabase's 1000-row default, and a truncated tail
    // would clear (not just miss) an article's valid image since there's no
    // fallback.
    let tradeRows: Array<{ id: string; ticker: string; image_url: string; name: string | null; transaction: string | null }>
    try {
      tradeRows = await fetchAllPaginated(
        () =>
          supabaseAdmin
            .from('congress_trades')
            .select('id, ticker, image_url, name, transaction, quiver_upload_time')
            .in('ticker', tickers)
            .not('image_url', 'is', null)
            .order('quiver_upload_time', { ascending: false, nullsFirst: false }),
        { label: 'resolveIssueTradeImages:trade-images' }
      )
    } catch (tradeError) {
      console.error('[resolveIssueTradeImages] Failed to query congress_trades:', tradeError instanceof Error ? tradeError.message : tradeError)
      return { ok: false, error: 'Failed to query trade images', status: 500, results: [] }
    }

    // Verify file existence via the Storage API (URLs can point to deleted PNGs).
    // Callers resolving many issues pass a pre-listed set to avoid re-listing.
    let existingFiles = opts.existingFiles
    let storageListFailed = opts.storageListFailed ?? false
    if (!existingFiles) {
      const listed = await listTradeImageFiles()
      existingFiles = listed.files
      storageListFailed = listed.failed
    }

    // If the storage listing failed, the file set may be incomplete — a partial
    // failure on a later page leaves earlier names present (size > 0) but later
    // ones missing, which would wrongly clear good URLs. Bail whenever the
    // listing failed and there's anything to verify.
    if (storageListFailed && tradeRows.length > 0) {
      console.warn('[resolveIssueTradeImages] Storage listing failed, skipping updates to preserve existing URLs')
      return {
        ok: false,
        error: 'Storage listing failed — image URLs not updated to avoid data loss. Try again.',
        status: 503,
        results: [],
      }
    }

    for (const row of tradeRows) {
      if (!existingFiles.has(`${row.id}.png`)) continue
      const compositeKey = buildTradeImageKey(row.ticker, row.name, row.transaction)
      if (compositeKey && !validImageByKey.has(compositeKey)) {
        validImageByKey.set(compositeKey, row.image_url)
      }
    }
  }

  const moduleResults = new Map<string, ResolveModuleResult>()
  const getStats = (moduleId: string): ResolveModuleResult => {
    let stats = moduleResults.get(moduleId)
    if (!stats) {
      stats = { moduleId, matched: 0, cleared: 0, unchanged: 0, total: 0 }
      moduleResults.set(moduleId, stats)
    }
    return stats
  }

  // Updates are independent by article id — run them concurrently rather than
  // one sequential round-trip per article.
  const updates: PromiseLike<void>[] = []

  for (const article of articles) {
    const stats = getStats(article.article_module_id)
    stats.total++

    const rssPost = getRssPost(article)
    const articleTicker = article.ticker || rssPost?.ticker || null
    const memberName = article.member_name || rssPost?.member_name || null
    const transaction = article.transaction_type || rssPost?.transaction_type || null

    const articleCompositeKey = buildTradeImageKey(articleTicker, memberName, transaction)
    const resolvedImage = (articleCompositeKey ? validImageByKey.get(articleCompositeKey) : null) || null
    const resolvedAlt = resolvedImage ? (articleTicker || null) : null

    if (resolvedImage === article.trade_image_url) {
      stats.unchanged++
      continue
    }

    updates.push(
      supabaseAdmin
        .from('module_articles')
        .update({ trade_image_url: resolvedImage, trade_image_alt: resolvedAlt })
        .eq('id', article.id)
        .then(({ error: updateError }) => {
          if (updateError) {
            console.error(`[resolveIssueTradeImages] Failed to update article ${article.id}:`, updateError.message)
            stats.unchanged++
          } else if (resolvedImage) {
            stats.matched++
          } else {
            stats.cleared++
          }
        })
    )
  }

  await Promise.allSettled(updates)

  return { ok: true, publicationId: issue.publication_id, results: Array.from(moduleResults.values()) }
}
