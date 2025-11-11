# Cron Jobs & Workflow Scheduling

_Last updated: 2025-11-11_

## When to use this
- You are adding/modifying scheduled jobs (Vercel cron or Workflows)
- You need to understand why an automation did not run
- You are evaluating the runtime budget before deploying heavier tasks

Related references:
- @docs/workflows/rss-processing.md — Workflow steps launched by the cron trigger
- @docs/architecture/system-overview.md — High-level platform flow
- `vercel.json` — Source of truth for cron routes and maxDuration overrides

## Cron Inventory

| Path | Schedule | Purpose | Notes |
|------|----------|---------|-------|
| `/api/cron/trigger-workflow` | `*/5 * * * *` | Launches RSS workflow if schedule permits | Verifies `app_settings` toggles, avoids duplicate runs. |
| `/api/cron/ingest-rss` | `*/15 * * * *` | Fetches new posts, scores, keeps pool warm | 300s timeout; must stay within limit. |
| `/api/cron/send-review` | `*/5 * * * *` | Sends review campaign email via MailerLite | Requires campaign status `ready_to_send`. |
| `/api/cron/send-final` | `*/5 * * * *` | Sends final campaign when window matches | Performs Stage 2 unassignment post-send. |
| `/api/cron/monitor-workflows` | `*/5 * * * *` | Detects failed/stuck workflows | Slack alerts when steps exceed thresholds. |
| `/api/cron/create-campaign` | `*/5 * * * *` | Legacy creation path; preserved for backwards compatibility | Transitioning to workflow-based creation. |
| `/api/cron/cleanup-pending-submissions` | `0 7 * * *` | Clears stale ad submissions | Keeps Stripe sessions tidy. |
| `/api/cron/import-metrics` | `0 6 * * *` | Syncs MailerLite metrics | Daily run; ensure API limits considered. |
| `/api/cron/health-check` | `*/5 8-22 * * *` | Pings core services during business hours | Alerts on downtime. |
| `/api/cron/generate-weather` | `0 20 * * *` | Generates daily weather module (legacy) | Optional; disable if unused. |
| `/api/cron/collect-wordle` | `0 19 * * *` | Collects Wordle stats (legacy) | Safe to remove if not part of publication. |
| `/api/cron/sync-events` | `0 0 * * *` | Syncs event data from external feeds | Used by admin events dashboard. |

## Secrets & Authentication
- Cron endpoints expect `Authorization: Bearer ${CRON_SECRET}` header (or `?secret=` query for GET). Keep `CRON_SECRET` rotated via Vercel environment settings.
- Manual testing from local machine should include the same header/query.

## Timeout & Performance Considerations
- Default Vercel serverless timeout is 600 seconds; cron entries set `maxDuration` per route in `vercel.json`.
- Batch expensive operations (AI calls, database writes) with `await sleep(2000)` where necessary.
- Ensure logs per invocation stay under 10MB; consolidate to high-value events (e.g., `[CRON] Started`, `[CRON] Complete: X`).

## Failure Recovery
1. Check Vercel Function logs for the cron path.
2. Verify `trigger-workflow` last run and `newsletter_campaigns.status` values.
3. Inspect `monitor-workflows` alerts (Slack) for stuck step numbers.
4. Re-run manually by hitting the endpoint with the secret.
5. If repeated failures, consider disabling the cron temporarily via Vercel dashboard.

## Adding a New Cron
1. Implement the API route under `src/app/api/cron/<name>/route.ts` with auth + structured logging.
2. Add entry to `vercel.json` with schedule and `maxDuration`.
3. Document the job here with schedule, purpose, dependencies.
4. Update `claude-optimized.md` (Doc Map) if job is essential to core workflows.

Maintaining this index ensures Claude quickly identifies which automation to inspect or edit when troubleshooting or extending the platform.
