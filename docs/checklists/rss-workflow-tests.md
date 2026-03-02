# RSS Workflow Tests (Scoped to Changed Files)

When you change files that are part of the RSS workflow (ingestion, orchestration, or any step), run the tests that cover those areas. This document defines **which tests to run** based on **which files changed** in a commit or PR.

See also: [rss-processing.md](../workflows/rss-processing.md), [bug-pattern-checks.md](bug-pattern-checks.md).

## When tests run

- **Pre-commit:** run `npm run test:rss-workflow` (uses staged files).
- **PR/CI:** run `npm run test:rss-workflow:pr` (uses files changed vs `origin/master`).
- Only **RSS/workflow-related** changes trigger tests; other changes skip the script (exit 0).

## Path groups → test files

If **any** changed file matches a path pattern below, the corresponding test files are run.

| Path pattern (changed file) | Tests to run | Rationale |
|-----------------------------|--------------|-----------|
| `src/lib/workflows/process-rss-workflow.ts` | All workflow tests | Orchestrator: setup, dedupe, generate, finalize |
| `src/app/api/cron/trigger-workflow/**` | All workflow tests | Triggers workflow |
| `src/app/api/cron/ingest-rss/**` | rss-processor-refusal, deduplicator, feed-ingestion (if any) | Ingestion + scoring |
| `src/app/api/workflows/process-rss/**` | All workflow tests | Workflow API entry |
| `src/lib/rss-processor/**` | rss-processor-refusal, deduplicator | RSSProcessor, dedupe, assign, generate |
| `src/lib/dal/issues.ts`, `src/lib/dal/` | issues.test.ts | Issue CRUD used by workflow |
| `src/lib/deduplicator*` | deduplicator.test.ts | Dedupe step |
| `src/lib/settings/**` (schedule) | schedule-checker, schedule-settings | When to run workflow |
| `src/lib/article-modules/**` | All workflow tests | Article module selection/generation |
| `src/lib/ad-modules/**`, `src/lib/ad-scheduler*` | All workflow tests | Ad selection in finalize |
| `src/lib/prompt-modules/**` | All workflow tests | Prompt selection in setup |
| `src/lib/ai-app-modules/**` | app-selector (or all) | AI app selection in setup |
| `src/lib/openai/**` (prompt-loaders, ai-call) | rss-processor-refusal (generation/fact-check) | AI calls for titles, bodies, fact-check |
| `src/types/issue-states*` | issue-states.test.ts | Status transitions |
| `src/app/api/rss/**` (process, steps, combined-steps) | All workflow tests | RSS process API surface |

**“All workflow tests”** = the full set: rss-processor-refusal, deduplicator, issues, schedule-checker, schedule-settings, issue-states, app-selector, api-handler (so any change to the pipeline runs the full suite).

## Test files (current)

| Test file | Covers |
|-----------|--------|
| `src/lib/__tests__/rss-processor-refusal.test.ts` | RSSProcessor.detectAIRefusal (used in generation) |
| `src/lib/__tests__/deduplicator.test.ts` | Deduplicator (hash, similarity, config) |
| `src/lib/dal/__tests__/issues.test.ts` | getIssueById, getIssueByDate, createIssue, updateStatus, etc. |
| `src/lib/__tests__/schedule-checker.test.ts` | Schedule / “should run” logic |
| `src/lib/settings/__tests__/schedule-settings.test.ts` | Schedule settings validation |
| `src/types/__tests__/issue-states.test.ts` | Issue status state machine |
| `src/lib/__tests__/app-selector.test.ts` | AI app selection (legacy app-selector; module selector may have its own tests later) |
| `src/lib/__tests__/api-handler.test.ts` | withApiHandler (used by workflow routes) |

## Adding tests for a step

- **New unit test file:** add it under `src/**/__tests__/**/*.test.ts` and add it to the appropriate path group in `scripts/run-rss-workflow-tests.mjs` (and to the table above).
- **New step in workflow:** add the step’s implementation path to the script’s path→tests map; if it’s core pipeline, include it in “all workflow tests”.

## Implementation

- **Script:** `scripts/run-rss-workflow-tests.mjs` — computes changed files (staged or `origin/master...HEAD`), finds which path groups match, runs `vitest run <test files>` for those groups (deduplicated), exits 0 if no RSS-related changes or tests pass, 1 if tests fail.
- **CI:** optional step that runs `npm run test:rss-workflow:pr` after checkout so only PRs that touch RSS/workflow run these tests.

## Usage

```bash
# Staged files (pre-commit)
npm run test:rss-workflow

# PR: files changed vs origin/master
npm run test:rss-workflow:pr

# Explicit base
node scripts/run-rss-workflow-tests.mjs --base origin/master
```

If no changed file matches any path group, the script exits 0 without running tests.
