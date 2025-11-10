# Project Structure Guide

## Top-Level Directories
- `src/` – Next.js application (App Router), API routes, workflows, shared libraries
- `docs/` – Product, workflow, and migration documentation grouped by topic (`guides/`, `workflows/`, `migrations/`, `status/`, `checklists/`, `reference/`)
- `db/migrations/` – Canonical SQL migrations and database utilities
- `scripts/` – Operational utilities (`maintenance/`, `tests/`, `tools/`)
- `apps/marketing/` – Standalone marketing site (Next.js) pending consolidation
- `agent-os/`, `txt_files/`, `sql_files/` – Supporting operational resources and historical data

## Operational Hotspots
- **Workflows**: `src/lib/workflows/` (RSS, campaign creation, reprocessing)
- **Cron Entrypoints**: `src/app/api/cron/*`
- **Debug Tools**: `src/app/api/debug/*` (long tail slated for consolidation)
  - Route groups: `(campaign)`, `(checks)`, `(maintenance)`, `(ai)`, `(rss)`, `(integrations)`, `(media)`, `(tests)`
- **Configuration**: `next.config.js`, `tailwind.config.ts`, `.env.local`

## Migration/Troubleshooting Quick Links
- Run SQL: `psql -f db/migrations/<file>.sql` or execute via Supabase SQL editor
- Maintenance scripts: `node scripts/maintenance/<script>.js`
- Manual tests: `node scripts/tests/<script>.js` or `bash scripts/tests/<script>.sh`

