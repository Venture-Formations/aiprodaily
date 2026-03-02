---
created: 2026-03-02T19:21:35Z
last_updated: 2026-03-02T19:21:35Z
version: 1.0
author: Claude Code PM System
---

# Project Structure

## Root Layout
```
aiprodaily/
  src/             # Application source
  db/migrations/   # SQL migration files (89+)
  docs/            # Architecture, workflows, guides
  scripts/         # Provisioning and migration scripts
  public/          # Static assets
  supabase/        # Supabase config
  .claude/         # Claude Code config (commands, agents, rules, skills, CCPM)
  .github/         # CI workflows
```

## Source Tree (`src/`)

### `src/app/` -- Next.js App Router
- `api/` -- API routes organized by domain (cron, campaigns, rss, debug, webhooks, etc.)
  - `api/cron/` -- Scheduled jobs (trigger-workflow, ingest-rss, send-review, send-final, etc.)
  - `api/debug/` -- Debug endpoints grouped by: (ai), (campaign), (checks), (integrations), (maintenance), (media), (rss), (tests)
  - `api/workflows/` -- Multi-step RSS processing workflow
- `dashboard/[slug]/` -- Admin dashboard, dynamic per publication
- `tools/` -- Public AI Tools Directory
- `account/` -- User account and advertiser portal
- `website/` -- Marketing site
- `auth/` -- Authentication pages
- `feedback/`, `poll/`, `ads/` -- Public-facing feature pages

### `src/lib/` -- Core Business Logic
- `rss-processor/` -- RSS ingestion and processing
- `workflows/` -- Multi-step workflow orchestration
- `openai.ts`, `openai/` -- AI integration (prompts, scoring)
- `app-selector.ts` -- AI app rotation logic
- `ad-scheduler.ts` -- Ad module scheduling
- `newsletter-templates/` -- Email template rendering
- `mailerlite/` -- MailerLite API client
- `dal/` -- Data Access Layer (issues, etc.)
- `directory.ts` -- AI Tools Directory logic
- `prompt-modules/`, `poll-modules/`, `ad-modules/`, etc. -- Module selectors
- `supabase.ts` -- Database client
- `auth.ts` -- Authentication helpers
- `config.ts` -- App configuration

### `src/components/` -- Shared React Components

### `src/types/` -- TypeScript type definitions

### `src/utils/` -- Utility functions

### `src/contexts/` -- React context providers

## File Naming Patterns
- API routes: `src/app/api/<domain>/route.ts`
- Page components: `src/app/<section>/page.tsx`
- Library modules: `src/lib/<feature>.ts` or `src/lib/<feature>/`
- Components: `src/components/<Name>.tsx`
- Migrations: `db/migrations/NNNN_description.sql`
