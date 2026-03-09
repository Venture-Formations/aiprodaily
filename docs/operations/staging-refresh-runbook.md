# Staging Database Refresh Runbook

## Overview

The staging refresh script copies production data into the staging Supabase project with a clean, validated schema. It runs 7 phases automatically:

1. **Pre-flight** — validates env vars, connectivity, direction safety
2. **Schema prep** — drops all staging tables, runs migrations for canonical schema
3. **Data transfer** — `pg_dump --data-only` from prod, `psql` restore to staging
4. **Post-restore migrations** — re-runs migrations to catch seed data/defaults
5. **Integrity validation** — checks FK counts, PKs, orphans, row counts
6. **PII scrubbing** — anonymizes emails, names, IPs
7. **Cleanup** — deletes dump file, prints summary

## Two Modes

| Mode | Command | What it copies | Typical size |
|------|---------|---------------|--------------|
| **Quick** (default) | `npm run refresh-staging` | Config, content, issues — skips 21 bulk analytics tables | ~10% of full |
| **Full** | `npm run refresh-staging:full` | Everything | 100% |

**Use Quick mode** for most refreshes (settings changes, schema updates, feature testing).
**Use Full mode** only when you need analytics data in staging.

### Tables skipped in Quick mode

These high-volume tables are excluded (empty tables with correct schema are still created by migrations):

`link_clicks`, `feedback_responses`, `feedback_votes`, `feedback_comments`, `feedback_comment_read_status`, `poll_responses`, `excluded_ips`, `subscriber_real_click_status`, `sparkloop_events`, `sparkloop_daily_snapshots`, `sparkloop_referrals`, `sparkloop_module_clicks`, `sparkloop_offer_events`, `afteroffers_events`, `afteroffers_click_mappings`, `tool_directory_clicks`, `mailerlite_field_updates`, `sendgrid_field_updates`, `article_performance`, `contact_submissions`, `ai_prompt_tests`

## Prerequisites

- **PostgreSQL client tools** (`pg_dump`, `psql`) installed and on PATH
  - Windows: Install from https://www.postgresql.org/download/windows/
  - The script auto-detects common install paths on Windows
- **Environment variables** set:
  - `PROD_DATABASE_URL` — production Supabase **direct** connection string (not pooler)
  - `STAGING_DATABASE_URL` — staging Supabase **direct** connection string
- Connection strings must use the **direct** format: `postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres`
- Connection strings must contain the correct project IDs (see `.env` files or Supabase dashboard)

## Running

```powershell
# Set env vars (PowerShell) — replace YOUR_*_PROJECT_ID with actual Supabase project IDs
$env:PROD_DATABASE_URL="postgresql://postgres:PASSWORD@db.YOUR_PROD_PROJECT_ID.supabase.co:5432/postgres"
$env:STAGING_DATABASE_URL="postgresql://postgres:PASSWORD@db.YOUR_STAGING_PROJECT_ID.supabase.co:5432/postgres"

# Quick refresh (default — skips bulk analytics)
npm run refresh-staging

# Full refresh (copies everything)
npm run refresh-staging:full
```

The script will prompt for confirmation before making any changes.

## What Gets Scrubbed

| Table | Fields | Method |
|-------|--------|--------|
| `afteroffers_click_mappings` | email | md5 hash + @example.com |
| `afteroffers_events` | email | md5 hash + @example.com |
| `subscriber_real_click_status` | subscriber_email | md5 hash + @example.com |
| `link_clicks` | ip_address | Last two octets zeroed |
| `contact_submissions` | email, name | md5 hash |
| `feedback_comments` | author_email, author_name | md5 hash |
| `ai_applications` | submitted_by_email, submitted_by_name | md5 hash |
| `advertisers` | contact_email, contact_name | md5 hash |

All email hashes use `@example.com` domain (RFC 2606 — reserved, undeliverable).
In Quick mode, most scrub targets are skipped tables anyway — scrubbing still runs but affects fewer rows.

## Troubleshooting

### "Tenant or user not found" connection error
You're using the **pooler** URL. Switch to the **direct** connection string from Supabase dashboard: Settings > Database > Connection string > Direct tab.

### Script fails at Phase 1
No changes made. Fix env vars and retry.

### Script fails at Phase 2 (schema drop)
Staging DB may be empty. Re-run from scratch — the script is idempotent.

### Script fails at Phase 3 (data load)
Partial data may exist. Re-run from scratch.

### Script fails at Phase 4 (post-restore migrations)
Run manually: `npm run migrate:staging`

### Validation shows failures at Phase 5
Review the report. Most checks are advisory — only the stale `newsletters` table check is blocking (and auto-fixed).

### PII scrubbing partially fails at Phase 6
Run the scrub queries manually. See `scripts/lib/staging-scrubber.mjs` for the SQL.

### Dump file not deleted at Phase 7
Delete manually from the temp directory shown in the error message.

## Security Notes

- The dump file is created in the OS temp directory and deleted in a `finally` block
- Connection strings are never logged — only parsed hostnames and project IDs are shown
- Direction is triple-validated: URLs differ, staging URL contains staging ID, prod URL contains prod ID
- All subscriber/user PII is anonymized before staging is usable

## Verification Checklist

After a successful refresh:

- [ ] Integrity report shows all checks passing
- [ ] Staging dashboard loads without 500 errors
- [ ] Settings > Sections shows all modules (ad, ai_app, article, prompt)
- [ ] No production emails visible in staging database
- [ ] Dump file does not exist on disk
