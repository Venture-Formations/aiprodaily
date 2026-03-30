# Core Library (src/lib)

## Before Modifying Any File Here

Check `docs/architecture/DEPENDENCY_MAP.md` for downstream impact. Files in `src/lib/` are shared across crons, API routes, dashboard, and public pages. Run `/impact-check {file}` for quick analysis.

## Key Conventions

### Database Access
- Always use `supabaseAdmin` — never the anon client
- Every query must filter by `publication_id`
- Explicit column lists in `.select()` — never `select('*')`

### Settings Access
Two-tier fallback: publication-specific first, then app-wide:
```typescript
import { getPublicationSetting } from '@/lib/publication-settings'
const value = await getPublicationSetting(publicationId, 'key_name')
// Checks publication_settings first, falls back to app_settings
```

### Exports
- Export classes, functions, and types explicitly
- Use barrel exports (`index.ts`) for module directories
- Keep exports stable — renaming breaks many consumers

### Error Handling
- Use structured logging via `createLogger` or injected `logger`
- Retry pattern: max 2 retries, 2s delay for external calls
- Validate AI output with `detectAIRefusal()` before storing

### Module Pattern
Selector modules follow a consistent pattern:
```
src/lib/{module-name}/
  index.ts        — Main selector class
  types.ts        — TypeScript types (optional)
```

Selectors implement: `selectForIssue()`, `recordUsage()` methods.

## High-Impact Files

These have 10+ dependents — change with extra care:
- `supabase.ts` — DB client (293 dependents)
- `api-handler.ts` — Route wrapper (275 dependents)
- `publication-settings.ts` — Settings access (44 dependents)
- `openai.ts` — AI calls (14 dependents)
- `slack.ts` — Notifications (15 dependents)

See Section 5 of the dependency map for the full list.
