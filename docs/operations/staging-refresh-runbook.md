# Staging Database Refresh Runbook

## Overview

The staging refresh script (`npm run refresh-staging`) copies production data into the staging Supabase project with a clean, validated schema. It runs 7 phases automatically:

1. **Pre-flight** — validates env vars, connectivity, direction safety
2. **Schema prep** — drops all staging tables, runs migrations for canonical schema
3. **Data transfer** — `pg_dump --data-only` from prod, `psql` restore to staging
4. **Post-restore migrations** — re-runs migrations to catch seed data/defaults
5. **Integrity validation** — checks FK counts, PKs, orphans, row counts
6. **PII scrubbing** — anonymizes emails, names, IPs
7. **Cleanup** — deletes dump file, prints summary

## Prerequisites

- **PostgreSQL client tools** (`pg_dump`, `psql`) installed and on PATH
  - Windows: Install from https://www.postgresql.org/download/windows/
  - The script auto-detects common install paths on Windows
- **Environment variables** set:
  - `PROD_DATABASE_URL` — production Supabase connection string
  - `STAGING_DATABASE_URL` — staging Supabase connection string
- Connection strings must contain the correct project IDs:
  - Production: `vsbdfrqfokoltgjyiivq`
  - Staging: `cbnecpswmjonbdatxzwv`

## Running

```bash
# Set env vars (or use .env.staging)
export PROD_DATABASE_URL="postgresql://postgres.vsbdfrqfokoltgjyiivq:PASSWORD@..."
export STAGING_DATABASE_URL="postgresql://postgres.cbnecpswmjonbdatxzwv:PASSWORD@..."

npm run refresh-staging
```

The script will prompt for confirmation before making any changes.

## What Gets Scrubbed

| Table | Fields | Method |
|-------|--------|--------|
| `afteroffers_click_mappings` | email | md5 hash + @example.com |
| `afteroffers_events` | email | md5 hash + @example.com |
| `subscriber_real_click_status` | subscriber_email | md5 hash + @example.com |
| `link_clicks` | ip_address | Last octet zeroed |
| `contact_submissions` | email, name | md5 hash |
| `feedback_comments` | author_email, author_name | md5 hash |
| `ai_applications` | submitted_by_email, submitted_by_name | md5 hash |
| `advertisers` | contact_email, contact_name | md5 hash |

All email hashes use `@example.com` domain (RFC 2606 — reserved, undeliverable).

## Troubleshooting

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
- Connection strings are never logged — only parsed hostnames are shown
- Direction is triple-validated: hostnames differ, staging URL contains staging ID, prod URL contains prod ID
- All subscriber/user PII is anonymized before staging is usable

## Verification Checklist

After a successful refresh:

- [ ] Integrity report shows all checks passing
- [ ] Staging dashboard loads without 500 errors
- [ ] Settings > Sections shows all modules (ad, ai_app, article, prompt)
- [ ] No production emails visible in staging database
- [ ] Dump file does not exist on disk
