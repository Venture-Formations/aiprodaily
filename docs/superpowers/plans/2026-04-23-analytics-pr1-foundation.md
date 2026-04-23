# Analytics Metrics Standardization — PR 1 (Foundation Library + Glossary) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the typed metrics foundation — pure formulas, a bot/IP filter policy, a DAL for analytics reads, and the metrics glossary doc. No consumers yet; this is pure addition.

**Architecture:** Split by concern — pure formulas in `src/lib/analytics/metrics.ts` (no DB imports), DAL reads in `src/lib/dal/analytics.ts`, bot policy in `src/lib/analytics/bot-policy.ts`. Formulas are trivially unit-testable; DAL follows existing `issues.ts` patterns (explicit column lists, `publicationId` filtered, errors logged never thrown).

**Tech Stack:** TypeScript, Vitest, Supabase JS client (via `supabaseAdmin`), pino logger (via `createLogger`).

**Parent spec:** `docs/superpowers/specs/2026-04-23-analytics-metrics-design.md`

---

## File Structure

**Create:**
- `src/lib/analytics/types.ts` — Type definitions (`DeliveryCounts`, `IssueEngagement`, `ModuleEngagement`, `LinkClickRow`, `ExcludedIpRow`).
- `src/lib/analytics/metrics.ts` — Pure formula functions.
- `src/lib/analytics/bot-policy.ts` — `ExcludedIpSet` class + `isClickCountable` + `loadExcludedIps`.
- `src/lib/analytics/index.ts` — Barrel export.
- `src/lib/analytics/__tests__/metrics.test.ts` — Formula unit tests.
- `src/lib/analytics/__tests__/bot-policy.test.ts` — Policy tests (mocked Supabase).
- `src/lib/dal/analytics.ts` — DAL functions.
- `src/lib/dal/__tests__/analytics.test.ts` — DAL tests (mocked Supabase following `issues.test.ts` pattern).
- `docs/operations/metrics.md` — Metrics glossary governance doc.

**Modify:**
- `src/lib/dal/index.ts` — Add analytics barrel export.

---

## Schema Reference (observed from migrations)

**`link_clicks`** columns used by this PR:
`id, publication_id, issue_id, issue_date, subscriber_email, subscriber_id, link_url, link_section, clicked_at, user_agent, ip_address, is_bot_ua, bot_ua_reason`

**`excluded_ips`** columns used:
`id, publication_id, ip_address, is_range, cidr_prefix, exclusion_source`

**`email_metrics`** columns used:
`id, issue_id, sent_count, delivered_count, opened_count, clicked_count, bounced_count, unsubscribed_count, open_rate, click_rate, bounce_rate, unsubscribe_rate, imported_at` — no `publication_id`; ownership verified via join on `publication_issues`.

**`publication_issues`** is the issues table (per `src/lib/dal/issues.ts`).

---

## Task 1: Scaffolding — types file

**Files:**
- Create: `src/lib/analytics/types.ts`

- [ ] **Step 1: Create `src/lib/analytics/types.ts`**

```typescript
/**
 * Type definitions for the analytics metrics library.
 * Shared between pure formulas (metrics.ts), bot policy (bot-policy.ts),
 * and the DAL (src/lib/dal/analytics.ts).
 */

/**
 * Email delivery counts sourced from email_metrics.
 * Denominator for issue-level rates.
 */
export interface DeliveryCounts {
  issueId: string
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  bouncedCount: number
  unsubscribedCount: number
  /** ESP-reported open rate; displayed separately from computed open rate. */
  espOpenRate: number | null
  /** ESP-reported click rate; displayed separately from computed click rate. */
  espClickRate: number | null
  /** Timestamp of last sync from ESP. null for legacy rows. */
  lastSyncedAt: string | null
}

/**
 * Aggregated click/engagement metrics for a single issue.
 * Always derived from link_clicks; bot/IP filter applied per excludeBots flag.
 */
export interface IssueEngagement {
  issueId: string
  publicationId: string
  totalClicks: number
  uniqueClickers: number
  delivery: DeliveryCounts
}

/**
 * Aggregated click metrics for a single module within an issue.
 * moduleRecipients defaults to delivery.deliveredCount for non-segmented modules.
 */
export interface ModuleEngagement {
  moduleId: string
  issueId: string
  publicationId: string
  totalClicks: number
  uniqueClickers: number
  moduleRecipients: number
}

/** Columns on link_clicks used by bot policy and DAL reads. */
export interface LinkClickRow {
  id: string
  publication_id: string
  issue_id: string | null
  subscriber_email: string
  link_url: string
  link_section: string
  ip_address: string | null
  is_bot_ua: boolean | null
}

/** Columns on excluded_ips used by bot policy. */
export interface ExcludedIpRow {
  ip_address: string
  is_range: boolean
  cidr_prefix: number | null
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/analytics/types.ts
git commit -m "feat(analytics): add shared type definitions"
```

---

## Task 2: Pure formulas — `metrics.ts`

**Files:**
- Create: `src/lib/analytics/metrics.ts`
- Create: `src/lib/analytics/__tests__/metrics.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/analytics/__tests__/metrics.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  computeIssueCTR,
  computeModuleCTR,
  computeIssueOpenRate,
  computePollResponseRate,
  computeFeedbackResponseRate,
  computeBounceRate,
  computeUnsubscribeRate,
} from '../metrics'

describe('computeIssueCTR', () => {
  it('returns unique clickers divided by delivered count', () => {
    expect(computeIssueCTR({ uniqueClickers: 50, deliveredCount: 1000 })).toBe(0.05)
  })

  it('returns 0 when deliveredCount is 0', () => {
    expect(computeIssueCTR({ uniqueClickers: 50, deliveredCount: 0 })).toBe(0)
  })

  it('returns 0 when uniqueClickers is 0', () => {
    expect(computeIssueCTR({ uniqueClickers: 0, deliveredCount: 1000 })).toBe(0)
  })

  it('throws if inputs are negative', () => {
    expect(() => computeIssueCTR({ uniqueClickers: -1, deliveredCount: 100 })).toThrow()
    expect(() => computeIssueCTR({ uniqueClickers: 1, deliveredCount: -1 })).toThrow()
  })

  it('clamps to 1.0 if unique clickers exceed delivered (data anomaly)', () => {
    expect(computeIssueCTR({ uniqueClickers: 1500, deliveredCount: 1000 })).toBe(1)
  })
})

describe('computeModuleCTR', () => {
  it('returns unique clickers divided by module recipients', () => {
    expect(computeModuleCTR({ uniqueClickers: 30, moduleRecipients: 600 })).toBe(0.05)
  })

  it('returns 0 when moduleRecipients is 0', () => {
    expect(computeModuleCTR({ uniqueClickers: 30, moduleRecipients: 0 })).toBe(0)
  })

  it('throws on negative inputs', () => {
    expect(() => computeModuleCTR({ uniqueClickers: -1, moduleRecipients: 100 })).toThrow()
  })
})

describe('computeIssueOpenRate', () => {
  it('returns unique openers divided by delivered count', () => {
    expect(computeIssueOpenRate({ uniqueOpeners: 500, deliveredCount: 1000 })).toBe(0.5)
  })

  it('returns 0 when deliveredCount is 0', () => {
    expect(computeIssueOpenRate({ uniqueOpeners: 500, deliveredCount: 0 })).toBe(0)
  })

  it('clamps to 1.0 on data anomaly', () => {
    expect(computeIssueOpenRate({ uniqueOpeners: 1500, deliveredCount: 1000 })).toBe(1)
  })
})

describe('computePollResponseRate', () => {
  it('returns unique respondents divided by delivered count', () => {
    expect(computePollResponseRate({ uniqueRespondents: 100, deliveredCount: 1000 })).toBe(0.1)
  })

  it('returns 0 when deliveredCount is 0', () => {
    expect(computePollResponseRate({ uniqueRespondents: 100, deliveredCount: 0 })).toBe(0)
  })
})

describe('computeFeedbackResponseRate', () => {
  it('returns unique respondents divided by delivered count', () => {
    expect(computeFeedbackResponseRate({ uniqueRespondents: 200, deliveredCount: 1000 })).toBe(0.2)
  })

  it('returns 0 when deliveredCount is 0', () => {
    expect(computeFeedbackResponseRate({ uniqueRespondents: 200, deliveredCount: 0 })).toBe(0)
  })
})

describe('computeBounceRate', () => {
  it('returns bounced count divided by sent count', () => {
    expect(computeBounceRate({ bouncedCount: 20, sentCount: 1000 })).toBe(0.02)
  })

  it('returns 0 when sentCount is 0', () => {
    expect(computeBounceRate({ bouncedCount: 20, sentCount: 0 })).toBe(0)
  })
})

describe('computeUnsubscribeRate', () => {
  it('returns unsubscribed count divided by delivered count', () => {
    expect(computeUnsubscribeRate({ unsubscribedCount: 5, deliveredCount: 1000 })).toBe(0.005)
  })

  it('returns 0 when deliveredCount is 0', () => {
    expect(computeUnsubscribeRate({ unsubscribedCount: 5, deliveredCount: 0 })).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npx vitest run src/lib/analytics/__tests__/metrics.test.ts`
Expected: all tests fail with "Cannot find module '../metrics'".

- [ ] **Step 3: Implement `metrics.ts`**

Create `src/lib/analytics/metrics.ts`:

```typescript
/**
 * Pure metric formulas for the analytics layer.
 *
 * All functions are synchronous and dependency-free. Any DB access
 * belongs in src/lib/dal/analytics.ts, which feeds typed rows into
 * these formulas.
 *
 * Rules:
 * - Division-by-zero returns 0 (so empty-issue dashboards render cleanly).
 * - Negative inputs throw (signals a DAL bug; fail loud in dev/test).
 * - Rates clamp to [0, 1] on data anomalies (e.g., vendor double-counting).
 */

function clampRate(numerator: number, denominator: number): number {
  if (numerator < 0 || denominator < 0) {
    throw new RangeError(`Metric inputs must be non-negative: ${numerator}/${denominator}`)
  }
  if (denominator === 0) return 0
  const rate = numerator / denominator
  return rate > 1 ? 1 : rate
}

export function computeIssueCTR(args: {
  uniqueClickers: number
  deliveredCount: number
}): number {
  return clampRate(args.uniqueClickers, args.deliveredCount)
}

export function computeModuleCTR(args: {
  uniqueClickers: number
  moduleRecipients: number
}): number {
  return clampRate(args.uniqueClickers, args.moduleRecipients)
}

export function computeIssueOpenRate(args: {
  uniqueOpeners: number
  deliveredCount: number
}): number {
  return clampRate(args.uniqueOpeners, args.deliveredCount)
}

export function computePollResponseRate(args: {
  uniqueRespondents: number
  deliveredCount: number
}): number {
  return clampRate(args.uniqueRespondents, args.deliveredCount)
}

export function computeFeedbackResponseRate(args: {
  uniqueRespondents: number
  deliveredCount: number
}): number {
  return clampRate(args.uniqueRespondents, args.deliveredCount)
}

export function computeBounceRate(args: {
  bouncedCount: number
  sentCount: number
}): number {
  return clampRate(args.bouncedCount, args.sentCount)
}

export function computeUnsubscribeRate(args: {
  unsubscribedCount: number
  deliveredCount: number
}): number {
  return clampRate(args.unsubscribedCount, args.deliveredCount)
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run src/lib/analytics/__tests__/metrics.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/metrics.ts src/lib/analytics/__tests__/metrics.test.ts
git commit -m "feat(analytics): add pure metric formulas with unit tests"
```

---

## Task 3: Bot policy — `ExcludedIpSet` + `isClickCountable`

**Files:**
- Create: `src/lib/analytics/bot-policy.ts`
- Create: `src/lib/analytics/__tests__/bot-policy.test.ts`

- [ ] **Step 1: Write the failing test for `ExcludedIpSet` and `isClickCountable`**

Create `src/lib/analytics/__tests__/bot-policy.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that use them
// ---------------------------------------------------------------------------
const mockChain: Record<string, any> = {
  select: vi.fn(function (this: any) { return mockChain }),
  eq: vi.fn(function () { return mockChain }),
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockChain),
  },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    correlationId: 'test-id',
  })),
}))

import { ExcludedIpSet, isClickCountable, loadExcludedIps } from '../bot-policy'
import type { LinkClickRow } from '../types'

beforeEach(() => {
  vi.clearAllMocks()
  mockChain.select.mockReturnValue(mockChain)
  mockChain.eq.mockReturnValue(mockChain)
})

describe('ExcludedIpSet', () => {
  it('matches exact IPs', () => {
    const set = new ExcludedIpSet([
      { ip_address: '1.2.3.4', is_range: false, cidr_prefix: null },
    ])
    expect(set.has('1.2.3.4')).toBe(true)
    expect(set.has('1.2.3.5')).toBe(false)
  })

  it('matches IPv4 CIDR ranges', () => {
    const set = new ExcludedIpSet([
      { ip_address: '10.0.0.0', is_range: true, cidr_prefix: 8 },
    ])
    expect(set.matchesCidr('10.1.2.3')).toBe(true)
    expect(set.matchesCidr('11.1.2.3')).toBe(false)
  })

  it('handles null IP lookup gracefully', () => {
    const set = new ExcludedIpSet([
      { ip_address: '1.2.3.4', is_range: false, cidr_prefix: null },
    ])
    expect(set.has(null)).toBe(false)
    expect(set.matchesCidr(null)).toBe(false)
  })

  it('is case-insensitive to IP casing (IPv6 safety)', () => {
    const set = new ExcludedIpSet([
      { ip_address: '2001:DB8::1', is_range: false, cidr_prefix: null },
    ])
    expect(set.has('2001:db8::1')).toBe(true)
  })
})

describe('isClickCountable', () => {
  const emptySet = new ExcludedIpSet([])

  function row(overrides: Partial<LinkClickRow>): LinkClickRow {
    return {
      id: 'id-1',
      publication_id: 'pub-1',
      issue_id: 'issue-1',
      subscriber_email: 'a@b.com',
      link_url: 'https://example.com',
      link_section: 'Articles',
      ip_address: '1.1.1.1',
      is_bot_ua: false,
      ...overrides,
    }
  }

  it('returns true for a normal human click', () => {
    expect(isClickCountable(row({}), emptySet)).toBe(true)
  })

  it('returns false when is_bot_ua is true', () => {
    expect(isClickCountable(row({ is_bot_ua: true }), emptySet)).toBe(false)
  })

  it('returns false when IP is in excluded set (exact match)', () => {
    const set = new ExcludedIpSet([
      { ip_address: '1.1.1.1', is_range: false, cidr_prefix: null },
    ])
    expect(isClickCountable(row({}), set)).toBe(false)
  })

  it('returns false when IP matches an excluded CIDR range', () => {
    const set = new ExcludedIpSet([
      { ip_address: '1.1.0.0', is_range: true, cidr_prefix: 16 },
    ])
    expect(isClickCountable(row({ ip_address: '1.1.5.200' }), set)).toBe(false)
  })

  it('treats null is_bot_ua as not-a-bot (historical rows)', () => {
    expect(isClickCountable(row({ is_bot_ua: null }), emptySet)).toBe(true)
  })
})

describe('loadExcludedIps', () => {
  it('queries excluded_ips for the given publication and returns a populated set', async () => {
    mockChain.eq.mockImplementationOnce(() => mockChain)
    mockChain.eq.mockResolvedValueOnce({
      data: [
        { ip_address: '1.2.3.4', is_range: false, cidr_prefix: null },
        { ip_address: '10.0.0.0', is_range: true, cidr_prefix: 8 },
      ],
      error: null,
    })

    const set = await loadExcludedIps('pub-1')

    expect(set.has('1.2.3.4')).toBe(true)
    expect(set.matchesCidr('10.5.5.5')).toBe(true)
  })

  it('returns empty set on DB error', async () => {
    mockChain.eq.mockResolvedValueOnce({ data: null, error: { message: 'oops' } })

    const set = await loadExcludedIps('pub-1')

    expect(set.has('1.2.3.4')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npx vitest run src/lib/analytics/__tests__/bot-policy.test.ts`
Expected: fail with "Cannot find module '../bot-policy'".

- [ ] **Step 3: Implement `bot-policy.ts`**

Create `src/lib/analytics/bot-policy.ts`:

```typescript
/**
 * Bot and IP filter policy for click analytics.
 *
 * Single source of truth for "should this click count?".
 * Called by every DAL read that returns link_clicks aggregates.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import type { LinkClickRow, ExcludedIpRow } from './types'

const log = createLogger({ module: 'analytics:bot-policy' })

/**
 * In-memory index of a publication's excluded IPs.
 * Supports exact-match lookup (has) and CIDR-range match (matchesCidr).
 * Case-insensitive; handles null lookups.
 */
export class ExcludedIpSet {
  private readonly exactIps: Set<string>
  private readonly ranges: Array<{ cidr: string; prefix: number }>

  constructor(rows: ExcludedIpRow[]) {
    this.exactIps = new Set()
    this.ranges = []
    for (const row of rows) {
      if (row.is_range && row.cidr_prefix !== null) {
        this.ranges.push({ cidr: row.ip_address, prefix: row.cidr_prefix })
      } else {
        this.exactIps.add(row.ip_address.toLowerCase())
      }
    }
  }

  has(ip: string | null): boolean {
    if (!ip) return false
    return this.exactIps.has(ip.toLowerCase())
  }

  matchesCidr(ip: string | null): boolean {
    if (!ip) return false
    for (const range of this.ranges) {
      if (ipInCidr(ip, range.cidr, range.prefix)) return true
    }
    return false
  }
}

/** Pure function — does a click count toward metrics? */
export function isClickCountable(
  row: Pick<LinkClickRow, 'is_bot_ua' | 'ip_address'>,
  excludedIps: ExcludedIpSet
): boolean {
  if (row.is_bot_ua === true) return false
  if (excludedIps.has(row.ip_address)) return false
  if (excludedIps.matchesCidr(row.ip_address)) return false
  return true
}

/** Load excluded IPs for a publication. Returns empty set on error. */
export async function loadExcludedIps(publicationId: string): Promise<ExcludedIpSet> {
  const { data, error } = await supabaseAdmin
    .from('excluded_ips')
    .select('ip_address, is_range, cidr_prefix')
    .eq('publication_id', publicationId)

  if (error || !data) {
    log.error('Failed to load excluded_ips', { error, publicationId })
    return new ExcludedIpSet([])
  }
  return new ExcludedIpSet(data as ExcludedIpRow[])
}

// ---------------------------------------------------------------------------
// CIDR helpers (IPv4 only; IPv6 CIDR not currently used by excluded_ips)
// ---------------------------------------------------------------------------

function ipInCidr(ip: string, cidr: string, prefix: number): boolean {
  if (ip.includes(':') || cidr.includes(':')) {
    return false // IPv6 not supported for CIDR match
  }
  const ipInt = ipv4ToInt(ip)
  const cidrInt = ipv4ToInt(cidr)
  if (ipInt === null || cidrInt === null) return false
  if (prefix < 0 || prefix > 32) return false
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  return (ipInt & mask) === (cidrInt & mask)
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let out = 0
  for (const part of parts) {
    const n = Number(part)
    if (!Number.isInteger(n) || n < 0 || n > 255) return null
    out = (out << 8) | n
  }
  return out >>> 0
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run src/lib/analytics/__tests__/bot-policy.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/bot-policy.ts src/lib/analytics/__tests__/bot-policy.test.ts
git commit -m "feat(analytics): add bot and IP filter policy"
```

---

## Task 4: DAL — `getDeliveryCounts`

**Files:**
- Create: `src/lib/dal/analytics.ts`
- Create: `src/lib/dal/__tests__/analytics.test.ts`

- [ ] **Step 1: Write the failing DAL test file header + getDeliveryCounts tests**

Create `src/lib/dal/__tests__/analytics.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — declared before imports that use them
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockChain: Record<string, any> = {
  select: vi.fn(function () { return mockChain }),
  eq: vi.fn(function () { return mockChain }),
  is: vi.fn(function () { return mockChain }),
  in: vi.fn(function () { return mockChain }),
  not: vi.fn(function () { return mockChain }),
  single: mockSingle,
  maybeSingle: vi.fn(),
  order: vi.fn(function () { return mockChain }),
  limit: vi.fn(function () { return mockChain }),
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockChain),
    rpc: vi.fn(() => mockChain),
  },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    correlationId: 'test-id',
  })),
}))

vi.mock('@/lib/analytics/bot-policy', () => ({
  loadExcludedIps: vi.fn(async () => ({
    has: () => false,
    matchesCidr: () => false,
  })),
  isClickCountable: vi.fn(() => true),
  ExcludedIpSet: class {
    has() { return false }
    matchesCidr() { return false }
  },
}))

import { supabaseAdmin } from '@/lib/supabase'
import { getDeliveryCounts } from '../analytics'

const PUB_ID = 'pub-test-123'
const ISSUE_ID = 'issue-test-456'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getDeliveryCounts', () => {
  it('returns delivery counts when the row exists and ownership matches', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        issue_id: ISSUE_ID,
        sent_count: 1000,
        delivered_count: 980,
        opened_count: 500,
        clicked_count: 50,
        bounced_count: 20,
        unsubscribed_count: 5,
        open_rate: 0.51,
        click_rate: 0.051,
        imported_at: '2026-04-23T10:00:00Z',
        publication_issues: { publication_id: PUB_ID },
      },
      error: null,
    })

    const result = await getDeliveryCounts({ issueId: ISSUE_ID, publicationId: PUB_ID })

    expect(result).not.toBeNull()
    expect(result!.deliveredCount).toBe(980)
    expect(result!.sentCount).toBe(1000)
    expect(result!.espClickRate).toBe(0.051)
    expect(result!.lastSyncedAt).toBe('2026-04-23T10:00:00Z')
  })

  it('returns null when ownership does not match (no row)', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await getDeliveryCounts({ issueId: ISSUE_ID, publicationId: 'other-pub' })

    expect(result).toBeNull()
  })

  it('returns null on DB error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const result = await getDeliveryCounts({ issueId: ISSUE_ID, publicationId: PUB_ID })

    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npx vitest run src/lib/dal/__tests__/analytics.test.ts`
Expected: fail with "Cannot find module '../analytics'".

- [ ] **Step 3: Implement `src/lib/dal/analytics.ts` skeleton + getDeliveryCounts**

Create `src/lib/dal/analytics.ts`:

```typescript
/**
 * Data Access Layer — Analytics Domain
 *
 * All reads that feed the analytics library go through here.
 * Every method requires publicationId for multi-tenant isolation.
 * Explicit column lists — no select('*').
 * Errors are logged, never thrown — callers receive null/empty on failure.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { loadExcludedIps, isClickCountable } from '@/lib/analytics/bot-policy'
import type {
  DeliveryCounts,
  IssueEngagement,
  ModuleEngagement,
  LinkClickRow,
} from '@/lib/analytics/types'

const log = createLogger({ module: 'dal:analytics' })

// Explicit column lists
const EMAIL_METRICS_COLUMNS = `
  issue_id,
  sent_count, delivered_count, opened_count, clicked_count,
  bounced_count, unsubscribed_count,
  open_rate, click_rate,
  imported_at
` as const

const LINK_CLICK_COLUMNS = `
  id, publication_id, issue_id, subscriber_email,
  link_url, link_section, ip_address, is_bot_ua
` as const

// ==================== READ OPERATIONS ====================

/**
 * Fetch delivery counts for an issue, verifying publication ownership
 * via a join on publication_issues.
 */
export async function getDeliveryCounts(args: {
  issueId: string
  publicationId: string
}): Promise<DeliveryCounts | null> {
  const { issueId, publicationId } = args

  try {
    const { data, error } = await supabaseAdmin
      .from('email_metrics')
      .select(`${EMAIL_METRICS_COLUMNS}, publication_issues!inner(publication_id)`)
      .eq('issue_id', issueId)
      .eq('publication_issues.publication_id', publicationId)
      .single()

    if (error || !data) {
      if (error) log.error('getDeliveryCounts failed', { error, issueId, publicationId })
      return null
    }

    return {
      issueId: data.issue_id,
      sentCount: data.sent_count ?? 0,
      deliveredCount: data.delivered_count ?? 0,
      openedCount: data.opened_count ?? 0,
      clickedCount: data.clicked_count ?? 0,
      bouncedCount: data.bounced_count ?? 0,
      unsubscribedCount: data.unsubscribed_count ?? 0,
      espOpenRate: data.open_rate,
      espClickRate: data.click_rate,
      lastSyncedAt: data.imported_at ?? null,
    }
  } catch (err) {
    log.error('getDeliveryCounts threw', { err, issueId, publicationId })
    return null
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run src/lib/dal/__tests__/analytics.test.ts -t getDeliveryCounts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dal/analytics.ts src/lib/dal/__tests__/analytics.test.ts
git commit -m "feat(dal): add analytics DAL skeleton with getDeliveryCounts"
```

---

## Task 5: DAL — `getUniqueClickers`

**Files:**
- Modify: `src/lib/dal/analytics.ts`
- Modify: `src/lib/dal/__tests__/analytics.test.ts`

- [ ] **Step 1: Add failing tests for getUniqueClickers**

Append to `src/lib/dal/__tests__/analytics.test.ts` (inside the top-level imports, add `getUniqueClickers` to the import):

```typescript
// Update the existing import near top of file:
import { getDeliveryCounts, getUniqueClickers } from '../analytics'
```

Then append these describe blocks at the end of the file:

```typescript
describe('getUniqueClickers', () => {
  it('counts unique subscriber_email across countable clicks', async () => {
    // Mock chain returns rows after the final filter call
    const rows = [
      { id: '1', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'a@x.com', link_url: 'u', link_section: 's', ip_address: '1.1.1.1', is_bot_ua: false },
      { id: '2', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'b@x.com', link_url: 'u', link_section: 's', ip_address: '1.1.1.2', is_bot_ua: false },
      { id: '3', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'a@x.com', link_url: 'u', link_section: 's', ip_address: '1.1.1.1', is_bot_ua: false },
    ]
    // Mock the terminal call: the fluent chain ends with a thenable.
    ;(mockChain.eq as any).mockImplementation(function () { return mockChain })
    ;(mockChain.is as any).mockImplementation(function () { return mockChain })
    // Make the final .is() resolve to data when awaited
    const finalResolved = Promise.resolve({ data: rows, error: null })
    ;(mockChain.is as any).mockReturnValueOnce(finalResolved)

    const count = await getUniqueClickers({
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      excludeBots: true,
    })

    expect(count).toBe(2)
  })

  it('returns 0 on DB error', async () => {
    ;(mockChain.is as any).mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'oops' } })
    )

    const count = await getUniqueClickers({
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      excludeBots: true,
    })

    expect(count).toBe(0)
  })

  it('returns 0 when no rows', async () => {
    ;(mockChain.is as any).mockReturnValueOnce(
      Promise.resolve({ data: [], error: null })
    )

    const count = await getUniqueClickers({
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      excludeBots: true,
    })

    expect(count).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npx vitest run src/lib/dal/__tests__/analytics.test.ts -t getUniqueClickers`
Expected: fail because `getUniqueClickers` is not exported.

- [ ] **Step 3: Implement getUniqueClickers**

Append to `src/lib/dal/analytics.ts`:

```typescript
/**
 * Count unique clickers for an issue (optionally filtered to a single link).
 * Applies bot and IP filtering in SQL where possible; CIDR matches applied in-app.
 *
 * "Unique clicker" = distinct subscriber_email for rows passing isClickCountable.
 */
export async function getUniqueClickers(args: {
  issueId: string
  publicationId: string
  linkUrl?: string
  excludeBots?: boolean
}): Promise<number> {
  const { issueId, publicationId, linkUrl, excludeBots = true } = args

  try {
    let query = supabaseAdmin
      .from('link_clicks')
      .select(LINK_CLICK_COLUMNS)
      .eq('publication_id', publicationId)
      .eq('issue_id', issueId)

    if (linkUrl) query = query.eq('link_url', linkUrl)

    // SQL-level: exclude is_bot_ua = true rows when excludeBots is on.
    if (excludeBots) query = query.is('is_bot_ua', false)

    const { data, error } = await query

    if (error || !data) {
      if (error) log.error('getUniqueClickers failed', { error, issueId, publicationId })
      return 0
    }

    if (!excludeBots) {
      return countUniqueEmails(data as LinkClickRow[])
    }

    // Apply in-app IP + CIDR filter, then count uniques.
    const excludedIps = await loadExcludedIps(publicationId)
    const countable = (data as LinkClickRow[]).filter((row) =>
      isClickCountable(row, excludedIps)
    )
    return countUniqueEmails(countable)
  } catch (err) {
    log.error('getUniqueClickers threw', { err, issueId, publicationId })
    return 0
  }
}

function countUniqueEmails(rows: LinkClickRow[]): number {
  const set = new Set<string>()
  for (const row of rows) set.add(row.subscriber_email.toLowerCase())
  return set.size
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run src/lib/dal/__tests__/analytics.test.ts`
Expected: all existing + new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dal/analytics.ts src/lib/dal/__tests__/analytics.test.ts
git commit -m "feat(dal): add getUniqueClickers with bot/IP filtering"
```

---

## Task 6: DAL — `getIssueEngagement` (composes getDeliveryCounts + getUniqueClickers + total count)

**Files:**
- Modify: `src/lib/dal/analytics.ts`
- Modify: `src/lib/dal/__tests__/analytics.test.ts`

- [ ] **Step 1: Add failing test for getIssueEngagement**

Update the import in `src/lib/dal/__tests__/analytics.test.ts`:

```typescript
import { getDeliveryCounts, getUniqueClickers, getIssueEngagement } from '../analytics'
```

Append this describe block at the end of the file:

```typescript
describe('getIssueEngagement', () => {
  it('returns null when delivery counts cannot be loaded', async () => {
    // First call (delivery): returns no row
    mockSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await getIssueEngagement({
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      excludeBots: true,
    })

    expect(result).toBeNull()
  })

  it('returns composed engagement with delivery + totals + uniques', async () => {
    // Delivery counts call
    mockSingle.mockResolvedValueOnce({
      data: {
        issue_id: ISSUE_ID,
        sent_count: 1000,
        delivered_count: 980,
        opened_count: 500,
        clicked_count: 50,
        bounced_count: 20,
        unsubscribed_count: 5,
        open_rate: 0.51,
        click_rate: 0.051,
        imported_at: '2026-04-23T10:00:00Z',
        publication_issues: { publication_id: PUB_ID },
      },
      error: null,
    })

    // Two subsequent fluent-chain resolutions for total + unique queries.
    const rows = [
      { id: '1', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'a@x.com', link_url: 'u', link_section: 's', ip_address: '1.1.1.1', is_bot_ua: false },
      { id: '2', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'a@x.com', link_url: 'u', link_section: 's', ip_address: '1.1.1.1', is_bot_ua: false },
      { id: '3', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'b@x.com', link_url: 'u', link_section: 's', ip_address: '1.1.1.2', is_bot_ua: false },
    ]
    ;(mockChain.is as any)
      .mockReturnValueOnce(Promise.resolve({ data: rows, error: null }))
      .mockReturnValueOnce(Promise.resolve({ data: rows, error: null }))

    const result = await getIssueEngagement({
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      excludeBots: true,
    })

    expect(result).not.toBeNull()
    expect(result!.totalClicks).toBe(3)
    expect(result!.uniqueClickers).toBe(2)
    expect(result!.delivery.deliveredCount).toBe(980)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npx vitest run src/lib/dal/__tests__/analytics.test.ts -t getIssueEngagement`
Expected: fail — not exported.

- [ ] **Step 3: Implement getIssueEngagement + getTotalClicks helper**

Append to `src/lib/dal/analytics.ts`:

```typescript
/**
 * Total raw click count for an issue (pre-dedup). Bot/IP filter applied
 * when excludeBots is true; no uniqueness reduction.
 */
async function getTotalClicks(args: {
  issueId: string
  publicationId: string
  excludeBots: boolean
}): Promise<number> {
  const { issueId, publicationId, excludeBots } = args

  try {
    let query = supabaseAdmin
      .from('link_clicks')
      .select(LINK_CLICK_COLUMNS)
      .eq('publication_id', publicationId)
      .eq('issue_id', issueId)

    if (excludeBots) query = query.is('is_bot_ua', false)

    const { data, error } = await query
    if (error || !data) {
      if (error) log.error('getTotalClicks failed', { error, issueId, publicationId })
      return 0
    }

    if (!excludeBots) return data.length

    const excludedIps = await loadExcludedIps(publicationId)
    return (data as LinkClickRow[]).filter((row) =>
      isClickCountable(row, excludedIps)
    ).length
  } catch (err) {
    log.error('getTotalClicks threw', { err, issueId, publicationId })
    return 0
  }
}

/**
 * Aggregate engagement for an issue: delivery counts + total clicks + unique clickers.
 * Returns null if delivery counts cannot be loaded (issue/publication mismatch or DB error).
 */
export async function getIssueEngagement(args: {
  issueId: string
  publicationId: string
  excludeBots?: boolean
}): Promise<IssueEngagement | null> {
  const { issueId, publicationId, excludeBots = true } = args

  const delivery = await getDeliveryCounts({ issueId, publicationId })
  if (!delivery) return null

  const [totalClicks, uniqueClickers] = await Promise.all([
    getTotalClicks({ issueId, publicationId, excludeBots }),
    getUniqueClickers({ issueId, publicationId, excludeBots }),
  ])

  return {
    issueId,
    publicationId,
    totalClicks,
    uniqueClickers,
    delivery,
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run src/lib/dal/__tests__/analytics.test.ts`
Expected: all existing + new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dal/analytics.ts src/lib/dal/__tests__/analytics.test.ts
git commit -m "feat(dal): add getIssueEngagement composing delivery + clicks"
```

---

## Task 7: DAL — `getModuleEngagement`

**Files:**
- Modify: `src/lib/dal/analytics.ts`
- Modify: `src/lib/dal/__tests__/analytics.test.ts`

- [ ] **Step 1: Add failing tests for getModuleEngagement**

Update import in `src/lib/dal/__tests__/analytics.test.ts`:

```typescript
import {
  getDeliveryCounts,
  getUniqueClickers,
  getIssueEngagement,
  getModuleEngagement,
} from '../analytics'
```

Append:

```typescript
describe('getModuleEngagement', () => {
  it('returns module engagement with defaults to deliveredCount when moduleRecipients not provided', async () => {
    // Delivery counts call (inside getIssueEngagement path)
    mockSingle.mockResolvedValueOnce({
      data: {
        issue_id: ISSUE_ID,
        sent_count: 1000,
        delivered_count: 980,
        opened_count: 500,
        clicked_count: 50,
        bounced_count: 20,
        unsubscribed_count: 5,
        open_rate: 0.51,
        click_rate: 0.051,
        imported_at: '2026-04-23T10:00:00Z',
        publication_issues: { publication_id: PUB_ID },
      },
      error: null,
    })

    const rows = [
      { id: '1', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'a@x.com', link_url: 'u', link_section: 'Ads', ip_address: '1.1.1.1', is_bot_ua: false },
      { id: '2', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'b@x.com', link_url: 'u', link_section: 'Ads', ip_address: '1.1.1.2', is_bot_ua: false },
    ]
    ;(mockChain.is as any)
      .mockReturnValueOnce(Promise.resolve({ data: rows, error: null }))
      .mockReturnValueOnce(Promise.resolve({ data: rows, error: null }))

    const result = await getModuleEngagement({
      moduleId: 'module-1',
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      linkSection: 'Ads',
      excludeBots: true,
    })

    expect(result).not.toBeNull()
    expect(result!.uniqueClickers).toBe(2)
    expect(result!.totalClicks).toBe(2)
    expect(result!.moduleRecipients).toBe(980) // default = deliveredCount
  })

  it('uses explicit moduleRecipients when provided (segmented module)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        issue_id: ISSUE_ID,
        sent_count: 1000,
        delivered_count: 980,
        opened_count: 500,
        clicked_count: 10,
        bounced_count: 20,
        unsubscribed_count: 5,
        open_rate: 0.51,
        click_rate: 0.01,
        imported_at: '2026-04-23T10:00:00Z',
        publication_issues: { publication_id: PUB_ID },
      },
      error: null,
    })

    ;(mockChain.is as any)
      .mockReturnValueOnce(Promise.resolve({ data: [], error: null }))
      .mockReturnValueOnce(Promise.resolve({ data: [], error: null }))

    const result = await getModuleEngagement({
      moduleId: 'module-1',
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      linkSection: 'Ads',
      moduleRecipients: 500, // segmented: only 500 of 980 saw this module
      excludeBots: true,
    })

    expect(result).not.toBeNull()
    expect(result!.moduleRecipients).toBe(500)
  })

  it('returns null when delivery cannot be loaded', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await getModuleEngagement({
      moduleId: 'module-1',
      issueId: ISSUE_ID,
      publicationId: 'wrong-pub',
      linkSection: 'Ads',
    })

    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npx vitest run src/lib/dal/__tests__/analytics.test.ts -t getModuleEngagement`
Expected: fail — not exported.

- [ ] **Step 3: Implement getModuleEngagement**

Append to `src/lib/dal/analytics.ts`:

```typescript
/**
 * Aggregate engagement for a module within an issue.
 *
 * Module scope is defined by linkSection (e.g., 'Ads', 'AI Apps', 'Articles').
 * Numbers are narrowed to clicks with that link_section.
 *
 * moduleRecipients defaults to delivery.deliveredCount for non-segmented modules.
 * For segmented modules (an ad shown to a subset), callers pass the explicit
 * recipient count from the per-issue module-assignment table.
 */
export async function getModuleEngagement(args: {
  moduleId: string
  issueId: string
  publicationId: string
  linkSection: string
  moduleRecipients?: number
  excludeBots?: boolean
}): Promise<ModuleEngagement | null> {
  const {
    moduleId,
    issueId,
    publicationId,
    linkSection,
    moduleRecipients,
    excludeBots = true,
  } = args

  const delivery = await getDeliveryCounts({ issueId, publicationId })
  if (!delivery) return null

  const [totalClicks, uniqueClickers] = await Promise.all([
    getModuleTotalClicks({ issueId, publicationId, linkSection, excludeBots }),
    getModuleUniqueClickers({ issueId, publicationId, linkSection, excludeBots }),
  ])

  return {
    moduleId,
    issueId,
    publicationId,
    totalClicks,
    uniqueClickers,
    moduleRecipients: moduleRecipients ?? delivery.deliveredCount,
  }
}

async function getModuleTotalClicks(args: {
  issueId: string
  publicationId: string
  linkSection: string
  excludeBots: boolean
}): Promise<number> {
  return runLinkClicksAggregate({ ...args, countUnique: false })
}

async function getModuleUniqueClickers(args: {
  issueId: string
  publicationId: string
  linkSection: string
  excludeBots: boolean
}): Promise<number> {
  return runLinkClicksAggregate({ ...args, countUnique: true })
}

async function runLinkClicksAggregate(args: {
  issueId: string
  publicationId: string
  linkSection: string
  excludeBots: boolean
  countUnique: boolean
}): Promise<number> {
  const { issueId, publicationId, linkSection, excludeBots, countUnique } = args

  try {
    let query = supabaseAdmin
      .from('link_clicks')
      .select(LINK_CLICK_COLUMNS)
      .eq('publication_id', publicationId)
      .eq('issue_id', issueId)
      .eq('link_section', linkSection)

    if (excludeBots) query = query.is('is_bot_ua', false)

    const { data, error } = await query
    if (error || !data) {
      if (error) log.error('module aggregate failed', { error, issueId, linkSection })
      return 0
    }

    const rows = data as LinkClickRow[]

    if (excludeBots) {
      const excludedIps = await loadExcludedIps(publicationId)
      const countable = rows.filter((row) => isClickCountable(row, excludedIps))
      return countUnique ? countUniqueEmails(countable) : countable.length
    }

    return countUnique ? countUniqueEmails(rows) : rows.length
  } catch (err) {
    log.error('module aggregate threw', { err, issueId, linkSection })
    return 0
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run src/lib/dal/__tests__/analytics.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dal/analytics.ts src/lib/dal/__tests__/analytics.test.ts
git commit -m "feat(dal): add getModuleEngagement with section-scoped aggregation"
```

---

## Task 8: Barrel exports

**Files:**
- Create: `src/lib/analytics/index.ts`
- Modify: `src/lib/dal/index.ts`

- [ ] **Step 1: Create `src/lib/analytics/index.ts`**

```typescript
/**
 * Analytics library — barrel export.
 * Consumers import from '@/lib/analytics'.
 */

export {
  computeIssueCTR,
  computeModuleCTR,
  computeIssueOpenRate,
  computePollResponseRate,
  computeFeedbackResponseRate,
  computeBounceRate,
  computeUnsubscribeRate,
} from './metrics'

export {
  ExcludedIpSet,
  isClickCountable,
  loadExcludedIps,
} from './bot-policy'

export type {
  DeliveryCounts,
  IssueEngagement,
  ModuleEngagement,
  LinkClickRow,
  ExcludedIpRow,
} from './types'
```

- [ ] **Step 2: Read current `src/lib/dal/index.ts`**

Run: `cat src/lib/dal/index.ts`
Note the existing exports so we don't break them.

- [ ] **Step 3: Append analytics export to `src/lib/dal/index.ts`**

Add to the bottom of the existing file:

```typescript
// Analytics DAL
export {
  getDeliveryCounts,
  getUniqueClickers,
  getIssueEngagement,
  getModuleEngagement,
} from './analytics'
```

- [ ] **Step 4: Verify build + type-check**

Run: `npm run type-check`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/index.ts src/lib/dal/index.ts
git commit -m "feat(analytics): add barrel exports for analytics and DAL"
```

---

## Task 9: Glossary doc

**Files:**
- Create: `docs/operations/metrics.md`

- [ ] **Step 1: Create the glossary doc**

Create `docs/operations/metrics.md`:

```markdown
# Metrics Glossary

_Last updated: 2026-04-23_

Canonical definitions for every KPI surfaced on analytics pages. Any PR that adds a dashboard metric must update this glossary. Compute functions live in `src/lib/analytics/metrics.ts`; data reads in `src/lib/dal/analytics.ts`.

---

## Issue CTR

- **Formula:** `unique_clickers / delivered_count`
- **Numerator source:** `link_clicks` (own event table), filtered by `isClickCountable` (`src/lib/analytics/bot-policy.ts`)
- **Denominator source:** `email_metrics.delivered_count` (ESP-reported)
- **Uniqueness rule:** one row per `(subscriber_email, link_url, issue_id)` — no time window; issue is the natural boundary
- **Compute with:** `computeIssueCTR()` + `dal.getIssueEngagement()`
- **Known quirks:** `email_metrics.click_rate` is an ESP-reported value and may differ — vendor bot filtering is opaque. Displayed separately as "ESP-reported Click Rate" for deliverability debugging.
- **Owner:** @jake

## Module CTR

- **Formula:** `unique_clickers_in_module / module_recipients`
- **Numerator source:** `link_clicks` rows with `link_section` matching the module, bot/IP filtered
- **Denominator source:** defaults to `email_metrics.delivered_count`; segmented modules pass an explicit recipient count from the per-issue module-assignment table
- **Uniqueness rule:** one row per `(subscriber_email, link_url, issue_id, link_section)`
- **Compute with:** `computeModuleCTR()` + `dal.getModuleEngagement()`
- **Known quirks:** distinct from Issue CTR — never compare directly. UI labels must say "Module CTR" when showing this.
- **Owner:** @jake

## Issue Open Rate

- **Formula:** `unique_openers / delivered_count`
- **Numerator source:** `email_metrics.opened_count` (ESP-reported — we do not run our own open pixel)
- **Denominator source:** `email_metrics.delivered_count`
- **Uniqueness rule:** vendor-defined
- **Compute with:** `computeIssueOpenRate()`
- **Known quirks:** ESP bot filtering is opaque. Apple Mail Privacy Protection inflates opens (~30–60% of Apple users).
- **Owner:** @jake

## Poll Response Rate

- **Formula:** `unique_respondents / delivered_count`
- **Numerator source:** `poll_responses` (the typed DAL read that feeds this formula lands in PR 3 when `/api/polls/analytics` is rewritten)
- **Denominator source:** `email_metrics.delivered_count`
- **Uniqueness rule:** one row per `(subscriber_email, poll_id)`
- **Compute with:** `computePollResponseRate()`
- **Owner:** @jake

## Feedback Response Rate

- **Formula:** `unique_respondents / delivered_count`
- **Numerator source:** `feedback_responses`
- **Denominator source:** `email_metrics.delivered_count`
- **Uniqueness rule:** one row per `(subscriber_email, issue_id)`
- **Compute with:** `computeFeedbackResponseRate()`
- **Owner:** @jake

## Ad CTR / AI App CTR / Tools Directory CTR

All three are Module CTR specializations — `link_section` varies (`Ads`, `AI Apps`, `Tools`). Same formula, same dedup rule. Documented here as aliases; dashboards label them appropriately.

## Delivered Count

- **Source:** `email_metrics.delivered_count`
- **Definition:** sent minus vendor-reported bounces
- **Used as denominator for:** Issue CTR, Module CTR (default), Open Rate, Response Rates, Unsubscribe Rate

## Bounce Rate

- **Formula:** `bounced_count / sent_count`
- **Source:** `email_metrics.bounced_count` / `email_metrics.sent_count`
- **Compute with:** `computeBounceRate()`
- **Owner:** @jake

## Unsubscribe Rate

- **Formula:** `unsubscribed_count / delivered_count`
- **Source:** `email_metrics`
- **Compute with:** `computeUnsubscribeRate()`
- **Owner:** @jake

---

## Bot & IP Filter Policy

A click counts toward metrics (`isClickCountable` returns `true`) unless any of:
- `link_clicks.is_bot_ua = true` (UA matched a bot pattern at ingest)
- `link_clicks.ip_address` is in `excluded_ips` (exact match)
- `link_clicks.ip_address` matches any CIDR range in `excluded_ips`

Historical rows with `is_bot_ua = NULL` are treated as not-a-bot (no backfill applied — see prior incident notes).

ESP-reported counts (`opened_count`, `clicked_count`) inherit vendor filtering and **cannot** be re-filtered. `email_metrics.click_rate` therefore diverges from computed Issue CTR; this is expected.

## Data Lineage

| Metric | Upstream table(s) | Sync job |
|--------|-------------------|----------|
| Issue CTR | `link_clicks` | real-time insert by tracking endpoint |
| Module CTR | `link_clicks` | real-time insert by tracking endpoint |
| Open Rate / ESP Click Rate / Bounce / Unsubscribe | `email_metrics` | `/api/cron/import-email-metrics` (MailerLite) |
| Poll Response Rate | `poll_responses` | real-time insert |
| Feedback Response Rate | `feedback_responses` | real-time insert |

## Freshness

`email_metrics.imported_at` carries the last sync timestamp (renamed to `last_synced_at` in PR 2). Stale threshold: 12 hours (configurable via `app_settings.email_metrics_stale_threshold_hours`). Dashboards display "as of X" via `<FreshnessBadge>`.

## Adding a New Metric

1. Add the compute function to `src/lib/analytics/metrics.ts` with unit tests.
2. Add a DAL read to `src/lib/dal/analytics.ts` with tests.
3. Add a section to this glossary with formula, source, uniqueness rule, and owner.
4. Link the glossary entry from the dashboard PR description.
```

- [ ] **Step 2: Commit**

```bash
git add docs/operations/metrics.md
git commit -m "docs(analytics): add metrics glossary"
```

---

## Task 10: Full verification

- [ ] **Step 1: Run full type-check**

Run: `npm run type-check`
Expected: zero errors.

- [ ] **Step 2: Run full lint**

Run: `npm run lint`
Expected: within the 360-warning ceiling per CLAUDE.md §13.

- [ ] **Step 3: Run full test suite**

Run: `npm run test:run`
Expected: all tests pass, including new analytics/dal tests.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Run bug-pattern check**

Run: `npm run check:bug-patterns`
Expected: no new issues.

- [ ] **Step 6: Pre-push review gate**

Run: `/simplify` on changed files. Review output, apply any trivial simplifications, re-run tests.
Run: `/review:pre-push`. Address any findings.

- [ ] **Step 7: Open PR**

Branch: `feature/analytics-foundation`
PR title: `feat(analytics): foundation library + metrics glossary`
PR body: link to `docs/superpowers/specs/2026-04-23-analytics-metrics-design.md` PR 1 section. Call out that this adds no consumers — it's pure addition setting up subsequent PRs.
