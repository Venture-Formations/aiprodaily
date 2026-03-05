# Staging Environment Implementation Plan

**Purpose:** Full staging environment with dedicated Supabase project and Vercel project, providing complete data isolation from production with controllable cron jobs for end-to-end testing.

**Status:** Implemented
**Completed:** 2026-03-05
**Last updated:** 2026-03-05
**Related:** [env-guard.ts](../../src/lib/env-guard.ts), [publication-settings.ts](../../src/lib/publication-settings.ts), [api-handler.ts](../../src/lib/api-handler.ts), [cron-jobs.md](./cron-jobs.md)

---

## 1. Architecture

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  Vercel: aiprodaily     │     │  Vercel: aiprodaily-    │
│  (production project)   │     │  staging (staging proj) │
│                         │     │                         │
│  Deploys: master branch │     │  Deploys: staging       │
│  Crons: ON (always)     │     │  branch (Production)    │
│  Domain: aiprodaily.com │     │  Crons: CRON_ENABLED=   │
│                         │     │  false (kill switch)    │
│                         │     │  Domain: aiprodaily-    │
│                         │     │  staging.vercel.app     │
└──────────┬──────────────┘     └──────────┬──────────────┘
           │                               │
           ▼                               ▼
┌─────────────────────┐         ┌─────────────────────────┐
│  Supabase:          │         │  Supabase:              │
│  vsbdfrqfokoltgjyiivq│        │  cbnecpswmjonbdatxzwv   │
│  (production)       │         │  (staging)              │
│  Full production    │         │  Full replica of        │
│  data               │         │  production data        │
└─────────────────────┘         └─────────────────────────┘
```

---

## 2. Git Workflow

```
feature/my-change → staging (test on staging) → master (deploy to production)
```

1. Create feature branch from `staging`
2. Push feature branch — staging project builds preview deployment
3. Merge to `staging` — staging project builds **production** deployment (crons available)
4. Test on staging
5. When satisfied, merge `staging` to `master` — production deploys

---

## 3. Key Environment Variables (Staging Project)

| Variable | Value | Purpose |
|----------|-------|---------|
| `STAGING` | `true` | Identifies this as a staging deployment |
| `CRON_ENABLED` | `false` | Global cron kill switch — Vercel-scheduled crons return `{ skipped: true }` |
| `ALLOW_AUTH_BYPASS` | `true` | Enables auto-login without Google OAuth |
| `SUPABASE_URL` | Staging Supabase URL | Points to staging database |
| `NEXT_PUBLIC_SUPABASE_URL` | Staging Supabase URL | Client-side Supabase access |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service role key | Server-side Supabase access |
| `SUPABASE_ANON_KEY` | Staging anon key | Client-side Supabase access |
| `DATABASE_URL` | Staging connection string | Direct DB access |
| `MAILERLITE_REVIEW_GROUP_ID_OVERRIDE` | Test group ID | Fail-closed send guard |
| `MAILERLITE_MAIN_GROUP_ID_OVERRIDE` | Test group ID | Fail-closed send guard |
| `CRON_SECRET` | Unique staging value | Different from production |
| `NEXTAUTH_URL` | `https://aiprodaily-staging.vercel.app` | Auth callback URL |

Full env var template: `.env.staging.template` in project root.

---

## 4. Code Changes (Phase E)

### E1: `src/lib/env-guard.ts`
- `isStaging()` — checks `STAGING=true`
- `shouldApplySendGuards()` — returns true for non-production OR staging
- `isCronEnabled()` — returns false when `CRON_ENABLED=false`
- `shouldSkipScheduleCheck()` — updated to allow bypass on staging

### E2: `src/lib/api-handler.ts`
- Centralized cron kill switch in `withApiHandler()` for `authTier: 'system'` routes
- Vercel-scheduled crons return `{ skipped: true, reason: 'CRON_ENABLED=false' }` when disabled
- Manual triggers (Bearer token / secret param) **bypass** the kill switch

### E3: `src/lib/publication-settings.ts`
- `getEmailSettings()` and `getEmailProviderSettings()` use `shouldApplySendGuards()`
- MailerLite overrides apply on staging (not just preview/dev)

### E4: `src/lib/auth.ts` + `src/lib/auth-bypass.ts`
- `staging-bypass` CredentialsProvider added when `ALLOW_AUTH_BYPASS=true`
- Sign-in page auto-detects the provider at runtime and auto-logs in
- Auth bypass blocked on real production (`VERCEL_ENV=production` without `STAGING=true`)

---

## 5. Scripts (Phase D)

### Migration Script
```bash
# Apply all db/migrations/*.sql to staging
npm run migrate:staging

# Apply to production (requires CONFIRM=prod)
CONFIRM=prod npm run migrate:prod
```
File: `scripts/run-migrations.mjs`

### Data Refresh Script
```bash
# Dump production → restore to staging
# Requires PROD_DATABASE_URL and STAGING_DATABASE_URL
npm run refresh-staging
```
File: `scripts/refresh-staging.mjs` (Node.js — works on Windows)

---

## 6. Cron Behavior

| Scenario | Behavior |
|----------|----------|
| Vercel cron fires (staging, `CRON_ENABLED=false`) | Returns `{ skipped: true, reason: 'CRON_ENABLED=false' }` with 200 |
| Manual trigger with Bearer token (staging) | Executes normally — kill switch bypassed |
| Vercel cron fires (production, no `CRON_ENABLED` set) | Executes normally — defaults to enabled |
| Set `CRON_ENABLED=true` on staging | All crons execute on schedule |

### Testing a specific cron on staging
```powershell
Invoke-WebRequest -Uri "https://aiprodaily-staging.vercel.app/api/cron/health-check" -Headers @{"Authorization"="Bearer YOUR_STAGING_CRON_SECRET"} -UseBasicParsing
```

---

## 7. Vercel Project Configuration

- **Production Branch:** Set via Settings > Environments > Production > Branch Tracking = `staging`
- **Domain:** `aiprodaily-staging.vercel.app` assigned to Production environment
- **Ignored Build Step:** Not needed (branch tracking handles it)

---

## 8. Verification Checklist

- [x] **Production Vercel project** unchanged — uses production Supabase, crons run on schedule
- [x] **Staging Vercel project** uses staging Supabase — data isolation confirmed
- [x] **MailerLite guards** work on staging via `shouldApplySendGuards()`
- [x] **Cron kill switch** works: Vercel crons return `{ skipped: true }`
- [x] **Manual cron trigger** works: Bearer token bypasses kill switch
- [x] **Data refresh** works: `npm run refresh-staging` produces matching data (2 publications)
- [x] **Migrations** applied: 136 migrations to staging DB
- [x] **Auto-login** works: staging-bypass provider, no Google OAuth needed
- [ ] **Storage buckets** on staging (`img`, `newsletter-images`)
- [ ] **Local dev** `.env.local` pointing to staging DB documented

---

## 9. Rollback

1. Delete or pause the staging Vercel project. Production is unaffected.
2. Staging Supabase project can be paused or deleted.
3. Code changes are no-ops in production (no `STAGING` or `CRON_ENABLED` vars set).

---

## 10. Future Considerations

- **Automated refresh schedule:** GitHub Action or cron to refresh staging data weekly
- **Sanitized dumps:** Replace PII with fake data if external developers are onboarded
- **Hotfix workflow:** Merge directly to `master`, cherry-pick back to `staging`
- **Storage bucket sync:** Create matching buckets on staging for image upload testing
- **CI migration automation:** On merge to `master`, auto-apply migrations to staging
