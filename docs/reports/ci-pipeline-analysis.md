# CI/CD Pipeline & Codebase Efficiency Report

**Date:** March 2, 2026
**Branch analyzed:** `master` (commit `00f21be8`)
**Prepared for:** Development team review

---

## Executive Summary

Our CI pipeline takes ~10 minutes per pull request. After a comprehensive analysis of the pipeline configuration, codebase architecture, route structure, module coupling, and test coverage, we identified three categories of improvement:

1. **Quick CI config wins** (~25 min of work, saves 2-3 min per PR)
2. **Structural cleanup** (1-2 sprints, saves additional 1-2 min and reduces complexity)
3. **Testing & architecture improvements** (ongoing, transforms PR validation from "does it compile" to actual quality assurance)

The more important finding: our PR pipeline currently validates TypeScript compilation, ESLint, 159 unit tests, and build success — but the entire revenue path (email rendering, ad rotation, campaign delivery, AI content generation) has **zero automated test coverage**. Speed improvements matter, but what the pipeline actually catches matters more.

---

## 1. Current CI Pipeline Breakdown

**File:** `.github/workflows/ci.yml`
**Trigger:** PRs to `master` + pushes to `master`
**Runner:** `ubuntu-latest` (2 cores, 7GB RAM)
**Timeout:** 15 minutes

| Step | Estimated Duration | Notes |
|------|-------------------|-------|
| Checkout + Node setup | ~20s | `actions/setup-node@v4` with `cache: npm` |
| `npm ci` | 60-90s | ~1,200 packages, npm tarball cache only |
| `tsc --noEmit` | ~21s (measured) | 1,168 files (790 source + 378 `.next/types`) |
| `npm run lint` | 30-50s | ESLint with max 360 warnings |
| `npm run test:run` | 5-15s | 9 test files, 159 cases |
| `npm run build` | 2.5-4 min | 461 routes, includes `withWorkflow()` overhead |
| GHA platform overhead | ~1-2 min | Runner queue, cache restore/save, post-job cleanup |
| **Total** | **~7-10 min** | |

> **Note:** Individual step estimates sum to ~5-8 minutes of execution. The remaining ~1-2 minutes is GitHub Actions platform overhead (runner spin-up, queue time, cache operations, post-job cleanup) which cannot be optimized from our side.

---

## 2. Findings

### 2.1 CI Configuration Issues

**No Next.js build cache.** The `.next/cache` directory is not persisted between CI runs. Every PR does a cold build — webpack recompiles all 461 routes from scratch. Next.js has built-in incremental compilation that we're not leveraging.

**All steps run sequentially.** Type-check, lint, and tests run one after another before the build. These are independent and could run concurrently, saving ~60-90s of wall-clock time.

**`withWorkflow()` adds overhead to every build.** The Vercel Workflows wrapper in `next.config.js` scans all routes and runs esbuild bundling at build time. Per a prior analysis, this adds an estimated ~18 seconds. This processing is only needed on Vercel deployments, not CI validation. It can be conditionally skipped when `process.env.VERCEL` is not set.

**Redundant type checking.** `tsc --noEmit` runs as a standalone step, then `next build` runs its own type checking internally (since `typescript.ignoreBuildErrors` is not set). However, `tsc` does catch errors in 12 standalone scripts in `scripts/` and 3-4 orphaned files that `next build` would miss — so removing it requires cleanup first.

### 2.2 Route Architecture (397 API Routes)

Our API surface is significantly larger than typical for a project this size:

| Category | Routes | % of Total | Assessment |
|----------|--------|------------|------------|
| `debug/` | 150 | 38% | Developer tools compiled every build |
| `campaigns/[id]/` sub-routes | 28 | 7% | Some consolidation possible |
| `settings/` | 18 | 5% | Several under 40 lines |
| `cron/` | 17 | 4% | Necessary |
| `tools/` | 16 | 4% | 5 thin admin wrappers |
| `ads/` | 14 | 4% | Action routes could merge |
| All other | 154 | 39% | Mixed |

**Key issues:**

- **150 debug routes** are compiled into every build. Only one (`test-ai-prompts`) is called by production code (the "Test Prompt" button in `AIPromptsSettings.tsx`). Zero are used by cron jobs, workflows, or health checks.
- **5 `tools/admin/` routes** (`approve`, `reject`, `delete`, `toggle-featured`, `update`) each wrap a single server action with `withApiHandler` auth. These could be consolidated into 1 route with an `action` parameter while preserving the admin auth enforcement.
- **5 `backfill/` routes** are one-time migration scripts still being compiled.
- **3 `test/` routes** exist outside of `debug/` (`test/database`, `test/all-sections`, `test-welcome`) and appear to be orphaned.
- **3 `dining/` routes** appear unrelated to the newsletter platform.

**Realistic build time impact:** Removing debug routes would save an estimated 15-25% of build time (not proportional to route count due to shared webpack chunks).

### 2.3 Module Coupling

**The Supabase singleton is imported by 250+ files across the project.** `src/lib/supabase.ts` eagerly instantiates two Supabase clients at module load time. Every `src/lib/` module that touches the database imports it directly — there are no interfaces, no dependency injection, and no repository pattern (with one exception: `src/lib/dal/issues.ts`).

**Transitive import chain:** The barrel export `src/lib/openai/index.ts` re-exports from all sub-modules (`core`, `legacy`, `prompt-loaders`, `clients`, `ai-call`, `web-search`). Importing any AI function (e.g., `AI_CALL`) from `@/lib/openai` transitively loads:

- `supabaseAdmin` (via `core.ts` for prompt loading)
- OpenAI SDK + Anthropic SDK (via `clients.ts`)
- 1,528 lines of fallback prompt templates (via `prompt-loaders.ts`)
- 465 lines of legacy duplicated code (via `legacy.ts`)

Importing directly from sub-modules (e.g., `@/lib/openai/ai-call`) would allow webpack to tree-shake the rest, but the current codebase uses the barrel import.

**Practical effect:** You cannot test business logic without mocking global module singletons. This is the root cause of low test coverage.

**`openai/legacy.ts` contains duplicated parsing logic.** The same ~60-70 line response parsing pattern (response extraction, code fence stripping, regex JSON matching, parse fallback) is repeated 3 times across `callOpenAIStructured`, `callOpenAI`, and `callAI`. `core.ts` has a clean `parseJSONResponse()` helper that does this once.

**Component layer is well-structured.** Zero components in `src/components/` directly import infrastructure modules. They communicate via `fetch()` to API routes. This boundary is correct.

### 2.4 Test Coverage

**9 test files covering 790+ source files (7.2% of modules).**

| Tested Module | What It Validates |
|--------------|-------------------|
| `api-handler` | Auth tiers, input validation, error handling |
| `app-selector` | Affiliate cooldown, category counting (3 static methods only) |
| `deduplicator` | Content hashing, title normalization, Jaccard similarity |
| `ip-utils` | IPv4/IPv6 validation, CIDR parsing, range matching |
| `rss-processor-refusal` | AI refusal pattern detection (1 method) |
| `schedule-checker` | Time parsing, CT conversion, disabled-schedule guards |
| `bot-detection/ua-detector` | Bot user-agent pattern matching |
| `dal/issues` | CRUD operations, `publication_id` filtering, CAS transitions |
| `issue-states` (types) | Status constants, valid/invalid transitions |

**Untested revenue-critical paths (0% coverage):**

| Module | Lines | Risk |
|--------|-------|------|
| `newsletter-templates/` (6 files) | 2,230 | Broken email → every subscriber affected |
| `mailerlite/mailerlite-service.ts` | 1,102 | Double-send or failed delivery |
| `workflows/process-rss-workflow.ts` | 571 | Skipped steps → incomplete newsletter |
| `openai/core.ts` | 499 | Wrong prompt/model → garbage content |
| `rss-processor/article-selector.ts` | 494 | Wrong articles featured |
| `ad-scheduler.ts` | 247 | Wrong ad rotation → lost revenue |
| `rss-processor/scoring.ts` | 216 | Bad scoring weights |

**No coverage enforcement.** `@vitest/coverage-v8` is installed as a dev dependency but not configured in `vitest.config.ts` and not run in CI. There is no minimum coverage gate. Tests could be deleted and CI would still pass.

**No E2E, integration, or API route tests.** Zero of the 397 API routes have any test coverage. Zero React components are tested. No Playwright, Cypress, or testing-library packages are installed.

### 2.5 Other Build Overhead

- **6 components exceed 1,000 lines** (all client-side, all bundled):
  - `src/components/settings/AIPromptsSettings.tsx`: 1,993
  - `src/components/ad-modules/SectionsPanel.tsx`: 1,745
  - `src/components/settings/EmailSettings.tsx`: 1,711
  - `src/components/article-modules/ArticleModulePromptsTab.tsx`: 1,685
  - `src/components/text-box-modules/TextBoxModuleSettings.tsx`: 1,165
  - `src/components/feedback-modules/FeedbackModuleSettings.tsx`: 1,071
- **Heavy libraries imported eagerly** (`recharts`, `@dnd-kit`, `react-image-crop`) — only `react-quill-new` uses `next/dynamic`.
- **Orphaned files still compiled:** `road-work-scraper.ts`, `wordle-scraper.ts`, `vrbo-image-processor.ts`, `debug-auth.ts` — dead code that `tsc` still checks.
- **Stale references:** `NewsletterSettings.tsx` calls a deleted debug route. `openai/core.ts` logs a URL to a deleted debug route.

---

## 3. Recommendations

### Phase 1: CI Config Quick Wins (This Week)

**Estimated effort: 1-2 hours. Estimated savings: 2-3 min per PR.**

| # | Action | Expected Savings | Risk |
|---|--------|-----------------|------|
| 1 | **Add `.next/cache` caching in CI.** Use `actions/cache@v4` keyed on `package-lock.json` + source file hashes. This is the [Next.js recommended CI pattern](https://nextjs.org/docs/pages/building-your-application/deploying/ci-build-caching). | 30-60s | Very low |
| 2 | **Conditionally skip `withWorkflow()` in CI.** In `next.config.js`, check `process.env.VERCEL` — Vercel sets this automatically, GitHub Actions does not. Skip the wrapper when not on Vercel. | ~18s (estimated) | Low — workflow directives are valid JS without the transform; only Vercel runtime needs the generated bundles |
| 3 | **Run lint + typecheck + test concurrently.** Replace the 3 sequential steps with a single concurrent step. | 60-90s | Low |

**Suggested CI changes:**

Add Next.js build cache (before the Build step):

```yaml
- name: Cache Next.js build
  uses: actions/cache@v4
  with:
    path: .next/cache
    key: nextjs-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-${{ hashFiles('**/*.ts', '**/*.tsx') }}
    restore-keys: |
      nextjs-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-
      nextjs-${{ runner.os }}-
```

Replace the 3 sequential check steps with one concurrent step:

```yaml
- name: Lint, typecheck & test
  run: npx concurrently --kill-others-on-fail "npx tsc --noEmit" "npm run lint -- --max-warnings 360" "npm run test:run"
```

> **Important:** Do not use bare `&` + `wait` for concurrency. In bash, `wait` with no arguments returns the exit code of the *last* background process to finish, not all of them. If `tsc` fails but finishes before `lint`, and `lint` succeeds and finishes last, `wait` returns 0 and CI passes despite the type-check failure. The `concurrently` package (with `--kill-others-on-fail`) handles this correctly — it labels output per process and fails immediately if any process fails.

Conditionally apply `withWorkflow()` in `next.config.js`:

```javascript
const isVercel = !!process.env.VERCEL
module.exports = isVercel ? withWorkflow(nextConfig) : nextConfig
```

### Phase 2: Code Cleanup (Next 1-2 Sprints)

**Estimated effort: 2-3 days. Reduces complexity and build surface.**

| # | Action | Impact |
|---|--------|--------|
| 1 | **Delete dead code:** `backfill/` routes (5), orphaned `test/` routes (3), `dining/` routes (3 if unused), orphaned lib files (`road-work-scraper.ts`, `wordle-scraper.ts`, `vrbo-image-processor.ts`, `debug-auth.ts`). | -11 routes, cleaner codebase |
| 2 | **Relocate `test-ai-prompts` debug route** to `/api/ai/test-prompt/` (which already exists). Update `AIPromptsSettings.tsx` to use the new endpoint. Clean up stale references in `NewsletterSettings.tsx` and `openai/core.ts`. | Unblocks debug route exclusion |
| 3 | **Consolidate `tools/admin/` routes.** Merge `approve`, `reject`, `delete`, `toggle-featured`, `update` into a single `POST /api/tools/admin` with an `action` field. Preserve `withApiHandler({ authTier: 'admin' })` auth enforcement. | -4 routes |
| 4 | **Consolidate `openai/legacy.ts`.** Extract the duplicated response parsing into a shared `parseAIResponse()` utility. Consider whether the 3 legacy functions (`callOpenAI`, `callOpenAIStructured`, `callAI`) can be deprecated in favor of `core.ts` functions. | -200+ lines of duplication |
| 5 | **Move prompt fallback templates out of code.** `openai/prompt-loaders.ts` (1,528 lines) is almost entirely string templates. Move to JSON data files or a database seed script. Removes 1,528 lines from the import graph of every AI-calling module. | Faster compilation |

### Phase 3: Test Coverage (Next 1-2 Months)

**Estimated effort: 2-4 weeks. Transforms PR validation from "compiles" to "works."**

| Priority | Module | Test Type | Why | Est. Tests |
|----------|--------|-----------|-----|------------|
| **P0** | `newsletter-templates/` | Structural assertion tests (verify sections present, links valid, required data rendered) | A one-character change here breaks every subscriber's inbox | 25-30 |
| **P0** | `ad-scheduler.ts` | Unit tests with mocked DB | Wrong ad = lost advertiser revenue | 15-20 |
| **P0** | `mailerlite/mailerlite-service.ts` | Unit tests with mocked HTTP | Double-send is a reputation-destroying incident | 20-25 |
| **P1** | `openai/core.ts` | Unit tests with mocked APIs | Prompt loading fallback chain, multi-provider dispatch, JSON parsing | 20-25 |
| **P1** | `rss-processor/scoring.ts` | Unit tests | Scoring determines which articles appear | 15 |
| **P1** | `rss-processor/article-selector.ts` | Unit tests | Selection determines final newsletter content | 15 |
| **P2** | Cron routes (`send-final`, `trigger-workflow`) | Route-level integration | Actual entry points for automation | 20-30 |

> **Note on test type:** For newsletter templates, use structural assertion tests — not snapshots. Snapshot tests become brittle (any CSS or whitespace change breaks them) and teams tend to blindly accept snapshot updates. Structural tests that verify expected sections exist, links are valid, and required data is rendered are more maintainable and catch real bugs.

**Enable coverage enforcement.** Add to `vitest.config.ts`:

```typescript
test: {
  coverage: {
    provider: 'v8',
    include: ['src/lib/**/*.ts'],
    exclude: ['**/__tests__/**', '**/*.test.ts'],
    thresholds: {
      lines: 5,  // Start low, ratchet up as tests are added
    }
  }
}
```

Update CI to run `npm run test:coverage` instead of `npm run test:run`.

### Phase 4: Architecture (This Quarter)

**Estimated effort: ongoing. Unblocks sustainable test coverage.**

| # | Action | Why |
|---|--------|-----|
| 1 | **Extend the DAL pattern.** `src/lib/dal/issues.ts` is the only file with a proper data access layer. Extend to `dal/posts.ts`, `dal/articles.ts`, `dal/settings.ts`, `dal/modules.ts`. All Supabase queries go through the DAL; business logic imports the DAL, not `supabaseAdmin` directly. | Makes business logic testable without mocking global singletons |
| 2 | **Separate prompt storage from AI calling.** Split `openai/core.ts` into `prompt-repository.ts` (loads prompts from DB) and `ai-caller.ts` (calls APIs with pre-loaded prompts). Breaks the chain where importing any AI function transitively loads Supabase. | Decouples AI module from database |
| 3 | **Address the debug route footprint.** After Phase 2 cleanup, either (a) gate remaining debug routes behind `NODE_ENV === 'development'`, (b) consolidate into a catch-all `/api/debug/[...path]/route.ts`, or (c) move to a separate deployment. | -147 routes from production builds |
| 4 | **Dynamic imports for heavy client libraries.** Apply `next/dynamic` to `recharts`, `@dnd-kit`, and `react-image-crop` imports where they're used in dashboard pages. | Smaller client bundles, faster builds |

---

## 4. Expected Outcomes

| Metric | Current | After Phase 1 | After All Phases |
|--------|---------|---------------|-----------------|
| CI wall-clock time | ~10 min | ~7-8 min | ~6-7 min |
| API routes compiled | 397 | 397 | ~220-240 |
| Test files | 9 | 9 | 25-35 |
| Test cases | 159 | 159 | 300-350 |
| Revenue-path coverage | 0% | 0% | 60-80% (est.) |
| Coverage enforcement | None | None | Threshold-gated |

---

## 5. Key Files Reference

| File | Relevance |
|------|-----------|
| `.github/workflows/ci.yml` | CI pipeline configuration |
| `next.config.js` | Build configuration, `withWorkflow()` wrapper |
| `vitest.config.ts` | Test runner config (no coverage settings) |
| `tsconfig.json` | TypeScript config (`skipLibCheck: true`, `incremental: true`) |
| `src/lib/supabase.ts` | Singleton imported by 250+ files |
| `src/lib/openai/index.ts` | Barrel export that forces full module loading |
| `src/lib/openai/core.ts` | AI + DB coupling point (499 lines) |
| `src/lib/openai/legacy.ts` | Duplicated parsing logic (465 lines) |
| `src/lib/openai/prompt-loaders.ts` | String templates in import graph (1,528 lines) |
| `src/lib/dal/issues.ts` | Only proper DAL implementation (model to follow) |
| `src/components/settings/AIPromptsSettings.tsx` | Only production file calling a debug route |
| `docs/status/debug-routes-triage.md` | Prior triage (47 routes already deleted) |

---

## 6. Git History Bug Analysis

Analysis of 1,889 commits across the full repository history.

| Metric | Count | % of All Commits |
|--------|-------|-----------------|
| Total commits | 1,889 | 100% |
| Fix commits | 592 | 31% |
| Revert commits | 19 | 1% |

Nearly 1 in 3 commits is a fix — for roughly every 2 features shipped, 1 follow-up fix is needed.

### Bug Categories (Ranked by Frequency)

#### 1. Database Schema Mismatches (~20+ instances)

Code references columns, tables, or field names that don't exist or have been renamed. No type safety between the application layer and the database schema.

Representative commits:
- `remove non-existent created_at column from issue_prompt_modules`
- `wrong column name in fetchPromptSelections`
- `remove non-existent ai_provider column update`
- `Fix articles table column name (issue_id not campaign_id)`
- `Fix column name: final_sent_at (not final_send_at)`
- `Fix Real_Click field key`
- `Fix MailerLite field name case: SparkLoop -> sparkloop`

**Prevention:** Typed Supabase client generated from schema, or DAL tests that verify column existence.

#### 2. JSON Parsing / Data Format Bugs (~19 instances)

Data flows between Supabase (JSONB), the API layer, and the UI with inconsistent serialization — double-stringified values, quotes around numbers, JSON stored as strings inside JSON, AI responses in unpredictable formats.

Representative commits:
- `Fix JSON parsing: escape control characters inside string values`
- `Fix double-stringified JSON values in database cleanup`
- `Fix: strip JSON quotes from email settings in GET handler`
- `Fix AI semantic results parsing - handle raw JSON string response`
- `Fix restore AI prompts to handle JSONB values from app_settings`

**Prevention:** Zod schemas at API boundaries, tests for the AI response parsing pipeline.

#### 3. Supabase 1000-Row Limit / Pagination (~10 instances)

Supabase's default 1000-row query limit silently truncates results. This bug surfaces in every new feature that queries a growing table.

Representative commits:
- `Fix Supabase 1000-row limit by using pagination`
- `Fix IP exclusion list showing only 1000 rows, add pagination`
- `Fix module_articles pagination to retrieve all records beyond 1000 row limit`
- `Fix SparkLoop sync to paginate through all recommendations`
- `Fix click tracking with proper pagination and URL matching`

**Prevention:** A Supabase query wrapper that defaults to paginated fetching, or a lint rule flagging unpaginated `.select()` calls.

#### 4. Date/Time/Timezone Bugs (~5 actual bugs)

Inconsistent handling of time fields and midnight boundaries. Note: approximately half of the timezone-related commits in the git history are actually iterative feature work building out the UTC/CST toggle for data reconciliation (Facebook Ads reports in Central Time, SparkLoop in UTC). The toggle is the correct design — these are the actual bugs:

- `Fix review email not sending: use scheduledSendTime instead of issueCreationTime`
- `Fix issue date logic: always use tomorrow in Central Time`
- `Fix timezone bug in Issue Date display`
- `Fix newsletter card dates to show issue date instead of send date`
- `Fix timezone issue in feedback date display`

**Prevention:** A shared Central Time date utility (tested with midnight boundary cases) used across all features instead of per-feature reimplementation.

#### 5. SparkLoop Integration (~22 fix commits)

The single feature area with the most concentrated bugs. Paused detection alone went through 4 approaches with 3 reverts before stabilizing.

Key bug areas: pagination, budget UUID lookup, paused detection logic, subscribe flow, Gmail normalization, field name case sensitivity, chart data duplicates, count calculations.

**Prevention:** Integration contract tests mocking the SparkLoop API, unit tests for scoring/calculation logic.

#### 6. AI Response Handling (~29 fix commits)

AI responses in inconsistent formats (JSON in code fences, raw strings, double-stringified objects), compounded by duplicated parsing logic in `legacy.ts` (same bug needs fixing in 3 places).

**Prevention:** Consolidated `parseAIResponse` utility, tests with fixtures of real AI response variants.

#### 7. Hardcoded Values / Multi-Tenant Failures (~8 instances)

Single-tenant assumptions baked into code that surface during multi-tenant work. Publication-specific values hardcoded instead of queried from config.

**Prevention:** Lint rule or grep check for hardcoded publication slugs/IDs, multi-tenant integration tests.

### Duplicate Fix Commits (Same Bug Fixed Multiple Times)

| Bug | Occurrences |
|-----|-------------|
| SparkLoop chart pagination + timezone | 2 fix commits |
| SparkLoop New Pending count inflation | 2 fix commits |
| Remove `[TEST]` prefix from email subject | 2 fix commits |
| Fix test campaign name | 2 fix commits |
| Honeypot link redirect | 2 fix commits |
| SparkLoop paused detection | 4 approaches + 3 reverts |

Without tests, there's no regression protection — fixing a bug in one place doesn't prevent it from recurring.

### Root Causes

| Root Cause | Bug Types | Est. % of Fixes |
|------------|-----------|----------------|
| No type safety between app and database | Wrong columns, table mismatches, field renames | ~15% |
| No shared utilities for common patterns | Timezone, pagination, JSON parsing — reimplemented per feature | ~20% |
| No tests = no regression protection | Same bug fixed twice, reverts, fixes that don't stick | ~15% |
| Inconsistent data serialization | Double-stringified JSON, JSONB vs string, AI format variance | ~15% |
| Complex integrations without contracts | SparkLoop API, MailerLite fields, Stripe webhooks | ~10% |

The remaining ~25% are genuine feature bugs (logic errors, UI issues) that are harder to prevent systematically.

### What This Means for Testing Priorities

The git history validates the Phase 3 testing roadmap and adds specificity:

1. **Database schema validation** — either via generated Supabase types or DAL tests — would prevent the most recurring bug category.
2. **A pagination wrapper for Supabase queries** would eliminate the entire class of 1000-row truncation bugs.
3. **A shared Central Time date utility** (tested with midnight boundary cases) would prevent timezone bugs in new features.
4. **AI response parsing tests with real response fixtures** would prevent the 19+ JSON parsing fix commits.
5. **SparkLoop integration tests with mocked API responses** would have prevented ~15 of the 22 SparkLoop fix commits.

---

## Appendix: Methodology

This report was generated from automated codebase analysis using multiple parallel investigation agents covering:

1. **Build configuration** — `next.config.js`, `tsconfig.json`, dependency analysis, route counting
2. **Test suite** — Vitest configuration, test file inventory, coverage gaps
3. **TypeScript compilation** — file counts, type complexity, `.next/types` overhead
4. **CI workflow** — step timing, parallelization options, caching opportunities
5. **Route architecture** — consolidation opportunities, debug route dependencies
6. **Module coupling** — import graph tracing, Supabase singleton impact
7. **Build composition** — client vs server components, dynamic imports, static assets
8. **Git history** — 1,889 commits analyzed for bug patterns, fix frequency, and revert history

All route counts, file line counts, and import chains were verified against the current `master` branch (commit `00f21be8`). Step duration estimates are approximate — only `tsc --noEmit` (~21s) was directly measured; other timings are estimates based on project size and GHA runner specs.
