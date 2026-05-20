/**
 * Cooldown-aware candidate selection for article modules.
 *
 * Pure, side-effect-free. Replaces the intra-issue "one article per ticker"
 * loop in `assignPostsToModule` and additionally skips tickers featured in a
 * recent issue (the cross-issue cooldown). A backfill pass guarantees the
 * module is never left short purely because of the cooldown.
 */

/** Minimal shape the cooldown selector needs from a candidate post. */
export interface CandidatePost {
  id: string
  ticker?: string | null
}

export interface TickerCooldownResult<T> {
  /** Posts chosen for the module, in selection order. */
  selected: T[]
  /** Count of candidate posts skipped because their ticker was on cooldown. */
  skippedByCooldown: number
  /** Count of cooled-down posts restored by the backfill pass. */
  backfilled: number
}

/**
 * Select candidate posts for an article module, one per ticker, applying a
 * cross-issue ticker cooldown.
 *
 * @param sortedPosts      candidates already sorted by score, descending
 * @param cooldownTickers  UPPER-CASED tickers featured in a recent issue
 * @param articlesNeeded   minimum posts the module must fill (articles_count)
 * @param postsToAssign    upper bound on candidates to select; the primary pass
 *                         effectively uses max(postsToAssign, articlesNeeded) so
 *                         the module is never left short of articlesNeeded
 */
export function selectPostsWithTickerCooldown<T extends CandidatePost>(
  sortedPosts: T[],
  cooldownTickers: Set<string>,
  articlesNeeded: number,
  postsToAssign: number,
): TickerCooldownResult<T> {
  const selected: T[] = []
  const seenTickers = new Set<string>()
  const cooledDown: T[] = []
  let skippedByCooldown = 0

  // The primary pass never stops short of articlesNeeded — postsToAssign is
  // only an upper bound on extra candidates.
  const primaryTarget = Math.max(postsToAssign, articlesNeeded)

  // Primary pass: one post per ticker, skipping tickers on cooldown.
  for (const post of sortedPosts) {
    if (selected.length >= primaryTarget) break

    const ticker = post.ticker ? post.ticker.toUpperCase() : ''

    if (ticker && seenTickers.has(ticker)) {
      continue // already have a post for this company this issue
    }
    if (ticker && cooldownTickers.has(ticker)) {
      cooledDown.push(post)
      skippedByCooldown++
      continue
    }

    selected.push(post)
    if (ticker) seenTickers.add(ticker)
  }

  // Backfill pass: if the cooldown left us short of the minimum, restore the
  // highest-scored cooled-down posts (still one per ticker).
  let backfilled = 0
  for (const post of cooledDown) {
    if (selected.length >= articlesNeeded) break

    const ticker = post.ticker ? post.ticker.toUpperCase() : ''
    if (ticker && seenTickers.has(ticker)) continue

    selected.push(post)
    if (ticker) seenTickers.add(ticker)
    backfilled++
  }

  return { selected, skippedByCooldown, backfilled }
}
