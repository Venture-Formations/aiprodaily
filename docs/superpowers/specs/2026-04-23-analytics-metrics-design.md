---
name: Analytics & Metrics Standardization
created: 2026-04-23
status: draft
owner: @jake
---

# Analytics & Metrics Standardization — Design

## 1. Problem

The `/analytics` pages currently violate several industry best practices for product metrics:

- **No single source of truth for metric definitions.** CTR is computed with two different denominators in different routes (`email_metrics.sent_count` vs "recipients who saw module"). Issue click rate switches data sources based on an `excludeIps` UI toggle, hiding two definitions behind one label.
- **No metrics glossary.** Nothing documents what each KPI means, its formula, its data lineage, or its freshness guarantees.
- **Inconsistent bot/IP filtering.** The policy exists in `src/lib/bot-detection/` but is only applied at display time in one route; other routes inherit vendor-rolled numbers with opaque filtering.
- **Multiple `CLAUDE.md`-rule violations in analytics routes** — `SELECT *`, hardcoded `PUBLICATION_ID`, ISO-timestamp date logic in at least three routes.
- **No anomaly detection on product metrics.** System latency has drift alerts via `src/lib/monitoring/metrics-recorder.ts`; product metrics do not.
- **No freshness indication.** ESP-imported metrics can be hours stale with no UI signal.

## 2. Goals

1. Establish a governance artifact — a metrics glossary — so every KPI has exactly one definition.
2. Introduce a typed metrics library with pure formulas and a DAL that prevents drift from re-appearing.
3. Fix the audit-identified bugs as part of the cutover.
4. Apply bot/IP filter policy consistently across all analytics queries via one filter function.
5. Surface data freshness in the UI.
6. Add anomaly detection for product metrics, delivered via Slack + an in-app alerts tab.

Out of scope for this spec (deferred to a future "evaluate PostHog vs Metabase" spec): hand-rolled funnels, cohorts, multi-touch attribution, A/B test analysis framework.

## 3. Architectural Decisions

### 3.1 Module layout (split by concern)

```
src/lib/
├── analytics/
│   ├── metrics.ts          # Pure formulas. No DB imports.
│   ├── types.ts            # MetricRow, IssueMetrics, ModuleMetrics, DeliveryCounts
│   ├── bot-policy.ts       # isClickCountable() — single source of truth for "does this click count?"
│   └── index.ts            # Barrel export
├── dal/
│   └── analytics.ts        # DB reads. Explicit columns. publication_id filtered.
└── monitoring/
    ├── metrics-recorder.ts # (existing) system-level metrics
    └── anomaly-alerts.ts   # NEW. Product-metric drift detection.
```

**Rules enforced by this layout:**
- API routes never touch `link_clicks` / `email_metrics` directly — they call DAL.
- DAL never does math — returns typed rows for formulas.
- Formulas are pure functions — no Supabase imports, trivially unit-testable.
- `excludeBots` defaults to `true` at the DAL layer; explicit `false` required for raw-data views.

### 3.2 Canonical metric definitions

Two distinct CTR metrics, both named:

- **Issue CTR** = `unique_clickers_in_issue / delivered_count`. Denominator = `email_metrics.delivered_count` (excludes bounces, aligns with ESP conventions).
- **Module CTR** = `unique_clickers_in_module / module_recipients`. Denominator varies when a module is segmented. Distinct from Issue CTR and always labeled as "Module CTR" in the UI.

**Unique clicker rule:** one row per `(subscriber_id, link, issue_id)`. No time window — issue is the natural boundary.

**Open rate** — sourced from `email_metrics` (we don't run our own open pixel). `issue_open_rate` only; no module-level opens.

**Response rates (polls, feedback)** — unique respondents / `delivered_count`.

**Bounce rate** — `email_metrics.bounced_count / email_metrics.sent_count`.

**Unsubscribe rate** — `email_metrics.unsubscribed_count / email_metrics.delivered_count`.

**`moduleRecipients` resolution:** for Module CTR, defaults to the issue's `delivered_count` for non-segmented modules. For segmented modules (ads/AI apps targeted at a subset), comes from the per-issue module-assignment table. Exact column/table confirmed at implementation time against current schema.

### 3.3 Data source rules

- **Clicks** — read from `link_clicks` (own event table). Enables consistent dedup + bot filter.
- **Opens, delivered, bounces, unsubscribes** — read from `email_metrics` (ESP numbers). Vendor bot-filter applied; documented quirk.
- `email_metrics.click_rate` becomes a secondary "ESP-reported" read-only display, useful for deliverability debugging. It is **not** the headline Issue CTR.

### 3.4 Bot / IP filter policy

Single function `isClickCountable(row, excludedIps)` in `src/lib/analytics/bot-policy.ts`. A click is countable unless:
- `row.is_bot_ua === true`, or
- `row.ip_address` is in `excluded_ips` (exact match), or
- `row.ip_address` matches any CIDR in `excluded_ips`.

SQL-level filtering where possible (`is_bot_ua = false AND ip_address NOT IN (...)`); CIDR check applied in app code.

**No historical backfill.** New clicks get flagged at ingest going forward; historical rows retain their original flags. Prior lesson: overly aggressive backfill caught legitimate power users.

### 3.5 Freshness

Single additive migration:

```sql
ALTER TABLE email_metrics ADD COLUMN last_synced_at TIMESTAMPTZ;
CREATE INDEX idx_email_metrics_last_synced ON email_metrics(last_synced_at);
```

Populated by `emailMetricsService` on every sync write. (No `sync_source` column — SendGrid is never used in practice; if it ever is, that PR can add the column.)

UI component `<FreshnessBadge lastSyncedAt={...} />` renders "as of 12m ago" with tooltip. Mounted on every analytics panel that reads email-derived numbers. Stale threshold read from `app_settings.email_metrics_stale_threshold_hours` (default `12`).

### 3.6 Anomaly alerts (Track 5e)

**Schema:**

```sql
CREATE TABLE metric_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id),
  metric_name TEXT NOT NULL,
  issue_id UUID REFERENCES issues(id),
  observed_value NUMERIC NOT NULL,
  baseline_mean NUMERIC NOT NULL,
  baseline_stddev NUMERIC NOT NULL,
  deviation_sigmas NUMERIC NOT NULL,
  direction TEXT CHECK (direction IN ('drop', 'spike')),
  severity TEXT CHECK (severity IN ('warning', 'critical')),
  slack_sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_metric_alerts_pub_created ON metric_alerts(publication_id, created_at DESC);
CREATE INDEX idx_metric_alerts_unack ON metric_alerts(publication_id) WHERE acknowledged_at IS NULL;
```

**Detection flow** (`/api/cron/detect-metric-anomalies`, hourly):
1. For each active publication, for each tracked metric, load last 7 days of values from DAL.
2. Compute mean + stddev of days 1–6. Compare today.
3. `|today − mean| > 2σ` → insert `metric_alerts` row. `> 3σ` → severity `critical`.
4. If severity ≥ `warning` AND no identical unacknowledged alert exists → post Slack, stamp `slack_sent_at`.

**Tracked metrics (Phase 1):** `issue_ctr`, `issue_open_rate`, `poll_response_rate`, `feedback_response_rate`, `bounce_rate`, `unsubscribe_rate`.

**Slack gate:** `app_settings.anomaly_alerts_slack_enabled` (default `false`). Flip via settings after one observation cycle; no PR needed.

**Dashboard:** new "Alerts" tab in `/dashboard/[slug]/analytics` lists unacknowledged alerts with ACK button. Retention 90 days, matching `system_metrics`.

### 3.7 Historical numbers policy

When a formula changes (notably Issue CTR denominator shift to `delivered_count`), historical dashboard values move. This is accepted — documented in CHANGELOG and glossary. The alternative (freezing historical numbers behind a "metric as of vX" dimension) is heavyweight and re-introduces the multiple-definition problem we are fixing.

## 4. Bug-fix inventory

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `src/app/api/analytics/[campaign]/route.ts:14` | `select('*')` on `email_metrics` | Explicit columns matching `DeliveryCounts` |
| 2 | `src/app/api/link-tracking/analytics/route.ts:78` | `select('*')` on `link_clicks` | Explicit columns; read moves into `dal.getUniqueClickers` |
| 3 | `src/app/api/tools/analytics/route.ts:36-38` | `select('*')` + hardcoded `PUBLICATION_ID` + ISO-timestamp date logic | Explicit columns, resolve publication from slug, local-date strings |
| 4 | `src/app/api/ads/analytics/route.ts` + `ai-apps/analytics/route.ts` | Module CTR denominator hidden inside one-off math | Adopt `computeModuleCTR`; label metric as **Module CTR** in UI |
| 5 | `src/app/dashboard/[slug]/analytics/components/issues-tab/useIssuesAnalytics.ts:46-59` | Click rate reads from `email_metrics.click_rate` or `link_clicks` depending on `excludeIps` toggle | Always compute from `link_clicks` via DAL. `excludeIps` toggle now controls bot-policy flag, not data source. `email_metrics.click_rate` displayed separately as "ESP-reported". |

Bugs 4 and 5 land via shadow-read (Section 5, PR 4–5) because numbers visibly change.

## 5. Rollout — six PRs

| PR | Contents | Risk |
|----|----------|------|
| **1. Glossary + foundation library** | `docs/operations/metrics.md` + `src/lib/analytics/*` + `src/lib/dal/analytics.ts` + unit/integration tests. No consumers. | Low |
| **2. Freshness** | Migration adding `email_metrics.last_synced_at` + sync-writer update + `<FreshnessBadge>` component mounted on all analytics panels. | Low |
| **3. Direct-cutover fixes + bot-policy consolidation** | Bug #1, #2, #3. Three routes rewritten to use DAL. Duplicate display-layer filter code in `link-tracking/analytics` deleted. Numbers should not visibly change. | Medium |
| **4. Shadow-read introduction** | Bug #4, #5 routes compute both old and new, return old, log delta. No user-visible change. | Low |
| **5. Cutover flip** (small PR after 7-day observation) | Remove shadow-read, return new numbers. Update glossary with change notice. | Medium |
| **6. Anomaly alerts (Track 5e)** | Migration for `metric_alerts` + detection cron + Slack integration + Alerts tab. Slack gated by `app_settings.anomaly_alerts_slack_enabled` flag. | Medium |

All DB migrations are additive; rollback is PR revert.

## 6. Testing strategy

- **Unit tests** for every `compute*` formula: zero denominator, zero numerator, rounding, type guards.
- **Integration tests** (seeded Supabase fixture, no mocks — per prior feedback): every DAL function, including bot/IP filter behavior.
- **Shadow-read audit script** `scripts/audit-shadow-read-deltas.mjs`: aggregates PR-4 logs into max-delta, distribution, outlier list. Run before PR 5 cutover.
- **Anomaly alerts**: unit tests for baseline σ math + severity classification; integration test that seeds 7 issues of metrics and verifies alert inserts.
- **Existing verification gates**: `npm run build`, `npm run type-check`, `npm run test:run`, `npm run check:bug-patterns`, plus `/simplify` + `/review:pre-push` per `CLAUDE.md` Section 5.

Not doing: E2E browser tests (no existing harness), DAL performance benchmarks (measure in prod, optimize if needed).

## 7. Glossary document

Location: `docs/operations/metrics.md`. Structure per metric:

```
## <Metric name>
- Formula: <numerator> / <denominator>
- Numerator source: <table, column, filter rules>
- Denominator source: <table, column>
- Uniqueness rule: <what counts as unique>
- Time boundary: <issue / day / 7d-window>
- Compute with: <TS function name>
- Known quirks: <vendor differences, filtering gaps>
- Owner: <person>
```

Covered metrics: Issue CTR, Module CTR, Issue Open Rate, Poll Response Rate, Poll Option Share, Feedback Response Rate, Ad CTR, AI App CTR, Tools Directory CTR, Delivered Count, Bounce Rate, Unsubscribe Rate.

Plus three cross-cutting sections:
- **Bot & IP filter policy** — what `isClickCountable` rejects and why.
- **Data lineage** — table mapping each metric to upstream table(s) and sync job.
- **Freshness** — how to read `email_metrics.last_synced_at`, stale threshold per dashboard.

Governance rule: any PR adding a dashboard metric must also add its glossary entry; enforced in review.

## 8. Explicit non-goals

- Funnels (send → open → click → conversion aggregation).
- Cohort analysis (retention by signup cohort).
- Multi-touch attribution modeling.
- A/B test analysis framework.
- Bot filtering on ESP-reported opens (would require own open-pixel beacon).
- ML-based anomaly detection (rolling σ is sufficient).
- Per-publication configurable anomaly thresholds (hardcoded defaults for Phase 1).

A future spec evaluates PostHog (self-hosted) vs Metabase (on Postgres) for the deferred items rather than hand-rolling.
