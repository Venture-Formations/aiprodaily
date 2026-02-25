# Cron Jobs & Workflow Scheduling

_Last updated: 2025-12-17_

## When to use this
- You are adding/modifying scheduled jobs (Vercel cron or Workflows)
- You need to understand why an automation did not run
- You are evaluating the runtime budget before deploying heavier tasks

Related references:
- @docs/workflows/rss-processing.md — Workflow steps launched by the cron trigger
- @docs/architecture/system-overview.md — High-level platform flow
- `vercel.json` — Source of truth for cron routes and maxDuration overrides

## Cron Inventory

### Active Crons (Implemented)
| Path | Schedule | Purpose | Notes |
|------|----------|---------|-------|
| `/api/cron/trigger-workflow` | `*/5 * * * *` | Launches RSS workflow if schedule permits | Verifies `publication_settings` toggles, avoids duplicate runs. 60s timeout. |
| `/api/cron/ingest-rss` | `*/15 * * * *` | Fetches new posts, scores, keeps pool warm | 300s timeout; must stay within limit. |
| `/api/cron/create-campaign` | `*/5 * * * *` | Creates issue if schedule permits | 600s timeout. **Schedule:** Set `issueCreationTime` *after* `rssProcessingTime` so the issue exists (workflow creates it at rss time). |
| `/api/cron/send-review` | `*/5 * * * *` | Sends review issue email via MailerLite | Requires issue status `ready_to_send`. 600s timeout. |
| `/api/cron/send-final` | `*/5 * * * *` | Sends final issue when window matches | Performs Stage 2 unassignment post-send. 600s timeout. |
| `/api/cron/send-secondary` | `*/5 * * * *` | Sends secondary newsletter | For publications with secondary content. 600s timeout. |
| `/api/cron/monitor-workflows` | `*/5 * * * *` | Detects failed/stuck workflows | Slack alerts when steps exceed thresholds. |
| `/api/cron/process-mailerlite-updates` | `*/5 * * * *` | Processes MailerLite webhook updates | 120s timeout. |
| `/api/cron/cleanup-pending-submissions` | `0 7 * * *` | Clears stale ad submissions | Daily at 7 AM. Keeps Stripe sessions tidy. 600s timeout. |
| `/api/cron/import-metrics` | `0 6 * * *` | Syncs MailerLite metrics | Daily at 6 AM; ensure API limits considered. 600s timeout. |
| `/api/cron/health-check` | `*/5 8-22 * * *` | Pings core services during business hours | Alerts on downtime. 600s timeout. |

### Registered but NOT Implemented (Will 404)
These crons are registered in `vercel.json` but the route folders are empty:

| Path | Schedule | Purpose | Action Required |
|------|----------|---------|-----------------|
| `/api/cron/populate-events` | `*/5 * * * *` | Populates events for issues | Create `route.ts` or remove from vercel.json |
| `/api/cron/sync-events` | `0 0 * * *` | Syncs event data from external feeds | Create `route.ts` or remove from vercel.json |
| `/api/cron/generate-weather` | `0 20 * * *` | Generates daily weather module | Create `route.ts` or remove from vercel.json |
| `/api/cron/collect-wordle` | `0 19 * * *` | Collects Wordle stats | Create `route.ts` or remove from vercel.json |

### Additional Cron-related Endpoints (not scheduled but callable)
| Path | Purpose |
|------|---------|
| `/api/cron/rss-processing` | Manual RSS processing trigger |
| `/api/cron/process-rss` | Direct RSS process trigger |
| `/api/cron/generate-subject` | Manual subject line generation |
| `/api/cron/send-newsletter` | Manual newsletter send |
| `/api/cron/trigger-phase2` | Phase 2 workflow trigger |
| `/api/cron/workflow-coordinator` | Workflow coordination |
| `/api/cron/process-breaking-news` | Breaking news processing |
| `/api/cron/process-sendgrid-updates` | SendGrid webhook processing |

## Secrets & Authentication
- Cron endpoints expect `Authorization: Bearer ${CRON_SECRET}` header (or `?secret=` query for GET). Keep `CRON_SECRET` rotated via Vercel environment settings.
- Manual testing from local machine should include the same header/query.

## Timeout & Performance Considerations
- Default Vercel serverless timeout is 600 seconds; cron entries set `maxDuration` per route in `vercel.json`.
- Workflow steps can run up to 800s (`/api/workflows/*` routes).
- Batch expensive operations (AI calls, database writes) with `await sleep(2000)` where necessary.
- Ensure logs per invocation stay under 10MB; consolidate to high-value events (e.g., `[CRON] Started`, `[CRON] Complete: X`).

## Failure Recovery
1. Check Vercel Function logs for the cron path.
2. Verify `trigger-workflow` last run and `issues.status` values.
3. Inspect `monitor-workflows` alerts (Slack) for stuck step numbers.
4. Re-run manually by hitting the endpoint with the secret.
5. If repeated failures, consider disabling the cron temporarily via Vercel dashboard.

## Adding a New Cron
1. Implement the API route under `src/app/api/cron/<name>/route.ts` with auth + structured logging.
2. Add entry to `vercel.json` with schedule and `maxDuration`.
3. Document the job here with schedule, purpose, dependencies.
4. Update `claude.md` if job is essential to core workflows.

Maintaining this index ensures Claude quickly identifies which automation to inspect or edit when troubleshooting or extending the platform.
