# Cross-Issue Ticker Cooldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-article-module ticker cooldown that prevents the same company (ticker) from being selected as an article on issues fewer than N days apart.

**Architecture:** A pure selection function (`selectPostsWithTickerCooldown`) replaces the intra-issue "one article per ticker" loop in `assignPostsToModule`. It additionally skips tickers featured in recent issues — supplied by a new DAL function (`listRecentlyFeaturedTickers`) — and backfills if the cooldown would leave the module short. The window is configured per article module in `article_modules.config.ticker_cooldown_days`, edited via a toggle in the module's "Article Selection Settings" UI. Absent config = disabled = today's exact behavior.

**Tech Stack:** TypeScript, Next.js (App Router), Supabase (`supabaseAdmin`), Vitest, React.

**Spec:** `docs/superpowers/specs/2026-05-20-ticker-cooldown-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/rss-processor/ticker-cooldown.ts` | Pure cooldown-aware candidate selection | Create |
| `src/lib/rss-processor/__tests__/ticker-cooldown.test.ts` | Unit tests for the pure function | Create |
| `src/lib/dal/articles.ts` | Add `listRecentlyFeaturedTickers` | Modify |
| `src/lib/dal/__tests__/articles.test.ts` | Tests for `listRecentlyFeaturedTickers` | Modify |
| `src/lib/dal/index.ts` | Export `listRecentlyFeaturedTickers` | Modify |
| `src/lib/rss-processor/module-articles.ts` | Wire cooldown into `assignPostsToModule` | Modify |
| `src/components/article-modules/ArticleModuleGeneralTab.tsx` | Toggle + days input UI control | Modify |

---

## Setup

- [ ] **Create the feature branch**

Run:
```bash
git checkout staging
git pull
git checkout -b feature/ticker-cooldown
```
Expected: `Switched to a new branch 'feature/ticker-cooldown'`

---

## Task 1: Pure selection function `selectPostsWithTickerCooldown`

**Files:**
- Create: `src/lib/rss-processor/ticker-cooldown.ts`
- Test: `src/lib/rss-processor/__tests__/ticker-cooldown.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/rss-processor/__tests__/ticker-cooldown.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { selectPostsWithTickerCooldown } from '../ticker-cooldown'

const post = (id: string, ticker: string | null) => ({ id, ticker })

describe('selectPostsWithTickerCooldown', () => {
  it('with an empty cooldown set, behaves like one-per-ticker dedup', () => {
    const posts = [post('a', 'AAA'), post('b', 'AAA'), post('c', 'BBB')]
    const r = selectPostsWithTickerCooldown(posts, new Set<string>(), 3, 12)
    expect(r.selected.map(p => p.id)).toEqual(['a', 'c'])
    expect(r.skippedByCooldown).toBe(0)
    expect(r.backfilled).toBe(0)
  })

  it('skips a ticker that is on cooldown', () => {
    // articlesNeeded=2 and two non-cooldown posts exist, so no backfill.
    const posts = [post('a', 'COR'), post('b', 'IBM'), post('c', 'MKL')]
    const r = selectPostsWithTickerCooldown(posts, new Set(['COR']), 2, 12)
    expect(r.selected.map(p => p.id)).toEqual(['b', 'c'])
    expect(r.skippedByCooldown).toBe(1)
    expect(r.backfilled).toBe(0)
  })

  it('matches cooldown tickers case-insensitively', () => {
    // articlesNeeded=1 and one non-cooldown post exists, so no backfill.
    const posts = [post('a', 'cor'), post('b', 'IBM')]
    const r = selectPostsWithTickerCooldown(posts, new Set(['COR']), 1, 12)
    expect(r.selected.map(p => p.id)).toEqual(['b'])
  })

  it('backfills cooled-down posts when the primary pass is short of the minimum', () => {
    const posts = [post('a', 'COR'), post('b', 'IBM'), post('c', 'COR')]
    const r = selectPostsWithTickerCooldown(posts, new Set(['COR']), 2, 12)
    expect(r.selected.map(p => p.id)).toEqual(['b', 'a'])
    expect(r.skippedByCooldown).toBe(2)
    expect(r.backfilled).toBe(1)
  })

  it('does not backfill when the primary pass already meets the minimum', () => {
    const posts = [post('a', 'COR'), post('b', 'IBM'), post('c', 'MKL')]
    const r = selectPostsWithTickerCooldown(posts, new Set(['COR']), 2, 12)
    expect(r.selected.map(p => p.id)).toEqual(['b', 'c'])
    expect(r.backfilled).toBe(0)
  })

  it('never selects two posts for the same ticker, even via backfill', () => {
    const posts = [post('a', 'COR'), post('b', 'COR'), post('c', 'COR')]
    const r = selectPostsWithTickerCooldown(posts, new Set(['COR']), 3, 12)
    expect(r.selected.map(p => p.id)).toEqual(['a'])
    expect(r.backfilled).toBe(1)
  })

  it('passes through posts with no ticker without deduping them', () => {
    const posts = [post('a', null), post('b', null), post('c', 'COR')]
    const r = selectPostsWithTickerCooldown(posts, new Set(['COR']), 2, 12)
    expect(r.selected.map(p => p.id)).toEqual(['a', 'b'])
    expect(r.skippedByCooldown).toBe(1)
  })

  it('caps the primary pass at postsToAssign', () => {
    const posts = [post('a', 'A'), post('b', 'B'), post('c', 'C'), post('d', 'D')]
    const r = selectPostsWithTickerCooldown(posts, new Set<string>(), 2, 3)
    expect(r.selected.map(p => p.id)).toEqual(['a', 'b', 'c'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/rss-processor/__tests__/ticker-cooldown.test.ts`
Expected: FAIL — `Failed to resolve import "../ticker-cooldown"` (file does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/rss-processor/ticker-cooldown.ts`:

```typescript
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
 * @param postsToAssign    candidate target (>= articlesNeeded)
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

  // Primary pass: one post per ticker, skipping tickers on cooldown.
  for (const post of sortedPosts) {
    if (selected.length >= postsToAssign) break

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/rss-processor/__tests__/ticker-cooldown.test.ts`
Expected: PASS — 8 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rss-processor/ticker-cooldown.ts src/lib/rss-processor/__tests__/ticker-cooldown.test.ts
git commit -m "feat(rss): pure cooldown-aware article selection function"
```

---

## Task 2: DAL function `listRecentlyFeaturedTickers`

**Files:**
- Modify: `src/lib/dal/articles.ts` (append a new function)
- Modify: `src/lib/dal/index.ts:52-70` (add to the articles export block)
- Test: `src/lib/dal/__tests__/articles.test.ts` (add to import list + append a describe block)

- [ ] **Step 1: Write the failing test**

In `src/lib/dal/__tests__/articles.test.ts`, add `listRecentlyFeaturedTickers` to the import block. Change:

```typescript
import {
  listModuleArticlesByIssue,
  moduleArticleExists,
  listArticlesNeedingBody,
  listArticlesNeedingFactCheck,
  insertModuleArticle,
  updateModuleArticleContent,
  updateModuleArticleFactCheck,
  listManualArticlesByPublication,
  findNextAvailableSlug,
  insertManualArticle,
  updateManualArticle,
  deleteManualArticle,
} from '../articles'
```

to:

```typescript
import {
  listModuleArticlesByIssue,
  moduleArticleExists,
  listArticlesNeedingBody,
  listArticlesNeedingFactCheck,
  insertModuleArticle,
  updateModuleArticleContent,
  updateModuleArticleFactCheck,
  listManualArticlesByPublication,
  findNextAvailableSlug,
  insertManualArticle,
  updateManualArticle,
  deleteManualArticle,
  listRecentlyFeaturedTickers,
} from '../articles'
```

Then append this describe block to the end of the file:

```typescript
// ---------------------------------------------------------------------------
describe('listRecentlyFeaturedTickers', () => {
  it('returns the distinct, upper-cased set of recent active tickers', async () => {
    mockChainResult = {
      data: [{ ticker: 'COR' }, { ticker: 'ibm' }, { ticker: 'COR' }],
      error: null,
    }
    const result = await listRecentlyFeaturedTickers('pub-1', '2026-05-20', 7, 'iss-cur')
    expect(result).toEqual(new Set(['COR', 'IBM']))
  })

  it('computes the cutoff date as issueDate minus cooldownDays', async () => {
    mockChainResult = { data: [], error: null }
    await listRecentlyFeaturedTickers('pub-1', '2026-05-20', 7, 'iss-cur')
    expect(mockChain.gte).toHaveBeenCalledWith('publication_issues.date', '2026-05-13')
    expect(mockChain.lte).toHaveBeenCalledWith('publication_issues.date', '2026-05-20')
  })

  it('filters by is_active, non-null ticker, publication, and excludes the current issue', async () => {
    mockChainResult = { data: [], error: null }
    await listRecentlyFeaturedTickers('pub-1', '2026-05-20', 7, 'iss-cur')
    expect(mockChain.eq).toHaveBeenCalledWith('is_active', true)
    expect(mockChain.not).toHaveBeenCalledWith('ticker', 'is', null)
    expect(mockChain.eq).toHaveBeenCalledWith('publication_issues.publication_id', 'pub-1')
    expect(mockChain.neq).toHaveBeenCalledWith('issue_id', 'iss-cur')
  })

  it('returns an empty set on query error', async () => {
    mockChainResult = { data: null, error: { message: 'fail' } }
    const result = await listRecentlyFeaturedTickers('pub-1', '2026-05-20', 7, 'iss-cur')
    expect(result).toEqual(new Set())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/dal/__tests__/articles.test.ts`
Expected: FAIL — `listRecentlyFeaturedTickers` is not exported from `../articles`.

- [ ] **Step 3: Write the implementation**

Append this function to the end of the `// ==================== module_articles ====================` section in `src/lib/dal/articles.ts` (immediately before the `// ==================== manual_articles ====================` comment on line 265):

```typescript
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
    const cutoff = new Date(`${issueDate}T00:00:00Z`)
    cutoff.setUTCDate(cutoff.getUTCDate() - cooldownDays)
    const cutoffDate = cutoff.toISOString().split('T')[0]

    const { data, error } = await supabaseAdmin
      .from('module_articles')
      .select('ticker, publication_issues!inner(publication_id, date)')
      .eq('is_active', true)
      .not('ticker', 'is', null)
      .eq('publication_issues.publication_id', publicationId)
      .gte('publication_issues.date', cutoffDate)
      .lte('publication_issues.date', issueDate)
      .neq('issue_id', excludeIssueId)

    if (error) {
      log.error({ err: error, publicationId }, 'listRecentlyFeaturedTickers failed')
      return new Set()
    }

    const tickers = new Set<string>()
    for (const row of data || []) {
      const t = (row as any).ticker
      if (t) tickers.add(String(t).toUpperCase())
    }
    return tickers
  } catch (err) {
    log.error({ err, publicationId }, 'listRecentlyFeaturedTickers exception')
    return new Set()
  }
}
```

- [ ] **Step 4: Export it from the DAL barrel**

In `src/lib/dal/index.ts`, change the articles export block (lines 52-70):

```typescript
// Articles DAL — module_articles + manual_articles
export {
  MODULE_ARTICLE_COLUMNS,
  MODULE_ARTICLE_BODY_GEN_SELECT,
  MODULE_ARTICLE_FACT_CHECK_SELECT,
  MANUAL_ARTICLE_COLUMNS,
  MANUAL_ARTICLE_WITH_CATEGORY_SELECT,
  listModuleArticlesByIssue,
  moduleArticleExists,
  listArticlesNeedingBody,
  listArticlesNeedingFactCheck,
  insertModuleArticle,
  updateModuleArticleContent,
  updateModuleArticleFactCheck,
  listManualArticlesByPublication,
  findNextAvailableSlug,
  insertManualArticle,
  updateManualArticle,
  deleteManualArticle,
} from './articles'
```

to add `listRecentlyFeaturedTickers`:

```typescript
// Articles DAL — module_articles + manual_articles
export {
  MODULE_ARTICLE_COLUMNS,
  MODULE_ARTICLE_BODY_GEN_SELECT,
  MODULE_ARTICLE_FACT_CHECK_SELECT,
  MANUAL_ARTICLE_COLUMNS,
  MANUAL_ARTICLE_WITH_CATEGORY_SELECT,
  listModuleArticlesByIssue,
  moduleArticleExists,
  listArticlesNeedingBody,
  listArticlesNeedingFactCheck,
  insertModuleArticle,
  updateModuleArticleContent,
  updateModuleArticleFactCheck,
  listRecentlyFeaturedTickers,
  listManualArticlesByPublication,
  findNextAvailableSlug,
  insertManualArticle,
  updateManualArticle,
  deleteManualArticle,
} from './articles'
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/dal/__tests__/articles.test.ts`
Expected: PASS — all tests pass, including the 4 new `listRecentlyFeaturedTickers` tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dal/articles.ts src/lib/dal/index.ts src/lib/dal/__tests__/articles.test.ts
git commit -m "feat(dal): listRecentlyFeaturedTickers for cross-issue ticker cooldown"
```

---

## Task 3: Wire the cooldown into `assignPostsToModule`

**Files:**
- Modify: `src/lib/rss-processor/module-articles.ts` (imports + the candidate-selection block)

This task replaces the intra-issue `seenTickers` loop. There is no unit test for `assignPostsToModule` (it is database-integration glue); the logic it now relies on is fully covered by Task 1 and Task 2. Verification here is type-check + the full unit suite.

- [ ] **Step 1: Add the imports**

In `src/lib/rss-processor/module-articles.ts`, the current import block (lines 1-19) is:

```typescript
import { supabaseAdmin } from '../supabase'
import { AI_CALL, callOpenAI } from '../openai'
import { normalizeTransactionType } from '../transaction-type'
import { detectAIRefusal, getNewsletterIdFromIssue } from './shared-context'
import {
  listPostsForScoring,
  assignPostsToIssue,
  listAssignedPostsForModule,
  POST_WITH_RATINGS_BRIEF,
  moduleArticleExists,
  insertModuleArticle,
  listArticlesNeedingBody,
  listArticlesNeedingFactCheck,
  updateModuleArticleContent,
  updateModuleArticleFactCheck,
  listDuplicateGroupIdsByIssue,
  listDuplicatePostIdsByGroups,
} from '@/lib/dal'
import type { ArticleGenerator } from './article-generator'
```

Replace it with (adds `selectPostsWithTickerCooldown` import and `listRecentlyFeaturedTickers` to the DAL import):

```typescript
import { supabaseAdmin } from '../supabase'
import { AI_CALL, callOpenAI } from '../openai'
import { normalizeTransactionType } from '../transaction-type'
import { detectAIRefusal, getNewsletterIdFromIssue } from './shared-context'
import { selectPostsWithTickerCooldown } from './ticker-cooldown'
import {
  listPostsForScoring,
  assignPostsToIssue,
  listAssignedPostsForModule,
  POST_WITH_RATINGS_BRIEF,
  moduleArticleExists,
  insertModuleArticle,
  listArticlesNeedingBody,
  listArticlesNeedingFactCheck,
  updateModuleArticleContent,
  updateModuleArticleFactCheck,
  listDuplicateGroupIdsByIssue,
  listDuplicatePostIdsByGroups,
  listRecentlyFeaturedTickers,
} from '@/lib/dal'
import type { ArticleGenerator } from './article-generator'
```

- [ ] **Step 2: Replace the candidate-selection block**

In `src/lib/rss-processor/module-articles.ts`, inside `assignPostsToModule`, find this block (currently lines ~139-165):

```typescript
    // Sort by total score descending
    const sortedPosts = eligiblePosts
      .sort((a: any, b: any) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })

    // Select top posts: 1 per ticker (company), then fill remaining slots
    const selectedPosts: any[] = []
    const seenTickers = new Set<string>()

    for (const post of sortedPosts) {
      if (selectedPosts.length >= postsToAssign) break

      const ticker = (post as any).ticker?.toUpperCase()
      if (ticker && seenTickers.has(ticker)) {
        continue // Skip: already have a post for this company
      }

      selectedPosts.push(post)
      if (ticker) seenTickers.add(ticker)
    }

    if (seenTickers.size > 0) {
      console.log(`[Module] Ticker dedup: ${sortedPosts.length} candidates → ${selectedPosts.length} selected (${seenTickers.size} unique companies)`)
    }
```

Replace it with:

```typescript
    // Sort by total score descending
    const sortedPosts = eligiblePosts
      .sort((a: any, b: any) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })

    // Cross-issue ticker cooldown — per-module config; absent/0 = disabled.
    const cooldownDaysRaw = (mod.config as Record<string, any>)?.ticker_cooldown_days
    const cooldownDays = typeof cooldownDaysRaw === 'number' ? cooldownDaysRaw : 0
    let cooldownTickers = new Set<string>()
    if (cooldownDays >= 1) {
      const { data: issueRow } = await supabaseAdmin
        .from('publication_issues')
        .select('publication_id, date')
        .eq('id', issueId)
        .single()
      if (issueRow?.publication_id && issueRow?.date) {
        cooldownTickers = await listRecentlyFeaturedTickers(
          issueRow.publication_id,
          issueRow.date,
          cooldownDays,
          issueId
        )
      }
    }

    // Select top posts: 1 per ticker, skipping tickers on cooldown. Backfill
    // ensures the module is never short purely because of the cooldown.
    const { selected: selectedPosts, skippedByCooldown, backfilled } =
      selectPostsWithTickerCooldown(sortedPosts, cooldownTickers, articlesNeeded, postsToAssign)

    if (cooldownDays >= 1) {
      console.log(`[Module] Ticker cooldown (${cooldownDays}d): ${sortedPosts.length} candidates → ${selectedPosts.length} selected, ${skippedByCooldown} skipped (cooldown), ${backfilled} backfilled`)
    }
```

Note: `articlesNeeded` and `postsToAssign` are already declared earlier in this function (lines ~74-78); `selectedPosts` is still an `any[]` and the existing `if (selectedPosts.length > 0)` assignment block below is unchanged.

- [ ] **Step 3: Run the type-checker**

Run: `npm run type-check`
Expected: PASS — no type errors.

- [ ] **Step 4: Run the full unit test suite**

Run: `npm run test:run`
Expected: PASS — all tests pass (the suite includes Task 1 and Task 2 tests; no existing test exercises `module-articles.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rss-processor/module-articles.ts
git commit -m "feat(rss): apply per-module ticker cooldown in assignPostsToModule"
```

---

## Task 4: Settings UI control

**Files:**
- Modify: `src/components/article-modules/ArticleModuleGeneralTab.tsx` (insert into the "Article Selection Settings" section)

The article-module settings components have no test harness; this control mirrors the existing untested "Extra Candidates" toggle in the same file. Verification is type-check + build + a manual check.

- [ ] **Step 1: Insert the toggle + days input**

In `src/components/article-modules/ArticleModuleGeneralTab.tsx`, find the end of the "Extra Candidates" block and the section's closing tags (currently lines ~125-130):

```tsx
            )
          })()}
        </div>
      </div>

      <RssOutputSection module={module} onUpdate={onUpdate} disabled={isDisabled} saving={saving} setSaving={setSaving} variant="draft" />
```

Replace it with (inserts the new IIFE before the section's closing `</div>`):

```tsx
            )
          })()}
          {(() => {
            const cooldownDays = (module.config as Record<string, any>)?.ticker_cooldown_days
            const isEnabled = typeof cooldownDays === 'number' && cooldownDays >= 1
            const handleCooldownChange = (value: number | null) => withSaving(async () => {
              const currentConfig = (module.config as Record<string, any>) || {}
              if (value === null) {
                const { ticker_cooldown_days: _, ...rest } = currentConfig
                await onUpdate({ config: rest } as any)
              } else {
                await onUpdate({ config: { ...currentConfig, ticker_cooldown_days: value } } as any)
              }
            })
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Ticker Cooldown</label>
                    <p className="text-xs text-gray-500">{isEnabled ? `Skips any company (ticker) featured in the last ${cooldownDays} days` : 'Off — a company can be selected on consecutive issues. For trades newsletters.'}</p>
                  </div>
                  <button type="button" onClick={() => handleCooldownChange(isEnabled ? null : 7)} disabled={isDisabled} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isEnabled ? 'bg-emerald-500' : 'bg-gray-300'} ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                {isEnabled && (
                  <div className="flex items-center gap-2 pl-1">
                    <span className="text-xs text-gray-500">Cooldown days:</span>
                    <input type="number" min={1} max={30} value={cooldownDays} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val >= 1 && val <= 30) handleCooldownChange(val) }} disabled={isDisabled} className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      <RssOutputSection module={module} onUpdate={onUpdate} disabled={isDisabled} saving={saving} setSaving={setSaving} variant="draft" />
```

- [ ] **Step 2: Type-check and build**

Run: `npm run type-check`
Expected: PASS — no type errors.

Run: `npm run build`
Expected: PASS — build completes successfully.

- [ ] **Step 3: Manual verification**

Start the dev server (`npm run dev`), then in the dashboard go to **Settings → Sections**, open an article module, and select the **General** tab. Under **Article Selection Settings**, confirm:
1. A "Ticker Cooldown" row appears below "Extra Candidates" with an off (grey) toggle and the help text "Off — a company can be selected on consecutive issues."
2. Clicking the toggle turns it green, reveals a "Cooldown days" number input pre-filled with `7`, and the help text changes to "Skips any company (ticker) featured in the last 7 days".
3. Changing the number to e.g. `5` persists (reload the page — the value and toggle state survive).
4. Toggling off hides the input; reloading shows it still off.

- [ ] **Step 4: Commit**

```bash
git add src/components/article-modules/ArticleModuleGeneralTab.tsx
git commit -m "feat(ui): ticker cooldown toggle in article module settings"
```

---

## Task 5: Full verification

- [ ] **Step 1: Run the full verification suite**

Run each and confirm it passes:
```bash
npm run build
npm run type-check
npm run lint
npm run test:run
npm run check:bug-patterns
```
Expected: `build`, `type-check`, `test:run`, `check:bug-patterns` pass; `lint` passes within the `--max-warnings 360` ceiling.

- [ ] **Step 2: Fix any failures**

If any command fails, fix the cause and re-run that command before proceeding. Do not proceed with failing checks.

- [ ] **Step 3: Pre-push review gate**

Before pushing, run the project's required pre-push review (per `CLAUDE.md` §5): `/simplify`, `/requesting-code-review`, `/review:pre-push`. Address findings, then push the `feature/ticker-cooldown` branch and open a PR into `staging`.

---

## Task 6: Enable the cooldown for Trader Leak (post-deploy)

This is an operational step, performed **after** the code is deployed to the environment where Trader Leak runs. No code change.

- [ ] **Step 1: Enable via the UI (preferred)**

In the dashboard for the **Trader Leak** publication, go to **Settings → Sections**, open the **Politician Trades** article module (`9f9cd920-c2fe-4b46-92f0-abd453e4d661`), **General** tab → **Article Selection Settings** → turn on **Ticker Cooldown** and set **Cooldown days** to `7`.

- [ ] **Step 2: Fallback — enable via SQL**

If setting it directly in the database instead, run against the relevant Supabase project:

```sql
UPDATE article_modules
SET config = COALESCE(config, '{}'::jsonb) || '{"ticker_cooldown_days": 7}'::jsonb
WHERE id = '9f9cd920-c2fe-4b46-92f0-abd453e4d661';
```

- [ ] **Step 3: Verify on the next issue build**

After the next Trader Leak issue is built, check the workflow logs for a line like:
`[Module] Ticker cooldown (7d): N candidates → M selected, X skipped (cooldown), Y backfilled`
and confirm no ticker from an issue in the previous 7 days reappears as an article.

---

## Self-Review Notes

- **Spec coverage:** setting (§1) → Task 4 + Task 6; DAL `listRecentlyFeaturedTickers` (§2) → Task 2; pure `selectPostsWithTickerCooldown` (§3) → Task 1; wiring (§4) → Task 3; logging (§5) → Task 3 Step 2; UI (§6) → Task 4; tests (§7) → Task 1 + Task 2; rollout → Task 6.
- **Design refinement:** the spec leaves the `listRecentlyFeaturedTickers` query shape open; this plan uses a single PostgREST embedded `publication_issues!inner(...)` query (the `module_articles_issue_id_fkey` foreign key exists), which keeps it to one round-trip and trivially unit-testable.
