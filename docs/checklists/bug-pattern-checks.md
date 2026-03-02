# Bug-Pattern Checks (Scoped to Changed Files)

This document describes automated checks derived from [bugs-and-fixes-from-git-history.md](../bugs-and-fixes-from-git-history.md). Checks run **only on files that changed** in the commit or PR, so only applicable rules are enforced.

## Goals

- Prevent recurrence of known bug classes (multi-tenant leaks, wrong date logic, unsafe selects, etc.).
- Run **before commit** (optional pre-commit) or **as part of PR CI**.
- **Scope**: Only run checks that apply to the changed paths (e.g. don't run DB checks if only CSS changed).

## Bug Categories → Testable Checks

| Bug category | Check id | What we detect | Applies to paths |
|--------------|----------|----------------|------------------|
| **Column selection** | `select-star` | `.select('*')` in Supabase queries | `src/**/*.{ts,tsx}`, `scripts/**/*.ts` |
| **Multi-tenant isolation** | `publication-id` | Query on tenant table without `publication_id` in file | `src/app/api/**`, `src/lib/**` (excl. debug) |
| **Date logic** | `date-iso` | `.toISOString().split('T')[0]`, `.toISOString().substring(0,10)`, `.toUTCString()` | `src/app/api/**`, `src/lib/**`, `scripts/**` |
| **Unsafe URL / blob** | `blob-url` | Unvalidated `blob:` or `URL.createObjectURL` in image `src` | (manual review) |
| **Auth bypass** | (manual / review) | Broad `ALLOW_AUTH_BYPASS` or missing cron auth | Documented in review checklist |

### Check Details

- **select-star**: Detects `.select('*')` calls. Also enforced by ESLint `no-restricted-syntax` rule.
- **publication-id**: File-level heuristic — if the file queries a known tenant-scoped table (see TENANT_TABLES in script) and the file does not contain `publication_id` or `publicationId`, flag it. Debug routes under `api/debug/` are excluded.
- **date-iso** (refined): Only flags **dangerous patterns** that extract a date string from UTC:
  - `.toISOString().split('T')[0]` — extracts date part from UTC, loses timezone
  - `.toISOString().substring(0, 10)` / `.slice(0, 10)` — same issue
  - `.toUTCString()` — always suspicious in business logic
  - **Not flagged**: Plain `.toISOString()` for DB timestamps, `.gte()` filters, object literal values — these are legitimate uses.
- **blob-url**: Kept as manual review item (hard to automate reliably).

## Inline Suppression

To suppress a check on a specific line, add a comment with the check id:

```ts
const ts = new Date().toISOString().split('T')[0] // bug-check-ignore: date-iso
const { data } = await supabase.from('issues').select('*') // bug-check-ignore: select-star
```

The suppression comment format is `// bug-check-ignore: <check-id>` where `<check-id>` is one of: `select-star`, `publication-id`, `date-iso`.

## Path → Check Mapping

Only run a check when at least one changed file matches the check's path pattern:

| Path pattern | Checks to run |
|--------------|----------------|
| `src/app/api/**/*.{ts,tsx}` (excl. `**/debug/**`) | select-star, publication-id, date-iso |
| `src/app/api/debug/**` | select-star only (publication_id optional in debug) |
| `src/lib/**/*.ts` | select-star, publication-id, date-iso |
| `src/app/**/cron/**` | select-star, publication-id, date-iso |
| `src/components/**`, `src/app/**/*.tsx` | select-star |
| `scripts/**/*.ts` | select-star, date-iso |
| `db/migrations/**` | (none automated; review publication_id in migrations) |
| Other (e.g. docs, config) | (none) |

## How to Run

### Pre-commit (optional)

Run only for **staged** files:

```bash
npm run check:bug-patterns
```

### PR / CI

Run only for **files changed in the PR** (vs `origin/master`):

```bash
npm run check:bug-patterns:pr
```

### Full repo (auditing)

```bash
npm run check:bug-patterns:all
```

Runs applicable checks on all files matching path patterns (no diff). Use for auditing — may report existing violations. PR and pre-commit flows only check **changed** files so existing code is not blocked.

## Tenant Tables

The `publication-id` check knows about these tenant-scoped tables (queries must include `publication_id`):

`publication_issues`, `issue_articles`, `issue_advertisements`, `publication_settings`, `rss_feeds`, `rss_posts`, `module_articles`, `ai_applications`, `advertisements`, `newsletter_sections`, `article_modules`, `issue_article_modules`, `issue_ai_app_selections`, `issue_module_ads`, `issue_prompt_modules`, `issue_ai_app_modules`, `issue_ad_modules`, `issue_poll_modules`, `ad_modules`, `poll_modules`, `prompt_modules`, `post_ratings`, `publication_events`, `issue_events`, `secondary_articles`, `tools`

To add a new table, update the `TENANT_TABLES` array in `scripts/check-bug-patterns.mjs`.

## Implementation

- **Script**: `scripts/check-bug-patterns.mjs` — computes changed files, determines which checks apply, runs them, exits 1 on failure.
- **Tests**: `scripts/__tests__/check-bug-patterns.test.ts` — Vitest unit tests for all check functions.
- **ESLint**: Existing `no-restricted-syntax` for `.select('*')`. CI already runs `npm run lint`.
- **CI**: Step runs `npm run check:bug-patterns:pr` (i.e. `--base origin/master`) so only files changed in the PR are checked.
- **Pre-commit**: Run `npm run check:bug-patterns` before commit (uses staged files by default).

## Adding a New Check

1. Add the check id and path pattern to this doc and to the script's config.
2. Implement the detector in `scripts/check-bug-patterns.mjs`.
3. Add unit tests in `scripts/__tests__/check-bug-patterns.test.ts`.
4. Keep checks fast (no heavy parsing if grep is enough) so pre-commit stays quick.

## References

- [bugs-and-fixes-from-git-history.md](../bugs-and-fixes-from-git-history.md) — source of bug categories
- [backend.md](../patterns/backend.md) — column selection, publication_id, date conventions
- [CLAUDE.md](../../CLAUDE.md) — Critical Rules (multi-tenant, no select('*'), date comparisons)
