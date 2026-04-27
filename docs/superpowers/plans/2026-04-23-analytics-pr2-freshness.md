# Analytics Metrics Standardization — PR 2 (Freshness) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `email_metrics.last_synced_at` so the dashboard can show "as of X ago" on analytics panels — making stale data visible instead of silently misleading users.

**Architecture:** Migration adds a nullable `TIMESTAMPTZ` column populated on every metrics-import write (MailerLite + SendGrid paths). DAL maps it through the existing `DeliveryCounts.lastSyncedAt` field that PR 1 already defined. A new `<FreshnessBadge>` client component renders relative time with a stale warning color past a configurable threshold; mounted on the Issues analytics tab as the canary.

**Tech Stack:** PostgreSQL (Supabase), TypeScript, Next.js 15 client components, Vitest, Tailwind CSS.

**Parent spec:** `docs/superpowers/specs/2026-04-23-analytics-metrics-design.md` § 3.5 (Freshness)

---

## File Structure

**Create:**
- `db/migrations/20260427_email_metrics_last_synced_at.sql` — Column add + index + backfill.
- `src/components/analytics/FreshnessBadge.tsx` — Client component rendering "as of X ago" + stale warning.
- `src/components/analytics/__tests__/FreshnessBadge.test.tsx` — Component tests with fake timers.
- `src/components/analytics/format-age.ts` — Pure helper for relative-time formatting.
- `src/components/analytics/__tests__/format-age.test.ts` — Helper unit tests.

**Modify:**
- `src/lib/mailerlite/mailerlite-service.ts` — Add `last_synced_at` to the metrics-import update payload (around line 438).
- `src/lib/sendgrid.ts` — Add `last_synced_at` to the metrics-import update payload (around line 444).
- `src/lib/dal/analytics.ts` — Map `last_synced_at` instead of `imported_at` for `lastSyncedAt`; update `EMAIL_METRICS_COLUMNS`.
- `src/lib/dal/__tests__/analytics.test.ts` — Update mock fixture to include `last_synced_at`.
- `src/app/api/campaigns/route.ts` — Add `last_synced_at` to the email_metrics select list.
- `src/app/dashboard/[slug]/analytics/components/issues-tab/types.ts` — Add `last_synced_at: string | null` to email_metrics shape.
- `src/app/dashboard/[slug]/analytics/components/issues-tab/IssuesAnalyticsTab.tsx` — Mount `<FreshnessBadge>` near the SummaryStats area.

---

## Schema Reference

**Current `email_metrics` columns (relevant subset):**
`id, issue_id, sent_count, delivered_count, opened_count, clicked_count, bounced_count, unsubscribed_count, open_rate, click_rate, bounce_rate, unsubscribe_rate, mailerlite_issue_id, sendgrid_singlesend_id, imported_at`

**`imported_at`** defaults to `NOW()` on INSERT but **is not touched on UPDATE** — so it represents the row's first creation, not the last sync. That's why we need a separate `last_synced_at` that gets stamped on every metrics import.

---

## Task 1: Database migration

**Files:**
- Create: `db/migrations/20260427_email_metrics_last_synced_at.sql`

- [ ] **Step 1: Create the migration file**

Create `db/migrations/20260427_email_metrics_last_synced_at.sql` with EXACTLY this content:

```sql
-- Migration: Add last_synced_at to email_metrics
-- Date: 2026-04-27
-- Purpose: Track when metrics were last refreshed from the ESP.
--   `imported_at` defaults on INSERT but is never touched on UPDATE,
--   so it cannot serve as a freshness indicator. `last_synced_at` is
--   set explicitly by every metrics-import write (MailerLite + SendGrid).
--
-- Backfill: existing rows inherit imported_at as a reasonable starting
-- value so the UI doesn't render every historical row as "never synced".

ALTER TABLE email_metrics
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Index supports queries like "find issues with stale metrics".
CREATE INDEX IF NOT EXISTS idx_email_metrics_last_synced
  ON email_metrics(last_synced_at);

-- Backfill historical rows with the original import timestamp.
-- This is approximate but better than NULL for UI display.
UPDATE email_metrics
  SET last_synced_at = imported_at
  WHERE last_synced_at IS NULL
    AND imported_at IS NOT NULL;
```

- [ ] **Step 2: Apply to staging**

Run: `npm run migrate:staging`
Expected: migration applies cleanly. Output should show `ALTER TABLE`, `CREATE INDEX`, and `UPDATE N` (where N is the count of historical rows backfilled).

If `npm run migrate:staging` is unavailable, run the SQL manually via the Supabase SQL editor against the staging project (`cbnecpswmjonbdatxzwv`).

- [ ] **Step 3: Verify schema**

Confirm in Supabase staging:
- Column `last_synced_at` exists on `email_metrics` with type `timestamp with time zone`, nullable.
- Index `idx_email_metrics_last_synced` exists.
- A spot-check row has `last_synced_at = imported_at` after backfill.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/20260427_email_metrics_last_synced_at.sql
git commit -m "feat(db): add email_metrics.last_synced_at column"
```

Do NOT apply to prod yet — production migration happens at PR-merge time per the standard workflow.

---

## Task 2: Stamp `last_synced_at` on metrics imports (MailerLite + SendGrid)

**Files:**
- Modify: `src/lib/mailerlite/mailerlite-service.ts:427-438` (the `metricsUpdate` object inside `importissueMetrics`)
- Modify: `src/lib/sendgrid.ts:433-444` (the `metricsUpdate` object inside `importCampaignMetrics`)

- [ ] **Step 1: Update MailerLite metrics import**

Open `src/lib/mailerlite/mailerlite-service.ts`. Locate the `metricsUpdate` object built from MailerLite stats (search for `extractCountValue(stats.bounced` to find it — it's around line 432). The object currently ends with `unsubscribe_rate: extractRateValue(...)`. Add a new property as the LAST field:

```typescript
        const metricsUpdate = {
          sent_count: stats.sent || 0,
          delivered_count: stats.delivered || stats.delivered_count || 0,
          opened_count: extractCountValue(stats.opened, stats.opens_count, stats.opened),
          clicked_count: extractCountValue(stats.clicked, stats.clicks_count, stats.clicked),
          bounced_count: extractCountValue(stats.bounced, stats.bounces_count, (stats.hard_bounces_count || 0) + (stats.soft_bounces_count || 0)),
          unsubscribed_count: extractCountValue(stats.unsubscribed, stats.unsubscribes_count),
          open_rate: extractRateValue(stats.opened?.rate || stats.open_rate),
          click_rate: extractRateValue(stats.clicked?.rate || stats.click_rate),
          bounce_rate: extractRateValue(stats.bounced?.rate || stats.bounce_rate || stats.hard_bounce_rate),
          unsubscribe_rate: extractRateValue(stats.unsubscribed?.rate || stats.unsubscribe_rate),
          last_synced_at: new Date().toISOString(),
        }
```

Only the last line is new. All other lines stay unchanged.

- [ ] **Step 2: Update SendGrid metrics import**

Open `src/lib/sendgrid.ts`. Locate the `metricsUpdate` object inside `importCampaignMetrics` (around line 433). It currently ends with `unsubscribe_rate: unsubscribeRate`. Replace the entire object literal with:

```typescript
      const metricsUpdate = {
        sent_count: stats.requests || 0,
        delivered_count: delivered,
        opened_count: stats.unique_opens || 0,
        clicked_count: stats.unique_clicks || 0,
        bounced_count: stats.bounces || 0,
        unsubscribed_count: stats.unsubscribes || 0,
        open_rate: openRate,
        click_rate: clickRate,
        bounce_rate: bounceRate,
        unsubscribe_rate: unsubscribeRate,
        last_synced_at: new Date().toISOString(),
      }
```

The new line is the trailing `last_synced_at`.

Note on the `MetricsResult` type: `metricsUpdate` is currently typed `MetricsResult`. Adding `last_synced_at` may cause a type error if `MetricsResult` is a strict object type. Check the type at the top of the file (look for `type MetricsResult` or `interface MetricsResult` import). If it doesn't allow `last_synced_at`, change the `metricsUpdate` declaration to drop the explicit `: MetricsResult` annotation and rely on inferred type:

Find:
```typescript
const metricsUpdate: MetricsResult = {
```
Replace with:
```typescript
const metricsUpdate = {
```

The function still returns `metricsUpdate` and the `Promise<MetricsResult>` return type will accept it as a wider object, since extra properties don't violate structural typing on return.

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: clean.

If type errors surface around the `MetricsResult` interface, adjust the interface to add `last_synced_at?: string` as optional — this keeps callers happy. The interface lives in `src/lib/sendgrid.ts` (search `interface MetricsResult` or `type MetricsResult`). Add `last_synced_at?: string` to it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mailerlite/mailerlite-service.ts src/lib/sendgrid.ts
git commit -m "feat(metrics): stamp last_synced_at on every metrics import"
```

Note: SendGrid is not actively used in production (per project memory), but updating it preserves correctness for any future activation. No tests added for these sites because they're integration-style code paths covered by manual smoke tests; introducing mocks here is out of scope for PR 2.

---

## Task 3: DAL — read `last_synced_at` instead of `imported_at`

**Files:**
- Modify: `src/lib/dal/analytics.ts` (`EMAIL_METRICS_COLUMNS` constant + `getDeliveryCounts` mapping)
- Modify: `src/lib/dal/__tests__/analytics.test.ts` (mock fixture for `getDeliveryCounts` test)

- [ ] **Step 1: Update the test fixture first**

Open `src/lib/dal/__tests__/analytics.test.ts`. Locate the success-case test for `getDeliveryCounts` (look for `it('returns delivery counts when the row exists`). The mock data currently includes `imported_at: '2026-04-23T10:00:00Z'`. Replace the line:

```typescript
        imported_at: '2026-04-23T10:00:00Z',
```

with:

```typescript
        last_synced_at: '2026-04-23T10:00:00Z',
        imported_at: '2026-04-23T09:00:00Z',
```

(Both fields present — the test confirms we read `last_synced_at`, not `imported_at`. Different timestamps make a regression observable.)

Then update the assertion in the same test:

```typescript
    expect(result!.lastSyncedAt).toBe('2026-04-23T10:00:00Z')
```

This assertion already exists; just confirm the value matches the new `last_synced_at` value (10:00, not 09:00).

There are TWO other places where `imported_at` may appear in the test file (the `getModuleEngagement` and `getIssueEngagement` mock fixtures). For each one, find the line `imported_at: '2026-04-23T10:00:00Z',` and add `last_synced_at: '2026-04-23T10:00:00Z',` ABOVE it. Both fields stay; the new one is read by the DAL.

- [ ] **Step 2: Run tests and verify they fail**

Run: `npx vitest run src/lib/dal/__tests__/analytics.test.ts -t getDeliveryCounts`
Expected: the success case fails because the DAL still reads `imported_at` and gets `'2026-04-23T09:00:00Z'`, not the expected `'2026-04-23T10:00:00Z'`.

- [ ] **Step 3: Update `EMAIL_METRICS_COLUMNS`**

Open `src/lib/dal/analytics.ts`. Find the constant:

```typescript
const EMAIL_METRICS_COLUMNS = `
  issue_id,
  sent_count, delivered_count, opened_count, clicked_count,
  bounced_count, unsubscribed_count,
  open_rate, click_rate,
  imported_at
` as const
```

Replace with:

```typescript
const EMAIL_METRICS_COLUMNS = `
  issue_id,
  sent_count, delivered_count, opened_count, clicked_count,
  bounced_count, unsubscribed_count,
  open_rate, click_rate,
  last_synced_at
` as const
```

- [ ] **Step 4: Update `getDeliveryCounts` mapping**

In the same file, find the return mapping inside `getDeliveryCounts`:

```typescript
      lastSyncedAt: data.imported_at ?? null,
```

Replace with:

```typescript
      lastSyncedAt: data.last_synced_at ?? null,
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `npx vitest run src/lib/dal/__tests__/analytics.test.ts`
Expected: all DAL tests pass (11 total).

- [ ] **Step 6: Commit**

```bash
git add src/lib/dal/analytics.ts src/lib/dal/__tests__/analytics.test.ts
git commit -m "feat(dal): read email_metrics.last_synced_at instead of imported_at"
```

---

## Task 4: API — surface `last_synced_at` to dashboard fetcher

**Files:**
- Modify: `src/app/api/campaigns/route.ts` (the `email_metrics(...)` select clause around line 109)
- Modify: `src/app/dashboard/[slug]/analytics/components/issues-tab/types.ts` (add field to email_metrics type)

- [ ] **Step 1: Add `last_synced_at` to the API select list**

Open `src/app/api/campaigns/route.ts`. Find the line:

```typescript
        email_metrics(id, sent_count, opened_count, clicked_count, unsubscribed_count, open_rate, click_rate)
```

Replace with:

```typescript
        email_metrics(id, sent_count, opened_count, clicked_count, unsubscribed_count, open_rate, click_rate, last_synced_at)
```

Only the new column at the end is added; existing columns preserved.

- [ ] **Step 2: Add the field to the dashboard type**

Open `src/app/dashboard/[slug]/analytics/components/issues-tab/types.ts`. Find the `email_metrics` type / interface (search for `email_metrics` — it'll be a property on `IssueWithMetrics` with a nested object type or `email_metrics:` followed by `{`). Add `last_synced_at: string | null` to the nested shape.

If the file doesn't have an explicit field list (e.g., it's typed as `any` or via a generated type), add an explicit interface near the top of the file:

```typescript
export interface IssueEmailMetrics {
  id: string
  sent_count: number | null
  opened_count: number | null
  clicked_count: number | null
  unsubscribed_count: number | null
  open_rate: number | null
  click_rate: number | null
  last_synced_at: string | null
}
```

Then update `IssueWithMetrics.email_metrics` to use this type. If the interface already exists with a different name, just add `last_synced_at: string | null` to it.

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/campaigns/route.ts src/app/dashboard/[slug]/analytics/components/issues-tab/types.ts
git commit -m "feat(api): include last_synced_at in campaigns response"
```

---

## Task 5: Pure helper — `formatAge`

**Files:**
- Create: `src/components/analytics/format-age.ts`
- Create: `src/components/analytics/__tests__/format-age.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/__tests__/format-age.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatAge } from '../format-age'

describe('formatAge', () => {
  it('returns "just now" for ages under 60 seconds', () => {
    expect(formatAge(0)).toBe('just now')
    expect(formatAge(30 * 1000)).toBe('just now')
    expect(formatAge(59 * 1000)).toBe('just now')
  })

  it('returns minutes for ages 1m to 59m', () => {
    expect(formatAge(60 * 1000)).toBe('1m ago')
    expect(formatAge(15 * 60 * 1000)).toBe('15m ago')
    expect(formatAge(59 * 60 * 1000)).toBe('59m ago')
  })

  it('returns hours for ages 1h to 23h', () => {
    expect(formatAge(60 * 60 * 1000)).toBe('1h ago')
    expect(formatAge(12 * 60 * 60 * 1000)).toBe('12h ago')
    expect(formatAge(23 * 60 * 60 * 1000)).toBe('23h ago')
  })

  it('returns days for ages 24h and beyond', () => {
    expect(formatAge(24 * 60 * 60 * 1000)).toBe('1d ago')
    expect(formatAge(3 * 24 * 60 * 60 * 1000)).toBe('3d ago')
    expect(formatAge(30 * 24 * 60 * 60 * 1000)).toBe('30d ago')
  })

  it('handles negative ages (clock skew) by treating as just now', () => {
    expect(formatAge(-1000)).toBe('just now')
  })
})
```

- [ ] **Step 2: Run test and verify failing**

Run: `npx vitest run src/components/analytics/__tests__/format-age.test.ts`
Expected: fail with "Cannot find module '../format-age'".

- [ ] **Step 3: Implement `format-age.ts`**

Create `src/components/analytics/format-age.ts`:

```typescript
/**
 * Format a millisecond age as a short human-readable string.
 *
 * Tiers: "just now" (<60s) → "Nm ago" → "Nh ago" → "Nd ago".
 * Negative ages (clock skew) treated as zero.
 */
export function formatAge(ageMs: number): string {
  if (ageMs < 60 * 1000) return 'just now'
  const minutes = Math.floor(ageMs / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
```

- [ ] **Step 4: Run test and verify passing**

Run: `npx vitest run src/components/analytics/__tests__/format-age.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/format-age.ts src/components/analytics/__tests__/format-age.test.ts
git commit -m "feat(analytics-ui): add formatAge relative-time helper"
```

---

## Task 6: `<FreshnessBadge>` component

**Files:**
- Create: `src/components/analytics/FreshnessBadge.tsx`
- Create: `src/components/analytics/__tests__/FreshnessBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/__tests__/FreshnessBadge.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FreshnessBadge } from '../FreshnessBadge'

const FIXED_NOW = new Date('2026-04-27T12:00:00Z').getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FreshnessBadge', () => {
  it('renders "never synced" when lastSyncedAt is null', () => {
    render(<FreshnessBadge lastSyncedAt={null} />)
    expect(screen.getByText(/never synced/i)).toBeInTheDocument()
  })

  it('renders relative time when fresh', () => {
    // 30 minutes ago
    const synced = new Date(FIXED_NOW - 30 * 60 * 1000).toISOString()
    render(<FreshnessBadge lastSyncedAt={synced} />)
    expect(screen.getByText(/as of 30m ago/i)).toBeInTheDocument()
  })

  it('renders with stale styling when older than threshold', () => {
    // 24 hours ago, threshold default 12h
    const synced = new Date(FIXED_NOW - 24 * 60 * 60 * 1000).toISOString()
    const { container } = render(<FreshnessBadge lastSyncedAt={synced} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toMatch(/amber/)
  })

  it('respects a custom staleHoursThreshold', () => {
    // 2 hours ago, threshold 1h → should be stale
    const synced = new Date(FIXED_NOW - 2 * 60 * 60 * 1000).toISOString()
    const { container } = render(
      <FreshnessBadge lastSyncedAt={synced} staleHoursThreshold={1} />
    )
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toMatch(/amber/)
  })

  it('uses a custom prefix when provided', () => {
    const synced = new Date(FIXED_NOW - 5 * 60 * 1000).toISOString()
    render(<FreshnessBadge lastSyncedAt={synced} prefix="Click data" />)
    expect(screen.getByText(/click data/i)).toBeInTheDocument()
  })

  it('exposes the full timestamp via title attribute', () => {
    const iso = '2026-04-27T11:30:00Z'
    const { container } = render(<FreshnessBadge lastSyncedAt={iso} />)
    const badge = container.firstChild as HTMLElement
    // Title is locale-formatted; just confirm it exists and is non-empty.
    expect(badge.title).toBeTruthy()
    expect(badge.title.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run src/components/analytics/__tests__/FreshnessBadge.test.tsx`
Expected: fail with "Cannot find module '../FreshnessBadge'" or React-Testing-Library "could not find element".

- [ ] **Step 3: Implement `FreshnessBadge.tsx`**

Create `src/components/analytics/FreshnessBadge.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { formatAge } from './format-age'

interface FreshnessBadgeProps {
  /** ISO timestamp of the most recent sync, or null if never synced. */
  lastSyncedAt: string | null
  /** Hours-old threshold beyond which the badge renders with a warning color. Default 12. */
  staleHoursThreshold?: number
  /** Label prefix shown before the relative time. Default "Email metrics". */
  prefix?: string
}

/**
 * Renders "<prefix>: as of Xm ago" with a tooltip showing the full timestamp.
 * Re-renders every 60 seconds so the relative time stays current without a refetch.
 *
 * Stale styling (amber) kicks in past staleHoursThreshold.
 */
export function FreshnessBadge({
  lastSyncedAt,
  staleHoursThreshold = 12,
  prefix = 'Email metrics',
}: FreshnessBadgeProps) {
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!lastSyncedAt) {
    return (
      <span className="text-xs text-gray-500" title="No sync recorded">
        {prefix}: never synced
      </span>
    )
  }

  const syncedTime = new Date(lastSyncedAt).getTime()
  const ageMs = Math.max(0, now - syncedTime)
  const ageHours = ageMs / (1000 * 60 * 60)
  const isStale = ageHours > staleHoursThreshold

  const colorClass = isStale ? 'text-amber-600' : 'text-gray-500'

  return (
    <span
      className={`text-xs ${colorClass}`}
      title={new Date(lastSyncedAt).toLocaleString()}
    >
      {prefix}: as of {formatAge(ageMs)}
    </span>
  )
}
```

- [ ] **Step 4: Verify the test passes**

Run: `npx vitest run src/components/analytics/__tests__/FreshnessBadge.test.tsx`
Expected: all 6 tests pass.

If `@testing-library/react` is not installed in the project, the import will fail. In that case, the project may use a different testing approach for components — check `package.json` and `vitest.config.ts` to confirm. If `@testing-library/react` is missing, install it: `npm install --save-dev @testing-library/react @testing-library/jest-dom`. Then re-run.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/FreshnessBadge.tsx src/components/analytics/__tests__/FreshnessBadge.test.tsx
git commit -m "feat(analytics-ui): add FreshnessBadge component"
```

---

## Task 7: Mount `<FreshnessBadge>` on the Issues analytics tab

**Files:**
- Modify: `src/app/dashboard/[slug]/analytics/components/issues-tab/IssuesAnalyticsTab.tsx`

- [ ] **Step 1: Compute the most recent sync timestamp from the issues list**

Open `src/app/dashboard/[slug]/analytics/components/issues-tab/IssuesAnalyticsTab.tsx`. The component receives `issues` from the `useIssuesAnalytics` hook. Each issue has `email_metrics.last_synced_at` (or null).

Replace the existing imports block at the top with:

```tsx
'use client'

import { useMemo } from 'react'
import type { Props } from './types'
import { useIssuesAnalytics } from './useIssuesAnalytics'
import { SummaryStats } from './SummaryStats'
import { IssuePerformanceTable } from './IssuePerformanceTable'
import { FeedbackSection } from './FeedbackSection'
import { LinkClicksSection } from './LinkClicksSection'
import { PerformanceInsights } from './PerformanceInsights'
import { FreshnessBadge } from '@/components/analytics/FreshnessBadge'
```

Then, inside the component body (right after `const averages = calculateAverages()`), add:

```tsx
  const mostRecentSync = useMemo<string | null>(() => {
    let max: string | null = null
    for (const issue of issues) {
      const ts = issue?.email_metrics?.last_synced_at ?? null
      if (ts && (!max || ts > max)) max = ts
    }
    return max
  }, [issues])
```

- [ ] **Step 2: Render the badge**

Find the existing block:

```tsx
      <div className="mb-6 flex justify-end">
        <select
          value={selectedTimeframe}
          ...
```

Replace with:

```tsx
      <div className="mb-6 flex items-center justify-between">
        <FreshnessBadge lastSyncedAt={mostRecentSync} />
        <select
          value={selectedTimeframe}
          onChange={(e) => setSelectedTimeframe(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>
```

The `<FreshnessBadge>` is added on the LEFT, the existing timeframe selector stays on the right; layout flips from `justify-end` (single right-aligned element) to `justify-between` (badge left, selector right) and adds `items-center` for vertical alignment.

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: clean.

If TS reports `Property 'last_synced_at' does not exist on type ...` for `issue.email_metrics`, the type update from Task 4 didn't propagate. Re-check `src/app/dashboard/[slug]/analytics/components/issues-tab/types.ts` to confirm `last_synced_at: string | null` is on the email_metrics shape.

- [ ] **Step 4: Run the dev server and smoke-test**

Run (in background): `npm run dev`
Open: `http://localhost:3000/dashboard/<your-slug>/analytics` (replace with a real slug from your local dev DB).
Verify on the **Issues** tab:
- A badge reading something like `Email metrics: as of Xm ago` appears at the top-left of the tab.
- The badge is gray (fresh) for issues whose metrics were synced recently.
- Tooltip on hover shows a full local-time timestamp.
- Switching to other tabs (Articles, Polls, etc.) — no badge there yet (intentional; deferred to follow-on).

If the badge says `never synced` for all issues even though metrics exist, the API didn't propagate `last_synced_at` (revisit Task 4 Step 1) or the migration's backfill didn't run (revisit Task 1 Step 2).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/[slug]/analytics/components/issues-tab/IssuesAnalyticsTab.tsx
git commit -m "feat(analytics-ui): mount FreshnessBadge on Issues tab"
```

---

## Task 8: Full verification

- [ ] **Step 1: Run type-check**

Run: `npm run type-check`
Expected: zero errors.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: within 360-warning ceiling.

- [ ] **Step 3: Run full test suite**

Run: `npm run test:run`
Expected: all tests pass. The new tests are:
- `format-age.test.ts` — 5 tests
- `FreshnessBadge.test.tsx` — 6 tests
- Updated DAL tests (existing 11 still pass).

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: succeeds. (Requires `.env.local` to be present — copy from parent repo if running in a fresh worktree.)

- [ ] **Step 5: Run bug-pattern check**

Run: `npm run check:bug-patterns`
Expected: no new issues.

- [ ] **Step 6: Pre-push review gates**

Per `CLAUDE.md` § 5:
- `/simplify` — review changed code for reuse, quality, efficiency.
- `/review:pre-push` — run pre-push review gate.

- [ ] **Step 7: Manual staging verification (after PR opens and deploys)**

After pushing the branch and the staging deploy completes:
- Visit `https://aiprodaily-staging...` Issues tab.
- Confirm the FreshnessBadge appears with a recent timestamp on issues that have synced metrics.
- Trigger `/api/cron/import-metrics` (or the equivalent admin endpoint) to refresh metrics, reload the page, confirm the badge timestamp updates.

- [ ] **Step 8: Open PR**

Branch: `feature/analytics-freshness` (or push directly to `staging` per the PR-1 workflow if that's the team pattern).
PR title: `feat(analytics): freshness tracking for email metrics (PR 2)`
PR body: link to `docs/superpowers/specs/2026-04-23-analytics-metrics-design.md` § 3.5. Note that the badge is only mounted on the Issues tab in this PR; other analytics tabs (Articles, Polls, AI Apps, Ads) get the same treatment in a follow-on micro-PR after Track 3 cutover.
