import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { generateMissingFeedTradeImages } from '@/lib/rss-combiner'
import { resolveIssueTradeImages, listTradeImageFiles } from '@/lib/article-modules/resolve-issue-trade-images'
import { toLocalDateStr } from '@/lib/date-utils'
import { fetchAllPaginated } from '@/lib/dal/paginate'

// Cap issues processed per invocation so the work fits within maxDuration.
// If more remain, the response says so — re-run to continue.
const MAX_ISSUES_PER_RUN = 20

/**
 * One-shot backfill for trade card images (manual, Bearer CRON_SECRET).
 *
 * 1. Generates any missing per-(ticker, member, transaction) trade cards for the
 *    current feed window (same routine the ingestion cron now runs).
 * 2. Re-resolves trade_image_url on every NOT-yet-sent issue that has trade
 *    articles, using strict composite-key matching (no ticker fallback). Sent
 *    issues are left untouched — they're history.
 *
 * Safe to run repeatedly. Intended to be removed or left gated after the
 * per-tuple image fix ships.
 */
const handler = withApiHandler(
  { authTier: 'system', logContext: 'backfill-trade-images' },
  async ({ logger }) => {
    // Step 1: fill the image library.
    const imagesGenerated = await generateMissingFeedTradeImages()
    logger.info({ imagesGenerated }, 'Per-tuple trade image generation complete')

    // Step 2: re-resolve unsent issues with trade articles. Bound to recent
    // issues so we don't reprocess ancient drafts.
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffDate = toLocalDateStr(cutoff)

    const { data: issues } = await supabaseAdmin
      .from('publication_issues')
      .select('id, publication_id, date, status')
      .neq('status', 'sent')
      .gte('date', cutoffDate)
      .order('date', { ascending: false })

    const candidateIds = (issues || []).map((i) => i.id)

    // Keep only issues that actually have trade (ticker-bearing) articles.
    const withTrades = new Set<string>()
    if (candidateIds.length > 0) {
      const tradeArticles = await fetchAllPaginated<{ issue_id: string }>(
        () =>
          supabaseAdmin
            .from('module_articles')
            .select('issue_id')
            .in('issue_id', candidateIds)
            .not('ticker', 'is', null),
        { label: 'backfill-trade-images:find-trade-issues' }
      )
      for (const a of tradeArticles) withTrades.add(a.issue_id)
    }

    // Process newest-first, capped per run so we stay within maxDuration.
    const eligible = (issues || []).filter((i) => withTrades.has(i.id))
    const toProcess = eligible.slice(0, MAX_ISSUES_PER_RUN)
    if (eligible.length > toProcess.length) {
      logger.warn(
        { eligible: eligible.length, cap: MAX_ISSUES_PER_RUN },
        'More eligible issues than the per-run cap — re-run to continue'
      )
    }

    const issueResults: Array<{
      issueId: string
      publicationId: string
      date: string | null
      matched: number
      cleared: number
      unchanged: number
    }> = []

    let totalMatched = 0
    let totalCleared = 0

    // List the trade-image storage prefix once and reuse it across every issue
    // (the listing is expensive — re-listing per issue would be N× the I/O).
    const { files: existingFiles, failed: storageListFailed } = await listTradeImageFiles()

    for (const issue of toProcess) {
      logger.info({ issueId: issue.id, date: issue.date }, 'Resolving issue trade images')

      const resolution = await resolveIssueTradeImages(issue.id, { existingFiles, storageListFailed })
      if (!resolution.ok) {
        logger.warn({ issueId: issue.id, error: resolution.error }, 'Issue resolution failed')
        continue
      }

      const matched = resolution.results.reduce((s, r) => s + r.matched, 0)
      const cleared = resolution.results.reduce((s, r) => s + r.cleared, 0)
      const unchanged = resolution.results.reduce((s, r) => s + r.unchanged, 0)
      totalMatched += matched
      totalCleared += cleared

      issueResults.push({
        issueId: issue.id,
        publicationId: issue.publication_id,
        date: issue.date,
        matched,
        cleared,
        unchanged,
      })
    }

    const remaining = Math.max(0, eligible.length - toProcess.length)
    logger.info(
      { imagesGenerated, issuesProcessed: issueResults.length, remaining, totalMatched, totalCleared },
      'Trade image backfill complete'
    )

    return NextResponse.json({
      success: true,
      imagesGenerated,
      issuesProcessed: issueResults.length,
      remaining,
      totalMatched,
      totalCleared,
      issues: issueResults,
      timestamp: new Date().toISOString(),
    })
  }
)

// POST only — this endpoint mutates data, so it must never be triggered by a GET.
export const POST = handler

export const maxDuration = 600
