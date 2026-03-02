# Bug-Pattern Checks (Scoped to Changed Files)

This document describes automated checks derived from [bugs-and-fixes-from-git-history.md](../bugs-and-fixes-from-git-history.md). Checks run **only on files that changed** in the commit or PR, so only applicable rules are enforced.

## Goals

- Prevent recurrence of known bug classes (multi-tenant leaks, wrong date logic, unsafe selects, etc.).
- Run **before commit** (optional pre-commit) or **as part of PR CI**.
- **Scope**: Only run checks that apply to the changed paths (e.g. don’t run DB checks if only CSS changed).

## Bug Categories → Testable Checks

| Bug category | Check id | What we detect | Applies to paths |
|--------------|----------|----------------|------------------|
| **Column selection** | `select-star` | `.select('*')` in Supabase queries | `src/**/*.{ts,tsx}`, `scripts/**/*.ts` |
| **Multi-tenant isolation** | `publication-id` | Query on tenant table without `publication_id` in file | `src/app/api/**`, `src/lib/**` (excl. debug) |
| **Date logic** | `date-iso` | `toISOString()` / `toUTCString()` used for business logic | `src/app/api/**`, `src/lib/**`, `src/app/cron/**` |
| **Unsafe URL / blob** | `blob-url` | Unvalidated `blob:` or `URL.createObjectURL` in image `src` | `src/**/*.{ts,tsx}` |
| **Auth bypass** | (manual / review) | Broad `ALLOW_AUTH_BYPASS` or missing cron auth | Documented in review checklist |

- **select-star**: Enforced by ESLint rule `no-restricted-syntax` (see `.eslintrc.json`). Running `lint` on changed files only covers this.
- **publication-id**: Script heuristic — if file queries a known tenant-scoped table (e.g. `publication_issues`, `issue_articles`, `publication_settings`) and the file does not contain `publication_id` (or `publicationId`), flag it. Debug routes under `api/debug/` are excluded.
- **date-iso**: Script grep — in backend/cron code, flag use of `toISOString()` or `toUTCString()` (suggest `date.split('T')[0]` or local date strings). Allowlist comments or test files if needed.
- **blob-url**: Script or ESLint — ensure image preview URLs only allow `blob:` (or validated origin). Optional; can be left to code review if hard to automate.

## Path → Check Mapping

Only run a check when at least one changed file matches the check’s path pattern:

| Path pattern | Checks to run |
|--------------|----------------|
| `src/app/api/**/*.{ts,tsx}` (excl. `**/debug/**`) | select-star, publication-id, date-iso |
| `src/app/api/debug/**` | select-star only (publication_id optional in debug) |
| `src/lib/**/*.ts` | select-star, publication-id, date-iso |
| `src/app/**/cron/**` | select-star, publication-id, date-iso |
| `src/components/**`, `src/app/**/*.tsx` | select-star, blob-url (if we add it) |
| `scripts/**/*.ts` | select-star, date-iso (if script does date logic) |
| `db/migrations/**` | (none automated; review publication_id in migrations) |
| Other (e.g. docs, config) | (none) |

## How to Run

### Pre-commit (optional)

Run only for **staged** files:

```bash
# Staged files
git diff --name-only --cached
npm run check:bug-patterns
```

Script reads `git diff --name-only --cached` by default when not in CI.

### PR / CI

Run only for **files changed in the PR** (vs `origin/master`):

```bash
git diff --name-only origin/master...HEAD
npm run check:bug-patterns -- --base origin/master
```

In CI, use the same `--base` so only touched files are checked.

### Full repo (e.g. nightly)

```bash
npm run check:bug-patterns -- --all
```

Runs applicable checks on all files matching path patterns (no diff). **Note:** `--all` may report many existing violations; use for auditing. PR and pre-commit flows only check **changed** files so existing code is not blocked.

## Implementation

- **Script**: `scripts/check-bug-patterns.mjs` — computes changed files, determines which checks apply, runs them, exits 1 on failure.
- **ESLint**: Existing `no-restricted-syntax` for `.select('*')`. CI already runs `npm run lint`; for “lint only changed files” use `lint-staged` or `eslint --max-warnings N <files>` with the diff list.
- **CI**: Step runs `npm run check:bug-patterns:pr` (i.e. `--base origin/master`) so only files changed in the PR are checked. Merge base can be `github.event.pull_request.base.sha` for PRs if you need exact base.
- **Pre-commit**: Run `npm run check:bug-patterns` before commit (uses staged files by default). Optionally add `lint-staged` to run ESLint only on staged files.

## Adding a New Check

1. Add the check id and path pattern to this doc and to the script’s config.
2. Implement the detector (grep or AST) in `scripts/check-bug-patterns.mjs`.
3. Keep checks fast (no heavy parsing if grep is enough) so pre-commit stays quick.

## References

- [bugs-and-fixes-from-git-history.md](../bugs-and-fixes-from-git-history.md) — source of bug categories
- [backend.md](../patterns/backend.md) — column selection, publication_id, date conventions
- [CLAUDE.md](../../CLAUDE.md) — Critical Rules (multi-tenant, no select('*'), date comparisons)
