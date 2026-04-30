# Beehiiv First-Open Make Webhook Gate — Design

**Date:** 2026-04-30
**Status:** Draft — pending implementation plan
**Scope:** Beehiiv-provider publications only (MailerLite/SendGrid deferred)

---

## Problem

The existing Make.com webhook fires immediately on every SparkLoop or AfterOffers signup (with a per-(publication, subscriber) dedup so it fires at most once). Downstream automations want to act only on subscribers who have demonstrated engagement, defined as **at least one email open** from the publication. We need to delay the webhook until a first open is observed, scoped to publications using Beehiiv as their email provider so we can use Beehiiv's per-subscriber stats API.

---

## Goals

- Fire the Make webhook **only after** a subscriber's first open of any email from the publication.
- Preserve the existing at-most-once dedup contract (per `publication_id`, `subscriber_email`).
- Opt-in per publication via a new setting; existing publications continue to fire immediately until the setting is flipped.
- Beehiiv-only for v1. Provide a clean extension point for MailerLite/SendGrid in a future spec.
- No retroactive gating: only signups received after the setting is flipped go through the new flow.

## Non-goals

- Per-subscriber-per-issue open tracking (Beehiiv doesn't expose this; out of scope).
- First-open detection for MailerLite or SendGrid publications (deferred).
- Auto-flushing orphaned pending rows when settings or providers change mid-flight.
- Per-publication custom poll cadences.
- Slack alerting beyond existing generic cron-failure alerts.

---

## Architecture overview

1. **Subscribe path** (4 routes today: 3 SparkLoop + AfterOffers postback) collapses to one helper, `triggerMakeWebhook`. The helper inspects per-publication settings to decide whether to fire immediately or claim a `pending` row.
2. **Pending state** lives in the existing `make_webhook_fires` table, extended with status/lifecycle columns. The unique `(publication_id, subscriber_email)` constraint already in place doubles as the cross-source dedup.
3. **Hourly cron** (`/api/cron/check-pending-webhooks`) polls Beehiiv's per-subscriber stats endpoint for each pending row. On first open detected, it transitions the row to `fired` and calls the existing `fireMakeWebhook()` helper. On terminal subscriber states (unsubscribed/inactive/deleted) it transitions to `expired`.
4. **Settings UI** exposes one new toggle (`make_webhook_require_first_open`) on the existing SparkLoop settings panel.

---

## Section 1 — Data model

Migration: `db/migrations/20260430_make_webhook_first_open_gate.sql`

```sql
ALTER TABLE make_webhook_fires
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'fired'
    CHECK (status IN ('pending', 'fired', 'expired')),
  ADD COLUMN IF NOT EXISTS fired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS poll_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expired_reason TEXT;

-- Backfill: existing rows are from the old immediate-fire flow
UPDATE make_webhook_fires
   SET fired_at = created_at
 WHERE fired_at IS NULL AND status = 'fired';

-- Hot path for the cron: only pending rows are indexed
CREATE INDEX IF NOT EXISTS idx_make_webhook_fires_pending
  ON make_webhook_fires(publication_id, last_polled_at NULLS FIRST)
  WHERE status = 'pending';
```

Column rationale:

- `status` — drives the lifecycle. Default `'fired'` preserves existing rows and any future non-gated claims.
- `fired_at` — nullable while pending; populated when Make is triggered.
- `last_polled_at` — fairness ordering for the cron (oldest-checked first).
- `poll_attempts` — used as the soft cap for 7-day expiry of stuck rows (404, unconfirmed).
- `expired_reason` — short tag (`'unsubscribed'`, `'inactive'`, `'not_found'`, `'unconfirmed'`, etc.) for debuggability.

New publication setting: `make_webhook_require_first_open` (string `'true'` / `'false'` per existing convention, default `'false'`).

| Setting | Provider | Behavior |
|---|---|---|
| `'false'` | any | Immediate fire (current behavior, unchanged) |
| `'true'` | `beehiiv` | Pending → polled → fired-on-first-open |
| `'true'` | `mailerlite` / `sendgrid` | Log a one-line warning, fall back to immediate fire |

---

## Section 2 — Subscribe-path changes

### Helper extraction

New helper in `src/lib/sparkloop-client/make-webhook.ts`:

```ts
export async function triggerMakeWebhook(args: {
  publicationId: string
  subscriberEmail: string
  source: 'sparkloop' | 'afteroffers'
  subscriberId: string
}): Promise<{ claimed: boolean; fired: boolean; gated: boolean }>
```

Internal logic:

1. Read `sparkloop_webhook_url`. If missing, return `{ claimed: false, fired: false, gated: false }`.
2. Read `make_webhook_require_first_open` and `email_provider`.
3. Compute `gated = (setting === 'true' && provider === 'beehiiv')`. If setting is `'true'` but provider is non-Beehiiv, log a warning and treat as `gated = false`.
4. Atomic claim into `make_webhook_fires` with `status = gated ? 'pending' : 'fired'` and `fired_at = gated ? null : NOW()`. Existing `23505` unique-violation handling stays — duplicate claim returns `claimed: false`. Fail-closed on other DB errors.
5. If `claimed && !gated`: call `fireMakeWebhook()`. Return `fired: true` on 2xx, `fired: false` otherwise. Row stays marked `'fired'` either way (matches today's claim-then-send semantics).

### Call site refactor

The four routes become a single call each:

- `src/app/api/sparkloop/subscribe/route.ts`
- `src/app/api/sparkloop/module-subscribe/route.ts`
- `src/app/api/sparkloop/recommend-subscribe/route.ts`
- `src/app/api/webhooks/afteroffers/postback/route.ts`

Existing `claimMakeWebhookFire()` and `fireMakeWebhook()` stay exported for the cron's use; the four subscribe routes only import `triggerMakeWebhook` going forward.

### Behavior preserved

Beehiiv custom field flips (`sparkloop=true`, `afteroffers_conversion=true`) remain immediate and independent of the Make webhook gate. The gate affects only the Make webhook fire.

---

## Section 3 — Polling cron

### Route

- File: `src/app/api/cron/check-pending-webhooks/route.ts`
- Schedule (in `vercel.json`): `0 * * * *` (every hour, top of the hour)
- Auth tier: `system`
- `maxDuration: 300`

### Per-run flow

```
1. Find publications where:
     publications.is_active = true
     AND email_provider = 'beehiiv'
     AND publication_settings.make_webhook_require_first_open = 'true'

2. For each publication:
   a. Load: beehiiv_publication_id, beehiiv_api_key, sparkloop_webhook_url
      Skip publication if any are missing (log once)
   b. Query pending rows:
        SELECT id, subscriber_email, subscriber_id, source, poll_attempts
          FROM make_webhook_fires
         WHERE publication_id = $1 AND status = 'pending'
         ORDER BY last_polled_at NULLS FIRST, created_at ASC
         LIMIT 500
   c. Process the batch with concurrency = 5
   d. Aggregate counts; one-line summary log per publication
```

### Per-row decision

One Beehiiv call per row: `GET /publications/{pub_id}/subscriptions/by_email/{email}?expand=stats`.

Decision order matters — checks are evaluated top-down, first match wins. Opens are checked **before** unsubscribed/inactive status so a subscriber who opened and then unsubscribed between polls still fires (they were engaged).

| Order | Beehiiv response | Action | Row update |
|---|---|---|---|
| 1 | 429 rate-limited | skip row, bail batch | `last_polled_at=NOW()`, `poll_attempts += 1`. Resume next hour. |
| 2 | 404 / not found, `poll_attempts < 168` | leave pending | `last_polled_at=NOW()`, `poll_attempts += 1` |
| 3 | 404 / not found, `poll_attempts >= 168` (~7 days) | expire | `status='expired'`, `expired_reason='not_found'` |
| 4 | `unique_opens > 0` (or `opens > 0` if `unique_opens` not present) | **fire webhook** | mark `status='fired'`, `fired_at=NOW()` first, then call `fireMakeWebhook()` (best-effort, non-2xx leaves row as fired and is logged) |
| 5 | `subscription.status` ∈ {`unsubscribed`, `inactive`, `deleted`} | expire immediately | `status='expired'`, `expired_reason=<status>` |
| 6 | `subscription.status === 'pending'` (double-opt-in unconfirmed), `poll_attempts < 168` | leave pending | `last_polled_at=NOW()`, `poll_attempts += 1` |
| 7 | `subscription.status === 'pending'`, `poll_attempts >= 168` | expire | `status='expired'`, `expired_reason='unconfirmed'` |
| 8 | `unique_opens === 0`, status active | leave pending | `last_polled_at=NOW()`, `poll_attempts += 1` |
| 9 | 5xx / network / parse error | skip row | `last_polled_at=NOW()`, `poll_attempts += 1`. Logged. |

### New Beehiiv helper

`src/lib/beehiiv.ts` gains `getBeehiivSubscriberStats(email, pubId, apiKey)`:

```ts
export async function getBeehiivSubscriberStats(
  email: string,
  beehiivPublicationId: string,
  beehiivApiKey: string
): Promise<{
  found: boolean
  status?: string
  uniqueOpens?: number
  emailsReceived?: number
  subscriptionId?: string
  rateLimited?: boolean
  error?: string
}>
```

Reuses the by-email lookup pattern from `updateBeehiivSubscriberField`. Calls `/subscriptions/by_email/{email}?expand=stats`. Handles 404, 429, and 5xx the same way the existing helper does.

### Webhook payload preserved

`{ subscriber_email, subscriber_id }` where `subscriber_id` is the **original** value stored at signup (SparkLoop UUID or AfterOffers `click_id`), not the Beehiiv subscription ID. Downstream Make consumers expect that contract.

### Sizing

- AI Pros Daily acquisition rate × ~3 days median time-to-first-open ⇒ steady-state pending probably <500.
- 500 rows × hourly = ~12,000 Beehiiv calls/day per publication. Beehiiv's documented per-publication rate limits comfortably exceed the cron's burst at concurrency 5; if 429s start appearing we drop concurrency or lower the batch cap.
- Batch cap of 500 protects against runaway growth; the next hour catches whatever spilled over.

---

## Section 4 — Settings UI + cron registration

### Setting plumbing

- `src/app/api/settings/sparkloop/route.ts` — extend GET to read `make_webhook_require_first_open` (default `'false'`); extend PUT to validate and write it.
- `src/components/settings/SparkLoopSettings.tsx` — add a toggle directly under the webhook URL field, labeled *"Only fire webhook after subscriber's first open (Beehiiv only)"* with a one-line helper text describing the behavior.

The toggle is purely opt-in. Backend default of `'false'` means existing publications keep current behavior until someone flips it.

### Cron registration

Add to `vercel.json` next to existing crons:

```json
{ "path": "/api/cron/check-pending-webhooks", "schedule": "0 * * * *" }
```

### Deploy order

1. `npm run migrate:staging` — apply column additions + backfill.
2. Deploy code to staging — verify cron route returns 200 on a no-op run.
3. Flip `make_webhook_require_first_open=true` on a staging publication with Beehiiv configured. Trigger a test SparkLoop subscribe, verify the pending row appears, manually poll subscription stats to confirm the loop transitions correctly.
4. `npm run migrate:prod` → deploy to prod.
5. Flip setting on AI Pros Daily.
6. Watch logs for the first hourly run.

---

## Section 5 — Edge cases + observability

### Edge cases

| Case | Behavior |
|---|---|
| Subscriber was on Beehiiv list before SparkLoop sign-up and already has prior opens | Fires on first poll (intentional — they're demonstrably engaged) |
| Subscriber not yet provisioned in Beehiiv when we poll (404) | Stay pending up to 7 days (`poll_attempts < 168`); after that, expire as `not_found` |
| Beehiiv `subscription.status === 'pending'` (double-opt-in not confirmed) | Same 7-day grace, then expire as `unconfirmed` |
| Beehiiv `subscription.status` ∈ {`unsubscribed`, `inactive`, `deleted`} | Expire immediately |
| Subscriber both opened AND unsubscribed between polls | Open wins → fire (decision order checks opens first) |
| Same email signs up via SparkLoop then AfterOffers while pending | Second signup hits 23505 unique-violation, no-op. Pending row handles it. |
| Make endpoint returns non-2xx when cron fires | Row stays `fired` (matches today's semantics). Logged. |
| Setting flipped `true → false` mid-flight | Outer publications loop excludes the publication; pending rows sit indefinitely. Manual SQL flush if needed. |
| Provider switched `beehiiv → mailerlite` mid-flight | Same as above — pending rows orphan. Documented. |
| Beehiiv API returns `opens` instead of `unique_opens` | Helper checks both: `uniqueOpens ?? opens ?? 0` |

### Observability

- **Cron summary log** (per publication, per run): `[CheckPendingWebhooks] pub=<id> checked=N fired=X expired=Y skipped=Z duration=Tms`
- **Per-row error logs** only on unexpected failures (5xx, network, parse). 404 / unsubscribed / no-opens are normal and stay quiet.
- **Debug endpoint:** `src/app/api/debug/(integrations)/make-webhook-pending/route.ts` returning per-publication counts: `{ pending, fired, expired_by_reason, oldest_pending_age, p95_poll_attempts }`. Lets you sanity-check a publication's gate health without SQL access.
- **No new Slack alerting** — existing cron-failure alerting covers the route.

### Testing

- Unit tests for `triggerMakeWebhook` covering the four branches (gate-on-beehiiv, gate-on-non-beehiiv-warning, gate-off, no-webhook-url).
- Unit tests for `getBeehiivSubscriberStats` response parsing across status/opens variants.
- Integration test for one cron iteration with a mocked Beehiiv client and a fixture set covering each row-level decision branch.
- Manual staging walkthrough using the deploy-order checklist in Section 4.

---

## Out of scope (deliberate)

- MailerLite/SendGrid first-open detection. Beehiiv's per-subscriber stats endpoint makes v1 cleanly scoped; other providers don't expose equivalent data without per-campaign enumeration. Follow-up spec.
- Backfilling old `'fired'` rows to retroactively apply the gate. Existing subscribers who got the webhook under the old immediate-fire flow stay as-is.
- Auto-flushing orphaned pending rows when settings or providers change. Operator decision; trivial SQL when needed.
- Per-publication custom poll cadences. Everyone gets hourly.
- Cap on retries when Make endpoint is down. Today's behavior is "best-effort once" and we match it.

---

## Summary of new + changed files

**New:**
- `db/migrations/20260430_make_webhook_first_open_gate.sql`
- `src/app/api/cron/check-pending-webhooks/route.ts`
- `src/app/api/debug/(integrations)/make-webhook-pending/route.ts`
- Tests for `triggerMakeWebhook`, `getBeehiivSubscriberStats`, cron iteration

**Modified:**
- `src/lib/sparkloop-client/make-webhook.ts` — add `triggerMakeWebhook()`, extend `claimMakeWebhookFire()` with optional `status` arg
- `src/lib/sparkloop-client/index.ts` — export new helper
- `src/lib/beehiiv.ts` — add `getBeehiivSubscriberStats()`
- `src/app/api/sparkloop/subscribe/route.ts`
- `src/app/api/sparkloop/module-subscribe/route.ts`
- `src/app/api/sparkloop/recommend-subscribe/route.ts`
- `src/app/api/webhooks/afteroffers/postback/route.ts`
- `src/app/api/settings/sparkloop/route.ts`
- `src/components/settings/SparkLoopSettings.tsx`
- `vercel.json` — add hourly cron entry
