---
name: ticker-cooldown
description: Cross-issue ticker cooldown to stop the same company recurring as a lead trade article on consecutive issues
status: complete
created: 2026-05-20T13:49:49Z
updated: 2026-05-20T13:49:49Z
---

# Cross-Issue Ticker Cooldown

## Problem

On 2026-05-19 and 2026-05-20, the Trader Leak publication
(`8277682a-7292-4c36-bca1-a39ca420b305`) featured the same congressional trade
— Michael T. McCaul selling Cencora (`COR`) — as a top article two days in a
row. The 5/19 article (`module_articles` `70beac99`, post `579fc764`) and the
5/20 article (post `2570c7e1`) were built from two **different** Yahoo Finance
news stories:

- 5/19: "Cencora Legal Probes Test Investor Confidence After Weaker Q2 Revenue Outlook"
- 5/20: "The Top 5 Analyst Questions From Cencora's Q1 Earnings Call"

The 5/20 issue was caught in review and manually corrected before send.

### Root cause

The existing deduplication system (`src/lib/deduplicator.ts`) de-duplicates
**news articles** across recent issues via three checks: exact content hash,
headline Jaccard similarity (threshold `0.7` for Trader Leak), and AI semantic
comparison of article text. It ran correctly on the 5/20 issue (creating four
historical-match groups) and the 5/19 issue *was* sent and inside the lookback
window — so this was not a timing miss.

The two Cencora items are genuinely different news stories, so every
article-level check correctly concluded they were not the same article. The gap
is that Trader Leak articles are organized around a **trade**
(`ticker` + `member_name` + `transaction_type`), and the "Politician Trades"
feed supplies whatever fresh news exists about a ticker. A heavily-covered stock
(`COR` is under multiple securities-fraud investigations) keeps generating new
articles, so the same trade resurfaces day after day on a different news hook.

The only ticker de-duplication that exists is the `seenTickers` loop in
`ModuleArticles.assignPostsToModule` (`src/lib/rss-processor/module-articles.ts`)
— "one article per company" — and it is **intra-issue only**. Nothing checks
whether a ticker was featured in a *recent* issue.

This is systemic. Other repeated tickers in active `module_articles` over the
prior 10 days: `GS`/Salazar (5/11, 5/13 — within a 3-day window), `MSFT`/Gottheimer
(5/14, 5/17), `TSM`/Cleo Fields (5/11, 5/20).

## Goals

- Prevent the same `ticker` from being selected as an article in issues that are
  fewer than N days apart, for publications that opt in.
- Never leave an issue short of articles purely because of the cooldown.
- Zero behavior change for publications that do not opt in.

## Non-Goals

- No change to the article-text deduplication system.
- No cooldown keyed on `member_name` or `transaction_type` — ticker only.
- No dashboard UI control in this iteration (the setting is configured directly
  in the database; a settings-page toggle is a possible later addition).
- No database schema migration.

## Design

### 1. Setting: `ticker_cooldown_days`

A new key/value setting resolved through the standard two-tier fallback
(`getPublicationSetting` → `publication_settings`, then `app_settings`).

- Type: integer, number of days.
- Default: `0` (disabled). When `0` or absent, the cooldown code path is fully
  skipped — no query, no filtering, identical behavior to today.
- Trader Leak: a `publication_settings` row set to `7`.
- An optional `app_settings` row of `0` may be added to document the default;
  it is not required for correctness since an absent setting resolves to `0`.

### 2. DAL function: `listRecentlyFeaturedTickers`

New function in `src/lib/dal/articles.ts`:

```
listRecentlyFeaturedTickers(
  publicationId: string,
  issueDate: string,        // YYYY-MM-DD of the issue being built
  cooldownDays: number,
  excludeIssueId: string,   // the issue currently being built
): Promise<Set<string>>
```

Returns the distinct set of tickers that were active `module_articles`
(`is_active = true`, `ticker IS NOT NULL`) in any of that publication's issues
dated within `[issueDate − cooldownDays, issueDate]`, excluding `excludeIssueId`.

- Issue **status is not filtered** — sent, in-review, and draft issues all
  count. This makes the cooldown robust when the previous day's issue is still
  in review when the next issue is built.
- Date comparison uses local date strings (`YYYY-MM-DD`), per the project date
  rule — no `toISOString()` for logic.
- Follows DAL conventions: explicit column list, filters by `publication_id`,
  errors logged via pino and swallowed (returns an empty set on failure, which
  degrades safely to "no cooldown").

### 3. Pure selection function: `selectPostsWithTickerCooldown`

New file `src/lib/rss-processor/ticker-cooldown.ts` exporting a pure,
side-effect-free function:

```
selectPostsWithTickerCooldown(
  sortedPosts: PostWithTicker[],   // already sorted by score, descending
  cooldownTickers: Set<string>,    // from listRecentlyFeaturedTickers
  articlesNeeded: number,          // module.articles_count — the minimum
  postsToAssign: number,           // candidate target (>= articlesNeeded)
): { selected: PostWithTicker[]; skippedByCooldown: number; backfilled: number }
```

Logic:

1. **Primary pass** — walk `sortedPosts` by score. Take one post per ticker, up
   to `postsToAssign`. Skip a post if its (upper-cased) ticker has already been
   selected in this issue *or* is in `cooldownTickers`. Cooldown-skipped posts
   are remembered for the backfill pass.
2. **Backfill pass** — if the primary pass selected fewer than `articlesNeeded`
   posts, walk the cooldown-skipped posts (highest score first, still one per
   ticker) and add them until `selected.length` reaches `articlesNeeded` or the
   pool is exhausted.

Posts with a falsy/empty ticker are passed through by the existing per-ticker
logic exactly as today (never filtered, never deduped on ticker).

Being a pure function, it is unit-tested directly with no database mocking.

### 4. Wiring in `assignPostsToModule`

`ModuleArticles.assignPostsToModule` (`src/lib/rss-processor/module-articles.ts`)
currently sorts candidates by score and runs the intra-issue `seenTickers`
loop (lines ~147-165). That loop is replaced by a single call to
`selectPostsWithTickerCooldown`, which subsumes the intra-issue dedup (a post is
skipped if its ticker was already selected this issue) — so there is one
selection code path whether or not cooldown is enabled:

- Fetch the issue's `publication_id` and `date` in one query
  (`select('publication_id, date')`).
- Read `ticker_cooldown_days` via `getPublicationSetting`.
- If `> 0`: call `listRecentlyFeaturedTickers` to build the cooldown set.
- If `0`: use an empty cooldown set and skip the DAL query.
- Always run candidate selection through `selectPostsWithTickerCooldown`. With
  an empty cooldown set its output is identical to today's intra-issue
  `seenTickers` behavior (covered by a test), so a disabled publication sees no
  change.

### 5. Logging

One-line summary per the project logging rule, e.g.:

```
[Module] Ticker cooldown (7d): 12 candidates → 8 selected, 4 skipped (cooldown), 1 backfilled to meet minimum
```

### 6. Tests

Unit tests (Vitest):

- `selectPostsWithTickerCooldown`:
  - cooldown set filters a ticker out of the primary pass;
  - backfill restores cooldown-skipped posts when the primary pass is short of
    `articlesNeeded`;
  - no backfill when the primary pass already meets `articlesNeeded`;
  - posts with `null`/empty ticker are unaffected;
  - empty cooldown set produces the same result as the pre-existing intra-issue
    dedup.
- `listRecentlyFeaturedTickers`: date-window boundaries (inclusive of
  `issueDate − cooldownDays`), `is_active = true` filter, `excludeIssueId`
  exclusion, `publication_id` scoping.

## Edge Cases

- **Cooldown empties the pool** — handled by the backfill pass; the issue still
  fills `articles_count` slots, drawing from the least-recently-acceptable
  cooled-down tickers (ordered by score).
- **Non-trades publications** — their posts have `ticker = null`; the setting
  defaults to `0` anyway, so there is no effect even if enabled.
- **DAL query failure** — `listRecentlyFeaturedTickers` returns an empty set,
  degrading safely to "no cooldown" rather than blocking the workflow.
- **Same-date sibling issues** (e.g. a secondary send) — excluded by
  `excludeIssueId` for the current issue; other same-date issues are still
  counted as recent history.

## Rollout

1. Ship the code change (default `0`, no behavior change anywhere).
2. Insert `publication_settings` row: Trader Leak `ticker_cooldown_days = 7`.
3. Verify on the next Trader Leak issue build that recently-featured tickers are
   skipped and the log line appears.
