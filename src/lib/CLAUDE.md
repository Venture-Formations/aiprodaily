# Core Library (src/lib)

## Before Modifying Any File Here

Check `docs/architecture/DEPENDENCY_MAP.md` for downstream impact. Files in `src/lib/` are shared across crons, API routes, dashboard, and public pages. Run `/impact-check {file}` for quick analysis.

## Key Conventions

### Database Access
- **Prefer the DAL** (`src/lib/dal/*`) over direct `supabaseAdmin` calls. New code should import from a DAL module; existing direct calls migrate as files are touched.
- When writing direct queries, always use `supabaseAdmin` — never the anon client
- Every query must filter by `publication_id`
- Explicit column lists in `.select()` — never `select('*')`
- For lists that can exceed 1000 rows, use `fetchAllPaginated` from `@/lib/dal/paginate` (Supabase's default `.select()` silently truncates at 1000)

### Data Access Layer (`src/lib/dal/`)
| Module | Domain | Tables |
|--------|--------|--------|
| `dal/issues.ts` | Issue lifecycle | `publication_issues` |
| `dal/posts.ts` | RSS post lifecycle | `rss_posts`, `post_ratings` |
| `dal/articles.ts` | Article rows per issue | `module_articles`, `manual_articles` |
| `dal/dedup.ts` | Duplicate detection results | `duplicate_groups`, `duplicate_posts` |
| `dal/paginate.ts` | Generic paginated reads | (helper, not table-bound) |
| `dal/analytics.ts` | Analytics aggregates | (existing) |

DAL conventions: exported functions (no classes); reads return `T | null` or `T[]`; writes return `boolean`; errors are logged via pino and swallowed (callers don't need try/catch). Mirror `dal/issues.ts` when adding a new module.

**Module-type domains stay at `src/lib/*-modules/`** (`article-modules/`, `prompt-modules/`, `ai-app-modules/`, `ad-modules/`, `poll-modules/`, `text-box-modules/`, `feedback-modules/`, `sparkloop-rec-modules/`). Each selector class already follows the DAL pattern (DB access centralized, structured methods). Do NOT migrate them to `dal/`; keep new module-type code there too.

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
