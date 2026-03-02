---
created: 2026-03-02T19:21:35Z
last_updated: 2026-03-02T19:21:35Z
version: 1.0
author: Claude Code PM System
---

# Project Style Guide

## TypeScript
- Strict mode enabled
- No unused variables or imports
- Async/await for all promises (no raw `.then()` chains)
- Explicit return types on exported functions

## Naming Conventions
- **Files:** kebab-case for source files (`app-selector.ts`, `rss-processor.ts`)
- **Components:** PascalCase (`AIAppModulesPanel.tsx`)
- **Functions/variables:** camelCase
- **Constants:** UPPER_SNAKE_CASE for true constants, camelCase for config objects
- **Database columns:** snake_case (matches PostgreSQL convention)
- **API routes:** kebab-case paths (`/api/cron/send-final`)

## File Organization
- React Server Components by default; `"use client"` only when interactive state is needed
- One component per file for major components
- Shared logic in `src/lib/`; UI in `src/components/`
- API routes use `route.ts` convention (Next.js App Router)

## Database Queries
- Always filter by `publication_id` (multi-tenant isolation)
- Explicit column lists -- never `select('*')`
- Use DAL functions from `src/lib/dal/` for common queries
- Batch updates where possible

## Logging
- One-line summaries with prefixes: `[Workflow]`, `[RSS]`, `[AI]`, `[DB]`, `[CRON]`
- No `console.log` in loops or batch operations
- Stay under 10MB per Vercel function invocation
- Never log secrets or PII

## Error Handling
- Wrap long-running tasks with retry loops (max 2 retries, 2s delay)
- `try/catch` with graceful degradation
- Surface failures via `console.error`; let upstream handlers escalate

## Comments
- Only for complex logic, trade-offs, or non-obvious constraints
- No narration comments ("increment counter", "return result")

## Date/Time
- Use local date strings: `date.split('T')[0]`
- Never use `.toISOString()` or `.toUTCString()` for comparison logic

## Git
- Branch naming: `feature/`, `fix/`, `chore/` prefixes
- Commit before push: `npm run build` must pass
- CI enforces lint warnings ceiling (`--max-warnings 360`)
