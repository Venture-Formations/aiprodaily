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
