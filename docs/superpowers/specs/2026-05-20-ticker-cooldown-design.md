---
name: ticker-cooldown
description: Cross-issue ticker cooldown to stop the same company recurring as a lead trade article on consecutive issues
status: complete
created: 2026-05-20T13:49:49Z
updated: 2026-05-20T14:02:54Z
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
  fewer than N days apart, for article modules that opt in.
- Never leave an issue short of articles purely because of the cooldown.
- Zero behavior change for article modules that do not opt in.
- Provide a settings-page control to enable/disable the cooldown and adjust the
  window, without editing the database directly.

## Non-Goals

- No change to the article-text deduplication system.
- No cooldown keyed on `member_name` or `transaction_type` — ticker only.
- No database schema migration.

## Design

### 1. Setting: `config.ticker_cooldown_days` on the article module

The cooldown is configured per **article module**, stored in the existing
`article_modules.config` JSON column as `ticker_cooldown_days` — the same column
that already holds the module's `candidate_multiplier`.

- Type: integer, number of days.
- Absent / not set: cooldown disabled. The cooldown code path is fully skipped —
  no query, no filtering, identical behavior to today.
- Present (`>= 1`): cooldown enabled with that window.
- No `publication_settings` / `app_settings` / `getPublicationSetting`
  involvement, and no new API route — `assignPostsToModule` already loads the
  module and reads `config`, and the settings UI already persists `config` via
  the existing `PATCH /api/article-modules/[id]` route.
- Per-module granularity is correct: the cooldown applies during
  `assignPostsToModule(issueId, moduleId)`. Trader Leak has a single article
  module (`9f9cd920-c2fe-4b46-92f0-abd453e4d661`), so per-module and
  per-publication are equivalent for it today.

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
already loads the module via `ArticleModuleSelector.getModule(moduleId)` and
reads `mod.config` (for `candidate_multiplier`). It currently sorts candidates by
score and runs the intra-issue `seenTickers` loop (lines ~147-165). That loop is
replaced by a single call to `selectPostsWithTickerCooldown`, which subsumes the
intra-issue dedup (a post is skipped if its ticker was already selected this
issue) — so there is one selection code path whether or not cooldown is enabled:

- Read `cooldownDays` from `mod.config.ticker_cooldown_days`.
- If set and `>= 1`: fetch the current issue's `publication_id` and `date`
  (`publication_issues.select('publication_id, date')`) and call
  `listRecentlyFeaturedTickers` to build the cooldown set.
- If absent: use an empty cooldown set and skip the DAL query.
- Always run candidate selection through `selectPostsWithTickerCooldown`. With
  an empty cooldown set its output is identical to today's intra-issue
  `seenTickers` behavior (covered by a test), so a module without the setting
  sees no change.

### 5. Logging

One-line summary per the project logging rule, e.g.:

```
[Module] Ticker cooldown (7d): 12 candidates → 8 selected, 4 skipped (cooldown), 1 backfilled to meet minimum
```

### 6. Settings UI control

Location: **Settings → Sections → [article module] → General tab → "Article
Selection Settings"** (`src/components/article-modules/ArticleModuleGeneralTab.tsx`),
added after the existing "Extra Candidates" control.

It mirrors the "Extra Candidates" pattern exactly — a toggle plus an inline
number input:

- **Toggle "Ticker cooldown"** — off by default. Off → removes
  `ticker_cooldown_days` from `module.config`. On → writes the days value
  (defaulting to `7` when first enabled).
- **Number input "Cooldown days"** — shown only while the toggle is on; accepts
  `1`–`30`. Help text explains it prevents the same company (ticker) being
  selected again within N days, and that it applies to trades-style modules.

Persistence reuses the module's existing `onUpdate({ config })` path
(`PATCH /api/article-modules/[id]`) — the same call `handleMultiplierChange`
already uses for `candidate_multiplier`. No new API route, no email-settings
changes.

The control renders for every article module. For modules whose posts carry no
ticker it is simply inert (see Edge Cases).

### 7. Tests

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
- **Non-trades modules** — their posts have `ticker = null`; even if the
  cooldown is enabled on such a module, no post can be on cooldown, so it is a
  no-op.
- **DAL query failure** — `listRecentlyFeaturedTickers` returns an empty set,
  degrading safely to "no cooldown" rather than blocking the workflow.
- **Same-date sibling issues** (e.g. a secondary send) — excluded by
  `excludeIssueId` for the current issue; other same-date issues are still
  counted as recent history.

## Rollout

1. Ship the code change (cooldown absent on every module → no behavior change
   anywhere).
2. Enable it for Trader Leak's article module: Settings → Sections → the
   Politician Trades article module → General → Article Selection Settings →
   toggle "Ticker cooldown" on, set `7` days.
3. Verify on the next Trader Leak issue build that recently-featured tickers are
   skipped and the log line appears.
