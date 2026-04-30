# Beehiiv First-Open Make Webhook Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delay the Make.com webhook until a Beehiiv-provider subscriber's first email open, while preserving today's behavior for all other publications.

**Architecture:** Extend the existing `make_webhook_fires` table with a `pending → fired/expired` lifecycle. Subscribe routes funnel through one new helper (`triggerMakeWebhook`) that decides whether to fire immediately or claim a pending row. An hourly cron polls Beehiiv's per-subscriber stats endpoint for pending rows and fires the webhook once an open is detected.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL), Vitest, Beehiiv REST API v2, MSW or `vi.mock` for HTTP mocking.

**Spec:** `docs/superpowers/specs/2026-04-30-beehiiv-first-open-webhook-gate-design.md`

---

## File Structure

**New:**
- `db/migrations/20260430_make_webhook_first_open_gate.sql` — column additions + backfill + partial index
- `src/app/api/cron/check-pending-webhooks/route.ts` — hourly cron
- `src/app/api/debug/(integrations)/make-webhook-pending/route.ts` — read-only health endpoint
- `src/lib/sparkloop-client/__tests__/make-webhook.test.ts` — unit tests for `triggerMakeWebhook`
- `src/lib/__tests__/beehiiv.test.ts` — unit tests for `getBeehiivSubscriberStats`
- `src/app/api/cron/check-pending-webhooks/__tests__/route.test.ts` — cron iteration test

**Modified:**
- `src/lib/beehiiv.ts` — add `getBeehiivSubscriberStats()`
- `src/lib/sparkloop-client/make-webhook.ts` — extend `claimMakeWebhookFire` with `status` arg; add `triggerMakeWebhook`; add `markMakeWebhookFired`, `markMakeWebhookExpired`, `recordPollAttempt`
- `src/lib/sparkloop-client/index.ts` — export new symbols
- `src/app/api/sparkloop/subscribe/route.ts` — replace inline claim+fire with `triggerMakeWebhook`
- `src/app/api/sparkloop/module-subscribe/route.ts` — same
- `src/app/api/sparkloop/recommend-subscribe/route.ts` — same
- `src/app/api/webhooks/afteroffers/postback/route.ts` — same
- `src/app/api/settings/sparkloop/route.ts` — read/write `make_webhook_require_first_open`
- `src/components/settings/SparkLoopSettings.tsx` — add toggle below Make webhook URL field
- `vercel.json` — register hourly cron + maxDuration

---

## Task 1: Database migration

**Files:**
- Create: `db/migrations/20260430_make_webhook_first_open_gate.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260430_make_webhook_first_open_gate.sql
-- Adds lifecycle columns to make_webhook_fires so Beehiiv-gated subscribers
-- can be claimed as 'pending' at signup time and transitioned to 'fired' (or
-- 'expired') by the check-pending-webhooks cron once a first open is observed.
-- Existing rows default to 'fired' so the old immediate-fire flow is unchanged.

ALTER TABLE make_webhook_fires
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'fired'
    CHECK (status IN ('pending', 'fired', 'expired')),
  ADD COLUMN IF NOT EXISTS fired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS poll_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expired_reason TEXT;

UPDATE make_webhook_fires
   SET fired_at = created_at
 WHERE fired_at IS NULL AND status = 'fired';

CREATE INDEX IF NOT EXISTS idx_make_webhook_fires_pending
  ON make_webhook_fires(publication_id, last_polled_at NULLS FIRST)
  WHERE status = 'pending';
```

- [ ] **Step 2: Apply to staging**

Run: `npm run migrate:staging`
Expected: migration runs without error; in Supabase staging, `\d make_webhook_fires` (or table editor) shows the new columns and the partial index.

- [ ] **Step 3: Verify backfill**

Run (in Supabase staging SQL editor):
```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'fired') AS fired,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE fired_at IS NOT NULL) AS has_fired_at
FROM make_webhook_fires;
```
Expected: `fired = total`, `pending = 0`, `has_fired_at = total`.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/20260430_make_webhook_first_open_gate.sql
git commit -m "feat(db): add lifecycle columns to make_webhook_fires for first-open gate"
```

---

## Task 2: Beehiiv stats helper — types + happy path

**Files:**
- Modify: `src/lib/beehiiv.ts` (append new function)
- Test: `src/lib/__tests__/beehiiv.test.ts` (new file)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/beehiiv.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { getBeehiivSubscriberStats } from '../beehiiv'

vi.mock('axios')
const mockedAxios = vi.mocked(axios)

describe('getBeehiivSubscriberStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed stats for an active subscriber with opens', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        data: {
          id: 'sub_abc123',
          status: 'active',
          stats: {
            emails_received: 10,
            unique_opens: 4,
          },
        },
      },
    })

    const result = await getBeehiivSubscriberStats('user@example.com', 'pub_xyz', 'key123')

    expect(result.found).toBe(true)
    expect(result.status).toBe('active')
    expect(result.uniqueOpens).toBe(4)
    expect(result.emailsReceived).toBe(10)
    expect(result.subscriptionId).toBe('sub_abc123')
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.beehiiv.com/v2/publications/pub_xyz/subscriptions/by_email/user%40example.com?expand=stats',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer key123' }) }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/beehiiv.test.ts`
Expected: FAIL — `getBeehiivSubscriberStats is not a function` or import error.

- [ ] **Step 3: Add the helper to `src/lib/beehiiv.ts`**

Append to `src/lib/beehiiv.ts` (keep existing `updateBeehiivSubscriberField` as-is):

```ts
export interface BeehiivSubscriberStats {
  found: boolean
  status?: string
  uniqueOpens?: number
  emailsReceived?: number
  subscriptionId?: string
  rateLimited?: boolean
  error?: string
}

/**
 * Fetch a Beehiiv subscriber by email with stats expanded. Used by the
 * check-pending-webhooks cron to detect a subscriber's first open before
 * firing the Make.com webhook.
 *
 * Returns { found: false } on 404, { rateLimited: true } on 429, and
 * { error } on other failures. Never throws.
 */
export async function getBeehiivSubscriberStats(
  email: string,
  beehiivPublicationId: string,
  beehiivApiKey: string
): Promise<BeehiivSubscriberStats> {
  const url = `${BEEHIIV_API_BASE}/publications/${beehiivPublicationId}/subscriptions/by_email/${encodeURIComponent(email)}?expand=stats`
  const headers = {
    Authorization: `Bearer ${beehiivApiKey}`,
    'Content-Type': 'application/json',
  }

  try {
    const resp = await axios.get(url, { headers })
    const data = resp.data?.data
    if (!data) {
      return { found: false }
    }
    const stats = data.stats || {}
    const uniqueOpens =
      typeof stats.unique_opens === 'number'
        ? stats.unique_opens
        : typeof stats.opens === 'number'
        ? stats.opens
        : 0
    return {
      found: true,
      status: typeof data.status === 'string' ? data.status : undefined,
      uniqueOpens,
      emailsReceived: typeof stats.emails_received === 'number' ? stats.emails_received : 0,
      subscriptionId: typeof data.id === 'string' ? data.id : undefined,
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { found: false }
    }
    if (error.response?.status === 429) {
      return { found: false, rateLimited: true }
    }
    const msg = error.response?.data?.message || error.message || 'Unknown error'
    return { found: false, error: msg }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/beehiiv.test.ts`
Expected: PASS — 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/beehiiv.ts src/lib/__tests__/beehiiv.test.ts
git commit -m "feat(beehiiv): add getBeehiivSubscriberStats helper"
```

---

## Task 3: Beehiiv stats helper — error/edge cases

**Files:**
- Test: `src/lib/__tests__/beehiiv.test.ts` (extend)

- [ ] **Step 1: Add failing tests for 404, 429, unknown status, and field-name fallbacks**

Append to the existing `describe('getBeehiivSubscriberStats', ...)` block:

```ts
  it('returns found=false on 404', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 404 } })
    const result = await getBeehiivSubscriberStats('missing@example.com', 'pub', 'key')
    expect(result.found).toBe(false)
    expect(result.rateLimited).toBeUndefined()
    expect(result.error).toBeUndefined()
  })

  it('returns rateLimited=true on 429', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 429 } })
    const result = await getBeehiivSubscriberStats('user@example.com', 'pub', 'key')
    expect(result.found).toBe(false)
    expect(result.rateLimited).toBe(true)
  })

  it('returns error on 5xx', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({
      response: { status: 502, data: { message: 'Bad gateway' } },
    })
    const result = await getBeehiivSubscriberStats('user@example.com', 'pub', 'key')
    expect(result.found).toBe(false)
    expect(result.error).toBe('Bad gateway')
  })

  it('falls back to opens when unique_opens is missing', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        data: {
          id: 'sub_1',
          status: 'active',
          stats: { emails_received: 3, opens: 2 },
        },
      },
    })
    const result = await getBeehiivSubscriberStats('user@example.com', 'pub', 'key')
    expect(result.uniqueOpens).toBe(2)
  })

  it('returns 0 opens when stats absent', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({
      status: 200,
      data: { data: { id: 'sub_1', status: 'active' } },
    })
    const result = await getBeehiivSubscriberStats('user@example.com', 'pub', 'key')
    expect(result.uniqueOpens).toBe(0)
    expect(result.emailsReceived).toBe(0)
  })
```

- [ ] **Step 2: Run tests to verify all pass**

Run: `npx vitest run src/lib/__tests__/beehiiv.test.ts`
Expected: PASS — 6 tests passing total.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/beehiiv.test.ts
git commit -m "test(beehiiv): cover 404/429/5xx and field-name fallbacks for stats helper"
```

---

## Task 4: Extend `claimMakeWebhookFire` with `status` parameter

**Files:**
- Modify: `src/lib/sparkloop-client/make-webhook.ts`
- Test: `src/lib/sparkloop-client/__tests__/make-webhook.test.ts` (new file)

- [ ] **Step 1: Write the failing test**

Create `src/lib/sparkloop-client/__tests__/make-webhook.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn()
const selectMock = vi.fn()
const maybeSingleMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: (payload: unknown) => {
        insertMock(payload)
        return {
          select: () => {
            selectMock()
            return { maybeSingle: maybeSingleMock }
          },
        }
      },
    })),
  },
}))

import { claimMakeWebhookFire } from '../make-webhook'

describe('claimMakeWebhookFire', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts row with status="fired" and fired_at when status defaults', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'row-1' }, error: null })

    const ok = await claimMakeWebhookFire({
      publicationId: 'pub-1',
      subscriberEmail: 'User@Example.COM',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
    })

    expect(ok).toBe(true)
    const inserted = insertMock.mock.calls[0][0]
    expect(inserted.status).toBe('fired')
    expect(inserted.fired_at).toBeInstanceOf(Date) // or string ISO
    expect(inserted.subscriber_email).toBe('user@example.com') // lowercased
  })

  it('inserts row with status="pending" and fired_at=null when status="pending"', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'row-2' }, error: null })

    const ok = await claimMakeWebhookFire({
      publicationId: 'pub-1',
      subscriberEmail: 'user@example.com',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
      status: 'pending',
    })

    expect(ok).toBe(true)
    const inserted = insertMock.mock.calls[0][0]
    expect(inserted.status).toBe('pending')
    expect(inserted.fired_at).toBeNull()
  })

  it('returns false on 23505 unique violation', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate' } })
    const ok = await claimMakeWebhookFire({
      publicationId: 'pub-1',
      subscriberEmail: 'user@example.com',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
    })
    expect(ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/sparkloop-client/__tests__/make-webhook.test.ts`
Expected: FAIL — `status` field not present on insert / fired_at undefined.

- [ ] **Step 3: Update `claimMakeWebhookFire` to accept the `status` arg**

In `src/lib/sparkloop-client/make-webhook.ts`, replace the existing `ClaimMakeWebhookFireArgs` interface and `claimMakeWebhookFire` function:

```ts
export interface ClaimMakeWebhookFireArgs {
  publicationId: string
  subscriberEmail: string
  source: 'sparkloop' | 'afteroffers'
  subscriberId: string
  /** Initial lifecycle state. Defaults to 'fired' (legacy immediate-fire flow). */
  status?: 'pending' | 'fired'
}

/**
 * Atomically claim the right to fire the Make webhook for this subscriber.
 *
 * When status === 'fired' (default), this matches the legacy semantics: the
 * caller intends to fire the webhook immediately after a successful claim.
 * When status === 'pending', the row is reserved for the check-pending-webhooks
 * cron to transition once a first open is detected.
 */
export async function claimMakeWebhookFire(
  args: ClaimMakeWebhookFireArgs
): Promise<boolean> {
  const email = args.subscriberEmail.trim().toLowerCase()
  if (!email) return false

  const status = args.status ?? 'fired'
  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('make_webhook_fires')
    .insert({
      publication_id: args.publicationId,
      subscriber_email: email,
      source: args.source,
      subscriber_id: args.subscriberId,
      status,
      fired_at: status === 'fired' ? now : null,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      console.log(
        `[MakeWebhook] Skipped: already claimed for ${email} pub=${args.publicationId} (existing row)`
      )
      return false
    }
    console.error(
      `[MakeWebhook] Claim insert failed (failing closed): ${error.message} pub=${args.publicationId}`
    )
    return false
  }

  return !!data
}
```

Note: update the test's `fired_at` assertion to match — it should be a string (ISO) not a Date. Adjust the test from `expect(inserted.fired_at).toBeInstanceOf(Date)` to `expect(typeof inserted.fired_at).toBe('string')`.

- [ ] **Step 4: Re-run tests**

Run: `npx vitest run src/lib/sparkloop-client/__tests__/make-webhook.test.ts`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sparkloop-client/make-webhook.ts src/lib/sparkloop-client/__tests__/make-webhook.test.ts
git commit -m "feat(make-webhook): add status param to claimMakeWebhookFire"
```

---

## Task 5: Add `triggerMakeWebhook` orchestrator

**Files:**
- Modify: `src/lib/sparkloop-client/make-webhook.ts`
- Modify: `src/lib/sparkloop-client/index.ts`
- Test: `src/lib/sparkloop-client/__tests__/make-webhook.test.ts` (extend)

- [ ] **Step 1: Write failing tests for the four branches**

Append to the existing test file:

```ts
const fireMock = vi.fn()
const getPublicationSettingMock = vi.fn()
const getEmailProviderSettingsMock = vi.fn()

vi.mock('@/lib/publication-settings', () => ({
  getPublicationSetting: (...args: unknown[]) => getPublicationSettingMock(...args),
  getEmailProviderSettings: (...args: unknown[]) => getEmailProviderSettingsMock(...args),
}))

// Re-import after mocks are declared.
import { triggerMakeWebhook } from '../make-webhook'

describe('triggerMakeWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fireMock.mockReset()
    getPublicationSettingMock.mockReset()
    getEmailProviderSettingsMock.mockReset()
    // Default: webhook URL configured, gate off, provider mailerlite
    getPublicationSettingMock.mockImplementation(async (_pubId: string, key: string) => {
      if (key === 'sparkloop_webhook_url') return 'https://hook.example.com/abc'
      if (key === 'make_webhook_require_first_open') return 'false'
      return null
    })
    getEmailProviderSettingsMock.mockResolvedValue({ provider: 'mailerlite' })
  })

  it('returns gated:false fired:true on legacy immediate-fire path', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'r' }, error: null })
    // Stub fireMakeWebhook by spying on the module export — see implementation note.
    // For now assume helper returns true on success.
    const result = await triggerMakeWebhook({
      publicationId: 'pub-1',
      subscriberEmail: 'user@example.com',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
    })
    expect(result.claimed).toBe(true)
    expect(result.gated).toBe(false)
    // Inserted row had status=fired
    const inserted = insertMock.mock.calls[0][0]
    expect(inserted.status).toBe('fired')
  })

  it('returns gated:true fired:false when setting=on AND provider=beehiiv (claims pending, no fire)', async () => {
    getPublicationSettingMock.mockImplementation(async (_pubId: string, key: string) => {
      if (key === 'sparkloop_webhook_url') return 'https://hook.example.com/abc'
      if (key === 'make_webhook_require_first_open') return 'true'
      return null
    })
    getEmailProviderSettingsMock.mockResolvedValue({ provider: 'beehiiv' })
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'r' }, error: null })

    const result = await triggerMakeWebhook({
      publicationId: 'pub-1',
      subscriberEmail: 'user@example.com',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
    })

    expect(result.claimed).toBe(true)
    expect(result.gated).toBe(true)
    expect(result.fired).toBe(false)
    const inserted = insertMock.mock.calls[0][0]
    expect(inserted.status).toBe('pending')
    expect(inserted.fired_at).toBeNull()
  })

  it('falls back to immediate fire when setting=on but provider!=beehiiv (logs warn)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getPublicationSettingMock.mockImplementation(async (_pubId: string, key: string) => {
      if (key === 'sparkloop_webhook_url') return 'https://hook.example.com/abc'
      if (key === 'make_webhook_require_first_open') return 'true'
      return null
    })
    getEmailProviderSettingsMock.mockResolvedValue({ provider: 'mailerlite' })
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'r' }, error: null })

    const result = await triggerMakeWebhook({
      publicationId: 'pub-1',
      subscriberEmail: 'user@example.com',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
    })

    expect(result.gated).toBe(false)
    const inserted = insertMock.mock.calls[0][0]
    expect(inserted.status).toBe('fired')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('returns claimed:false when no webhook URL configured', async () => {
    getPublicationSettingMock.mockImplementation(async (_pubId: string, key: string) => {
      if (key === 'sparkloop_webhook_url') return ''
      if (key === 'make_webhook_require_first_open') return 'false'
      return null
    })

    const result = await triggerMakeWebhook({
      publicationId: 'pub-1',
      subscriberEmail: 'user@example.com',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
    })

    expect(result.claimed).toBe(false)
    expect(result.fired).toBe(false)
    expect(result.gated).toBe(false)
    expect(insertMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/sparkloop-client/__tests__/make-webhook.test.ts`
Expected: FAIL — `triggerMakeWebhook is not a function`.

- [ ] **Step 3: Implement `triggerMakeWebhook`**

Append to `src/lib/sparkloop-client/make-webhook.ts`:

```ts
import { getPublicationSetting, getEmailProviderSettings } from '@/lib/publication-settings'

export interface TriggerMakeWebhookArgs {
  publicationId: string
  subscriberEmail: string
  source: 'sparkloop' | 'afteroffers'
  subscriberId: string
}

export interface TriggerMakeWebhookResult {
  claimed: boolean
  fired: boolean
  gated: boolean
}

/**
 * Single entry point for subscribe routes to trigger the Make.com webhook.
 *
 * Decides between immediate fire (legacy behavior) and pending claim
 * (new Beehiiv first-open gate) based on per-publication settings:
 *   - make_webhook_require_first_open === 'true' AND email_provider === 'beehiiv'
 *     → claim with status='pending'; cron will fire later
 *   - Otherwise → claim with status='fired' and fire now (legacy behavior)
 *
 * If the gate setting is true but the provider is not Beehiiv, logs a warning
 * and falls back to immediate fire (the gate is Beehiiv-only by design).
 */
export async function triggerMakeWebhook(
  args: TriggerMakeWebhookArgs
): Promise<TriggerMakeWebhookResult> {
  const webhookUrl = await getPublicationSetting(args.publicationId, 'sparkloop_webhook_url')
  if (!webhookUrl || !webhookUrl.trim()) {
    return { claimed: false, fired: false, gated: false }
  }

  const requireFirstOpen = await getPublicationSetting(
    args.publicationId,
    'make_webhook_require_first_open'
  )
  const providerSettings = await getEmailProviderSettings(args.publicationId)
  const settingOn = requireFirstOpen === 'true'
  const isBeehiiv = providerSettings.provider === 'beehiiv'

  let gated = settingOn && isBeehiiv
  if (settingOn && !isBeehiiv) {
    console.warn(
      `[MakeWebhook] make_webhook_require_first_open=true but provider=${providerSettings.provider} for pub=${args.publicationId}; gate is Beehiiv-only. Falling back to immediate fire.`
    )
    gated = false
  }

  const claimed = await claimMakeWebhookFire({
    publicationId: args.publicationId,
    subscriberEmail: args.subscriberEmail,
    source: args.source,
    subscriberId: args.subscriberId,
    status: gated ? 'pending' : 'fired',
  })

  if (!claimed) {
    return { claimed: false, fired: false, gated }
  }

  if (gated) {
    return { claimed: true, fired: false, gated: true }
  }

  const fired = await fireMakeWebhook(
    webhookUrl,
    { subscriber_email: args.subscriberEmail.trim().toLowerCase(), subscriber_id: args.subscriberId },
    { publicationId: args.publicationId }
  )
  return { claimed: true, fired, gated: false }
}
```

Then in `src/lib/sparkloop-client/index.ts`, extend the export:

```ts
export {
  fireMakeWebhook,
  claimMakeWebhookFire,
  triggerMakeWebhook,
} from './make-webhook'
export type {
  MakeWebhookPayload,
  FireMakeWebhookOptions,
  ClaimMakeWebhookFireArgs,
  TriggerMakeWebhookArgs,
  TriggerMakeWebhookResult,
} from './make-webhook'
```

- [ ] **Step 4: Stub `fireMakeWebhook` for tests**

Update the test file `vi.mock` block to also intercept `fireMakeWebhook`. At top of file before the imports of `triggerMakeWebhook`:

```ts
vi.mock('../make-webhook', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../make-webhook')>()
  return {
    ...actual,
    fireMakeWebhook: (...args: unknown[]) => fireMock(...args),
  }
})
```

(If self-mocking the module under test causes import cycles, instead break `triggerMakeWebhook` into a separate file `src/lib/sparkloop-client/trigger-make-webhook.ts` that imports `fireMakeWebhook` and `claimMakeWebhookFire` from `./make-webhook`. That keeps the test mock clean.)

In the legacy immediate-fire test, set `fireMock.mockResolvedValue(true)` and assert `result.fired === true`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/sparkloop-client/__tests__/make-webhook.test.ts`
Expected: PASS — 7 tests passing total.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sparkloop-client/make-webhook.ts src/lib/sparkloop-client/index.ts src/lib/sparkloop-client/__tests__/make-webhook.test.ts
git commit -m "feat(make-webhook): add triggerMakeWebhook orchestrator with first-open gate"
```

---

## Task 6: Refactor `/api/sparkloop/subscribe` to use `triggerMakeWebhook`

**Files:**
- Modify: `src/app/api/sparkloop/subscribe/route.ts:5,235-260`

- [ ] **Step 1: Update the import**

In `src/app/api/sparkloop/subscribe/route.ts`, replace:

```ts
import { createSparkLoopServiceForPublication, fireMakeWebhook, claimMakeWebhookFire } from '@/lib/sparkloop-client'
```

with:

```ts
import { createSparkLoopServiceForPublication, triggerMakeWebhook } from '@/lib/sparkloop-client'
```

- [ ] **Step 2: Replace the inline claim+fire block**

Find the block around lines 237–260 that currently reads:

```ts
    if (subscriberUuid) {
      const webhookUrl = await getPublicationSetting(publicationId, 'sparkloop_webhook_url')
      if (webhookUrl) {
        const claimed = await claimMakeWebhookFire({
          publicationId,
          subscriberEmail: email,
          source: 'sparkloop',
          subscriberId: subscriberUuid,
        })
        if (claimed) {
          await fireMakeWebhook(
            webhookUrl,
            { subscriber_email: email, subscriber_id: subscriberUuid },
            { publicationId }
          )
        }
      }
    } else {
      console.log('[SparkLoop Subscribe] Skipping Make webhook: no subscriber_uuid available')
    }
```

Replace with:

```ts
    if (subscriberUuid) {
      await triggerMakeWebhook({
        publicationId,
        subscriberEmail: email,
        source: 'sparkloop',
        subscriberId: subscriberUuid,
      })
    } else {
      console.log('[SparkLoop Subscribe] Skipping Make webhook: no subscriber_uuid available')
    }
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no new errors. (Existing warnings about `getPublicationSetting` import being unused, if any, should be fixed by removing that import line if it's no longer referenced anywhere else in this file.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sparkloop/subscribe/route.ts
git commit -m "refactor(sparkloop/subscribe): route Make webhook through triggerMakeWebhook"
```

---

## Task 7: Refactor `/api/sparkloop/module-subscribe`

**Files:**
- Modify: `src/app/api/sparkloop/module-subscribe/route.ts:4,272-293`

- [ ] **Step 1: Update import**

Replace:

```ts
import { createSparkLoopServiceForPublication, fireMakeWebhook, claimMakeWebhookFire } from '@/lib/sparkloop-client'
```

with:

```ts
import { createSparkLoopServiceForPublication, triggerMakeWebhook } from '@/lib/sparkloop-client'
```

- [ ] **Step 2: Replace the claim+fire block**

Find the block around lines 274–293:

```ts
    if (subscriberUuid) {
      const webhookUrl = await getPublicationSetting(publicationId, 'sparkloop_webhook_url')
      if (webhookUrl) {
        const claimed = await claimMakeWebhookFire({
          publicationId,
          subscriberEmail: email,
          source: 'sparkloop',
          subscriberId: subscriberUuid,
        })
        if (claimed) {
          await fireMakeWebhook(
            webhookUrl,
            { subscriber_email: email, subscriber_id: subscriberUuid },
            { publicationId }
          )
        }
      }
    } else {
      console.log('[SparkLoop Module Subscribe] Skipping Make webhook: no subscriber_uuid available')
    }
```

Replace with:

```ts
    if (subscriberUuid) {
      await triggerMakeWebhook({
        publicationId,
        subscriberEmail: email,
        source: 'sparkloop',
        subscriberId: subscriberUuid,
      })
    } else {
      console.log('[SparkLoop Module Subscribe] Skipping Make webhook: no subscriber_uuid available')
    }
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sparkloop/module-subscribe/route.ts
git commit -m "refactor(sparkloop/module-subscribe): route Make webhook through triggerMakeWebhook"
```

---

## Task 8: Refactor `/api/sparkloop/recommend-subscribe`

**Files:**
- Modify: `src/app/api/sparkloop/recommend-subscribe/route.ts:5,258-275`

- [ ] **Step 1: Update import**

Replace:

```ts
import { createSparkLoopServiceForPublication, fireMakeWebhook, claimMakeWebhookFire } from '@/lib/sparkloop-client'
```

with:

```ts
import { createSparkLoopServiceForPublication, triggerMakeWebhook } from '@/lib/sparkloop-client'
```

- [ ] **Step 2: Replace the claim+fire block**

Find the block around lines 260–275 (mirror structure of Task 7) and replace with:

```ts
    if (subscriberUuid) {
      await triggerMakeWebhook({
        publicationId,
        subscriberEmail: email,
        source: 'sparkloop',
        subscriberId: subscriberUuid,
      })
    } else {
      console.log('[SparkLoop Recommend Subscribe] Skipping Make webhook: no subscriber_uuid available')
    }
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sparkloop/recommend-subscribe/route.ts
git commit -m "refactor(sparkloop/recommend-subscribe): route Make webhook through triggerMakeWebhook"
```

---

## Task 9: Refactor `/api/webhooks/afteroffers/postback`

**Files:**
- Modify: `src/app/api/webhooks/afteroffers/postback/route.ts:178-204`

- [ ] **Step 1: Update the dynamic import block**

Find the block at lines 178–204 that currently reads:

```ts
    try {
      const { getPublicationSetting } = await import('@/lib/publication-settings')
      const { fireMakeWebhook, claimMakeWebhookFire } = await import('@/lib/sparkloop-client')
      const webhookUrl = await getPublicationSetting(effectivePublicationId, 'sparkloop_webhook_url')
      if (webhookUrl) {
        const claimed = await claimMakeWebhookFire({
          publicationId: effectivePublicationId,
          subscriberEmail: email,
          source: 'afteroffers',
          subscriberId: clickId,
        })
        if (claimed) {
          await fireMakeWebhook(
            webhookUrl,
            { subscriber_email: email, subscriber_id: clickId },
            { publicationId: effectivePublicationId }
          )
        }
      }
    } catch (whErr: unknown) {
      const errMsg = whErr instanceof Error ? whErr.message : 'Unknown error'
      logger.error({ error: errMsg, clickId, maskedEmail: maskEmail(email) }, 'Make webhook error (non-fatal)')
    }
```

Replace with:

```ts
    try {
      const { triggerMakeWebhook } = await import('@/lib/sparkloop-client')
      await triggerMakeWebhook({
        publicationId: effectivePublicationId,
        subscriberEmail: email,
        source: 'afteroffers',
        subscriberId: clickId,
      })
    } catch (whErr: unknown) {
      const errMsg = whErr instanceof Error ? whErr.message : 'Unknown error'
      logger.error({ error: errMsg, clickId, maskedEmail: maskEmail(email) }, 'Make webhook error (non-fatal)')
    }
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/afteroffers/postback/route.ts
git commit -m "refactor(afteroffers/postback): route Make webhook through triggerMakeWebhook"
```

---

## Task 10: Settings API — read/write `make_webhook_require_first_open`

**Files:**
- Modify: `src/app/api/settings/sparkloop/route.ts`

- [ ] **Step 1: Extend the GET handler**

Replace the `Promise.all` and the response object in the GET handler with:

```ts
    const [upscribeId, webhookSecret, afteroffersFormId, makeWebhookUrl, requireFirstOpen] = await Promise.all([
      getPublicationSetting(publicationId, 'sparkloop_upscribe_id'),
      getPublicationSetting(publicationId, 'sparkloop_webhook_secret'),
      getPublicationSetting(publicationId, 'afteroffers_form_id'),
      getPublicationSetting(publicationId, 'sparkloop_webhook_url'),
      getPublicationSetting(publicationId, 'make_webhook_require_first_open'),
    ])

    return NextResponse.json({
      hasApiKey: !!process.env.SPARKLOOP_API_KEY,
      upscribeId: upscribeId || '',
      hasWebhookSecret: !!webhookSecret,
      afteroffersFormId: afteroffersFormId || '',
      makeWebhookUrl: makeWebhookUrl || '',
      makeWebhookRequireFirstOpen: requireFirstOpen === 'true',
    })
```

- [ ] **Step 2: Extend the POST handler**

After the `if (body.makeWebhookUrl !== undefined) { ... }` block, append:

```ts
    if (body.makeWebhookRequireFirstOpen !== undefined) {
      const value = body.makeWebhookRequireFirstOpen ? 'true' : 'false'
      const { error } = await updatePublicationSetting(
        publicationId,
        'make_webhook_require_first_open',
        value
      )
      if (error) throw new Error(`Failed to save first-open gate: ${error}`)
      results.push('First-open gate updated')
    }
```

- [ ] **Step 3: Smoke test the endpoint manually**

Run: `npm run build` (sanity)
Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/settings/sparkloop/route.ts
git commit -m "feat(settings): expose make_webhook_require_first_open on sparkloop settings API"
```

---

## Task 11: Settings UI — toggle for first-open gate

**Files:**
- Modify: `src/components/settings/SparkLoopSettings.tsx`

- [ ] **Step 1: Add field to state**

Find the initial state in the component (around line 6):

```ts
  const [settings, setSettings] = useState({
    upscribeId: '',
    webhookSecret: '',
    afteroffersFormId: '',
    makeWebhookUrl: '',
  })
```

Replace with:

```ts
  const [settings, setSettings] = useState({
    upscribeId: '',
    webhookSecret: '',
    afteroffersFormId: '',
    makeWebhookUrl: '',
    makeWebhookRequireFirstOpen: false,
  })
```

- [ ] **Step 2: Hydrate from API response**

In `loadSettings`, replace the `setSettings({...})` call with:

```ts
        setSettings({
          upscribeId: data.upscribeId || '',
          webhookSecret: '',
          afteroffersFormId: data.afteroffersFormId || '',
          makeWebhookUrl: data.makeWebhookUrl || '',
          makeWebhookRequireFirstOpen: !!data.makeWebhookRequireFirstOpen,
        })
```

- [ ] **Step 3: Add the toggle UI directly below the Make webhook URL block**

Find the closing `</div>` of the Make webhook URL block (after line 178) and insert before the next `{/* Inbound Webhook URL ... */}` comment:

```tsx
        {/* First-open gate toggle (Beehiiv only) */}
        <div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.makeWebhookRequireFirstOpen}
              onChange={(e) =>
                setSettings({ ...settings, makeWebhookRequireFirstOpen: e.target.checked })
              }
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium text-gray-700">
                Only fire webhook after subscriber's first open
              </span>
              <span className="block text-xs text-gray-400 mt-0.5">
                Beehiiv-provider publications only. When enabled, the Make webhook is delayed
                until the subscriber has opened at least one email. An hourly cron polls Beehiiv
                and fires the webhook once a first open is observed. Has no effect on
                MailerLite/SendGrid publications.
              </span>
            </span>
          </label>
        </div>
```

- [ ] **Step 4: Run dev server and visually verify**

Run: `npm run dev` then open `/dashboard/<slug>/settings/sparkloop` (or wherever the SparkLoop settings panel is mounted).
Expected: toggle renders below the Make webhook URL field; toggling it and saving persists across reloads.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/SparkLoopSettings.tsx
git commit -m "feat(settings-ui): add first-open gate toggle to SparkLoop settings"
```

---

## Task 12: Cron route scaffolding + helper for marking rows

**Files:**
- Create: `src/app/api/cron/check-pending-webhooks/route.ts`
- Modify: `src/lib/sparkloop-client/make-webhook.ts` (append row-update helpers)

- [ ] **Step 1: Add row-update helpers to `make-webhook.ts`**

Append:

```ts
/**
 * Transition a pending row to 'fired' and timestamp it. Idempotent — safe to
 * call again if the prior call partially succeeded.
 */
export async function markMakeWebhookFired(rowId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('make_webhook_fires')
    .update({ status: 'fired', fired_at: new Date().toISOString() })
    .eq('id', rowId)
  if (error) {
    console.error(`[MakeWebhook] markFired failed id=${rowId}: ${error.message}`)
  }
}

/**
 * Transition a pending row to 'expired' with a reason tag.
 */
export async function markMakeWebhookExpired(rowId: string, reason: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('make_webhook_fires')
    .update({ status: 'expired', expired_reason: reason })
    .eq('id', rowId)
  if (error) {
    console.error(`[MakeWebhook] markExpired failed id=${rowId} reason=${reason}: ${error.message}`)
  }
}

/**
 * Bump last_polled_at + poll_attempts on a pending row that didn't change state.
 */
export async function recordPollAttempt(rowId: string, currentAttempts: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from('make_webhook_fires')
    .update({ last_polled_at: new Date().toISOString(), poll_attempts: currentAttempts + 1 })
    .eq('id', rowId)
  if (error) {
    console.error(`[MakeWebhook] recordPollAttempt failed id=${rowId}: ${error.message}`)
  }
}
```

Update `src/lib/sparkloop-client/index.ts` to export these:

```ts
export {
  fireMakeWebhook,
  claimMakeWebhookFire,
  triggerMakeWebhook,
  markMakeWebhookFired,
  markMakeWebhookExpired,
  recordPollAttempt,
} from './make-webhook'
```

- [ ] **Step 2: Create the cron route shell**

Create `src/app/api/cron/check-pending-webhooks/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { getPublicationSetting, getEmailProviderSettings } from '@/lib/publication-settings'
import { getBeehiivSubscriberStats } from '@/lib/beehiiv'
import {
  fireMakeWebhook,
  markMakeWebhookExpired,
  markMakeWebhookFired,
  recordPollAttempt,
} from '@/lib/sparkloop-client'

const BATCH_SIZE = 500
const CONCURRENCY = 5
const POLL_ATTEMPTS_EXPIRE_THRESHOLD = 168 // ~7 days at hourly cadence

interface PendingRow {
  id: string
  subscriber_email: string
  subscriber_id: string
  source: 'sparkloop' | 'afteroffers'
  poll_attempts: number
}

interface PerPubSummary {
  pubId: string
  checked: number
  fired: number
  expired: number
  skipped: number
  durationMs: number
}

const handler = withApiHandler(
  { authTier: 'system', logContext: 'check-pending-webhooks' },
  async ({ logger }) => {
    const startedAt = Date.now()

    // 1. Find candidate publications.
    const { data: pubs, error: pubsErr } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
    if (pubsErr) {
      throw new Error(`Failed to load publications: ${pubsErr.message}`)
    }

    const summaries: PerPubSummary[] = []
    for (const pub of pubs || []) {
      const summary = await processPublication(pub.id, logger)
      if (summary) summaries.push(summary)
    }

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startedAt,
      publicationsChecked: summaries.length,
      summaries,
    })
  }
)

async function processPublication(pubId: string, logger: any): Promise<PerPubSummary | null> {
  const requireFirstOpen = await getPublicationSetting(pubId, 'make_webhook_require_first_open')
  if (requireFirstOpen !== 'true') return null

  const provider = await getEmailProviderSettings(pubId)
  if (provider.provider !== 'beehiiv') return null

  const beehiivPubId = provider.beehiivPublicationId
  const beehiivApiKey = provider.beehiivApiKey
  const webhookUrl = await getPublicationSetting(pubId, 'sparkloop_webhook_url')

  if (!beehiivPubId || !beehiivApiKey || !webhookUrl) {
    logger.warn({ pubId }, '[CheckPendingWebhooks] Missing Beehiiv credentials or webhook URL; skipping publication')
    return null
  }

  const startedAt = Date.now()
  const { data: rows, error } = await supabaseAdmin
    .from('make_webhook_fires')
    .select('id, subscriber_email, subscriber_id, source, poll_attempts')
    .eq('publication_id', pubId)
    .eq('status', 'pending')
    .order('last_polled_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)
  if (error) {
    logger.error({ pubId, err: error.message }, '[CheckPendingWebhooks] Failed to load pending rows')
    return null
  }

  const summary: PerPubSummary = {
    pubId,
    checked: 0,
    fired: 0,
    expired: 0,
    skipped: 0,
    durationMs: 0,
  }
  if (!rows || rows.length === 0) {
    summary.durationMs = Date.now() - startedAt
    return summary
  }

  // Concurrency-bounded loop. Bails on rate-limit.
  let bail = false
  const queue = [...(rows as PendingRow[])]
  await Promise.all(
    Array.from({ length: CONCURRENCY }).map(async () => {
      while (!bail && queue.length > 0) {
        const row = queue.shift()!
        const outcome = await processRow({ row, pubId, beehiivPubId, beehiivApiKey, webhookUrl })
        summary.checked += 1
        if (outcome === 'fired') summary.fired += 1
        else if (outcome === 'expired') summary.expired += 1
        else if (outcome === 'skipped') summary.skipped += 1
        else if (outcome === 'rate_limited') {
          bail = true
          summary.skipped += 1
        }
      }
    })
  )

  summary.durationMs = Date.now() - startedAt
  logger.info(
    {
      pubId,
      checked: summary.checked,
      fired: summary.fired,
      expired: summary.expired,
      skipped: summary.skipped,
      durationMs: summary.durationMs,
    },
    '[CheckPendingWebhooks] Per-publication summary'
  )
  return summary
}

type RowOutcome = 'fired' | 'expired' | 'skipped' | 'pending' | 'rate_limited'

async function processRow(args: {
  row: PendingRow
  pubId: string
  beehiivPubId: string
  beehiivApiKey: string
  webhookUrl: string
}): Promise<RowOutcome> {
  const { row, pubId, beehiivPubId, beehiivApiKey, webhookUrl } = args
  const stats = await getBeehiivSubscriberStats(row.subscriber_email, beehiivPubId, beehiivApiKey)

  if (stats.rateLimited) {
    await recordPollAttempt(row.id, row.poll_attempts)
    return 'rate_limited'
  }
  if (!stats.found) {
    if (stats.error) {
      await recordPollAttempt(row.id, row.poll_attempts)
      return 'skipped'
    }
    if (row.poll_attempts + 1 >= POLL_ATTEMPTS_EXPIRE_THRESHOLD) {
      await markMakeWebhookExpired(row.id, 'not_found')
      return 'expired'
    }
    await recordPollAttempt(row.id, row.poll_attempts)
    return 'pending'
  }

  const opens = stats.uniqueOpens || 0
  if (opens > 0) {
    await markMakeWebhookFired(row.id)
    await fireMakeWebhook(
      webhookUrl,
      { subscriber_email: row.subscriber_email, subscriber_id: row.subscriber_id },
      { publicationId: pubId }
    )
    return 'fired'
  }

  const status = stats.status
  if (status === 'unsubscribed' || status === 'inactive' || status === 'deleted') {
    await markMakeWebhookExpired(row.id, status)
    return 'expired'
  }
  if (status === 'pending') {
    if (row.poll_attempts + 1 >= POLL_ATTEMPTS_EXPIRE_THRESHOLD) {
      await markMakeWebhookExpired(row.id, 'unconfirmed')
      return 'expired'
    }
  }

  await recordPollAttempt(row.id, row.poll_attempts)
  return 'pending'
}

export const GET = handler
export const POST = handler
export const maxDuration = 300
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sparkloop-client/make-webhook.ts src/lib/sparkloop-client/index.ts src/app/api/cron/check-pending-webhooks/route.ts
git commit -m "feat(cron): add check-pending-webhooks route to gate Make on first open"
```

---

## Task 13: Cron iteration test

**Files:**
- Create: `src/app/api/cron/check-pending-webhooks/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create the test file:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const fromMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}))

const getPublicationSettingMock = vi.fn()
const getEmailProviderSettingsMock = vi.fn()
vi.mock('@/lib/publication-settings', () => ({
  getPublicationSetting: (...args: unknown[]) => getPublicationSettingMock(...args),
  getEmailProviderSettings: (...args: unknown[]) => getEmailProviderSettingsMock(...args),
}))

const getBeehiivSubscriberStatsMock = vi.fn()
vi.mock('@/lib/beehiiv', () => ({
  getBeehiivSubscriberStats: (...args: unknown[]) => getBeehiivSubscriberStatsMock(...args),
}))

const fireMakeWebhookMock = vi.fn()
const markFiredMock = vi.fn()
const markExpiredMock = vi.fn()
const recordPollAttemptMock = vi.fn()
vi.mock('@/lib/sparkloop-client', () => ({
  fireMakeWebhook: (...args: unknown[]) => fireMakeWebhookMock(...args),
  markMakeWebhookFired: (...args: unknown[]) => markFiredMock(...args),
  markMakeWebhookExpired: (...args: unknown[]) => markExpiredMock(...args),
  recordPollAttempt: (...args: unknown[]) => recordPollAttemptMock(...args),
}))

vi.mock('@/lib/api-handler', () => ({
  withApiHandler: (_opts: unknown, fn: any) => async (req: any) =>
    fn({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }, request: req }),
}))

import { GET } from '../route'

function buildSelectChain(rows: any[]) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: rows, error: null }),
  }
  return chain
}

describe('check-pending-webhooks cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromMock.mockImplementation((table: string) => {
      if (table === 'publications') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ id: 'pub-1' }], error: null }),
          }),
        }
      }
      if (table === 'make_webhook_fires') {
        return buildSelectChain([
          {
            id: 'row-1',
            subscriber_email: 'opener@example.com',
            subscriber_id: 'sub_1',
            source: 'sparkloop',
            poll_attempts: 0,
          },
          {
            id: 'row-2',
            subscriber_email: 'unsubscribed@example.com',
            subscriber_id: 'sub_2',
            source: 'sparkloop',
            poll_attempts: 0,
          },
          {
            id: 'row-3',
            subscriber_email: 'noopen@example.com',
            subscriber_id: 'sub_3',
            source: 'sparkloop',
            poll_attempts: 5,
          },
        ])
      }
      return {}
    })

    getPublicationSettingMock.mockImplementation(async (_pub: string, key: string) => {
      if (key === 'make_webhook_require_first_open') return 'true'
      if (key === 'sparkloop_webhook_url') return 'https://hook.example.com/abc'
      return null
    })
    getEmailProviderSettingsMock.mockResolvedValue({
      provider: 'beehiiv',
      beehiivPublicationId: 'pub_b',
      beehiivApiKey: 'key',
    })

    getBeehiivSubscriberStatsMock.mockImplementation(async (email: string) => {
      if (email === 'opener@example.com')
        return { found: true, status: 'active', uniqueOpens: 2, emailsReceived: 5, subscriptionId: 's1' }
      if (email === 'unsubscribed@example.com')
        return { found: true, status: 'unsubscribed', uniqueOpens: 0, emailsReceived: 3, subscriptionId: 's2' }
      if (email === 'noopen@example.com')
        return { found: true, status: 'active', uniqueOpens: 0, emailsReceived: 2, subscriptionId: 's3' }
      return { found: false }
    })

    fireMakeWebhookMock.mockResolvedValue(true)
  })

  it('fires for opener, expires for unsubscribed, polls again for no-open', async () => {
    const response = await GET(new Request('http://localhost/api/cron/check-pending-webhooks') as any)
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.summaries[0].checked).toBe(3)
    expect(body.summaries[0].fired).toBe(1)
    expect(body.summaries[0].expired).toBe(1)

    expect(markFiredMock).toHaveBeenCalledWith('row-1')
    expect(fireMakeWebhookMock).toHaveBeenCalledTimes(1)
    expect(markExpiredMock).toHaveBeenCalledWith('row-2', 'unsubscribed')
    expect(recordPollAttemptMock).toHaveBeenCalledWith('row-3', 5)
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/app/api/cron/check-pending-webhooks/__tests__/route.test.ts`
Expected: PASS — 1 test passing. (If it fails, debug the mock chain — Supabase's `.eq().eq().order().order().limit()` chain shape needs to match exactly what the route uses.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/check-pending-webhooks/__tests__/route.test.ts
git commit -m "test(cron): cover check-pending-webhooks decision branches"
```

---

## Task 14: Register cron in `vercel.json`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add cron schedule entry**

Inside the `"crons": [...]` array, add a new entry (place near other cron entries):

```json
    {
      "path": "/api/cron/check-pending-webhooks",
      "schedule": "0 * * * *"
    },
```

- [ ] **Step 2: Add maxDuration entry in `functions` block**

Inside the `"functions": { ... }` block, add:

```json
    "app/api/cron/check-pending-webhooks/route.ts": {
      "maxDuration": 300
    },
```

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json'))"`
Expected: no output (valid JSON).

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "chore(cron): register check-pending-webhooks hourly cron in vercel.json"
```

---

## Task 15: Debug endpoint for pending state

**Files:**
- Create: `src/app/api/debug/(integrations)/make-webhook-pending/route.ts`

- [ ] **Step 1: Create the read-only endpoint**

```ts
import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/debug/make-webhook-pending?publication_id=X
 *
 * Read-only health view of the make_webhook_fires lifecycle.
 * Returns counts by status, oldest pending age, and expired-reason distribution.
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/make-webhook-pending' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')
    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('make_webhook_fires')
      .select('status, expired_reason, created_at, poll_attempts')
      .eq('publication_id', publicationId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data || []
    const counts = { pending: 0, fired: 0, expired: 0 }
    const expiredByReason: Record<string, number> = {}
    let oldestPendingMs: number | null = null
    const pollAttemptsAll: number[] = []
    const now = Date.now()

    for (const r of rows) {
      const status = r.status as 'pending' | 'fired' | 'expired'
      counts[status] = (counts[status] || 0) + 1
      if (status === 'expired' && r.expired_reason) {
        expiredByReason[r.expired_reason] = (expiredByReason[r.expired_reason] || 0) + 1
      }
      if (status === 'pending') {
        const ageMs = now - new Date(r.created_at).getTime()
        if (oldestPendingMs === null || ageMs > oldestPendingMs) oldestPendingMs = ageMs
        pollAttemptsAll.push(r.poll_attempts ?? 0)
      }
    }

    pollAttemptsAll.sort((a, b) => a - b)
    const p95 =
      pollAttemptsAll.length === 0
        ? 0
        : pollAttemptsAll[Math.min(pollAttemptsAll.length - 1, Math.floor(pollAttemptsAll.length * 0.95))]

    return NextResponse.json({
      publicationId,
      counts,
      expiredByReason,
      oldestPendingHours: oldestPendingMs ? Math.round(oldestPendingMs / 3_600_000) : null,
      p95PollAttempts: p95,
    })
  }
)
```

- [ ] **Step 2: Smoke test**

Run: `npm run build`
Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/debug/\(integrations\)/make-webhook-pending/route.ts
git commit -m "feat(debug): add make-webhook-pending health endpoint"
```

---

## Task 16: Full local verification + staging deploy

**Files:**
- None (procedural)

- [ ] **Step 1: Full type-check + tests**

Run:
```bash
npm run type-check
npm run test:run -- src/lib/__tests__/beehiiv.test.ts src/lib/sparkloop-client/__tests__/make-webhook.test.ts src/app/api/cron/check-pending-webhooks/__tests__/route.test.ts
npm run build
```
Expected: all green.

- [ ] **Step 2: Pre-push review gate**

Run:
```
/simplify
/requesting-code-review
/review:pre-push
```

Address any required findings before pushing.

- [ ] **Step 3: Push to staging**

```bash
git push origin <current-branch>
```

Open a PR targeting `staging` and merge once CI is green.

- [ ] **Step 4: Verify migration on staging**

Confirm `npm run migrate:staging` was run earlier (Task 1). If not, run it now against the staging Supabase.

- [ ] **Step 5: Manual staging walkthrough**

1. In the staging dashboard, open SparkLoop settings for the publication you use for staging tests.
2. Confirm the Make webhook URL is set and provider is `beehiiv` (set up if not).
3. Toggle **"Only fire webhook after subscriber's first open"** ON. Save.
4. Trigger a SparkLoop subscribe via the staging signup flow with a fresh test email.
5. In Supabase staging, confirm a row appears in `make_webhook_fires` with `status='pending'`, `fired_at IS NULL`.
6. Manually invoke the cron once to verify the no-open path:
   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://aiprodaily-staging.vercel.app/api/cron/check-pending-webhooks
   ```
   Confirm the row's `last_polled_at` updated and `poll_attempts` incremented to 1, status still `pending`.
7. Open the test email in the inbox (or use a tracking-pixel test).
8. Wait for the Beehiiv stats to reflect the open (a few minutes). Re-invoke the cron.
9. Confirm the row transitioned to `status='fired'`, `fired_at` populated, and Make.com received the webhook payload.

- [ ] **Step 6: Verify a non-Beehiiv publication is unaffected**

On a staging publication using `email_provider='mailerlite'`, leave the toggle OFF. Trigger a subscribe. Confirm the row is created with `status='fired'` and the webhook fires immediately (existing behavior).

Then flip the toggle ON for that same MailerLite publication, trigger another subscribe, and confirm the warning log fires AND the webhook still fires immediately (fall-back behavior).

- [ ] **Step 7: Production rollout**

```bash
npm run migrate:prod
```

Then merge `staging` → `master` and let Vercel auto-deploy. After deploy:
1. Watch logs for the first hourly run of `/api/cron/check-pending-webhooks`.
2. Flip `make_webhook_require_first_open=true` on AI Pros Daily via the dashboard.
3. Verify next signup creates a pending row; verify next hourly cron run processes it.

- [ ] **Step 8: Final commit (if any cleanup needed)**

If the rollout surfaced any small fixes, commit them. Otherwise the plan is complete.

---

## Self-Review

**Spec coverage check:**

- Section 1 (data model) → Task 1 ✅
- Section 2 (subscribe-path changes) → Tasks 4, 5, 6, 7, 8, 9 ✅
- Section 3 (polling cron) → Tasks 2, 3, 12, 13 ✅
- Section 4 (settings UI + cron registration) → Tasks 10, 11, 14 ✅
- Section 5 (edge cases + observability) → Task 13 (covers fired/expired/pending branches), Task 15 (debug endpoint), Task 16 (manual verification of full flow) ✅

**Type consistency check:** `claimMakeWebhookFire` arg `status: 'pending' | 'fired'` matches `triggerMakeWebhook`'s usage. `BeehiivSubscriberStats.uniqueOpens` matches `getBeehiivSubscriberStats` return shape. Cron consumes `markMakeWebhookFired(rowId)`, `markMakeWebhookExpired(rowId, reason)`, `recordPollAttempt(rowId, currentAttempts)` — all defined in Task 12.

**Placeholder scan:** No "TBD" / "implement later" / vague directions found. Each step has the actual code or command.

**One residual note:** Task 5 Step 4 mentions a possible refactor ("if self-mocking the module under test causes import cycles, instead break `triggerMakeWebhook` into a separate file…"). This is a fallback for a known TS quirk, not a placeholder — the primary path is the `vi.mock` with `importOriginal`, and the fallback is concretely specified if needed.
