---
name: module-articles-migration-tasks
created: 2026-03-31T14:35:18Z
updated: 2026-03-31T14:35:18Z
---

# Task Breakdown: Complete module_articles Migration

## Overview
Total Tasks: 5 phases, 27 task groups
Assigned roles: backend-engineer, api-engineer, frontend-engineer, testing-engineer, database-engineer

Note: The `agent-os/roles/implementers.yml` file does not exist yet. Roles are assigned based on natural specialization areas for this codebase. When the implementers registry is created, update these assignments accordingly.

## Execution Order

1. **Phase 1** -- Remove Legacy Write Paths (backend-engineer)
2. **Phase 2** -- Migrate Template Read Paths (backend-engineer)
3. **Phase 3** -- Migrate Dashboard, Debug, and API Read Paths (api-engineer, frontend-engineer)
4. **Phase 4** -- Migrate Archiving (database-engineer, backend-engineer)
5. **Phase 5** -- Cleanup and Table Drop (backend-engineer, database-engineer)

Each phase is independently deployable. Do not start a phase until the previous phase is **staging-verified** (not just code-complete).

### Cross-Cutting Requirements (from agent reviews)

**Every route that mutates `module_articles` MUST add publication ownership verification:**
```typescript
const { data: issue } = await supabaseAdmin
  .from('publication_issues')
  .select('id, publication_id')
  .eq('id', issueId)
  .eq('publication_id', callerPublicationId)
  .single()
if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```
This applies to: `skip`, `reorder`, `delete`, `send-review`, `cleanup-duplicates`, and any new route.

**Every `select('*')` encountered during migration MUST be replaced** with explicit column lists — even on read-only paths.

---

## Task List

### Phase 1: Remove Legacy Write Paths

**Goal:** Stop all writes to `articles` and `secondary_articles`. Only `module_articles` receives new data after this phase.

#### Task Group 1.A: Redirect combined-steps/step3 writes
**Assigned implementer:** backend-engineer
**Dependencies:** None

- [ ] 1.A.0 Complete step3 write path migration
  - [ ] 1.A.1 Write 3-5 focused tests for step3 article generation
    - Test that step3 no longer inserts into `articles` table
    - Test that step3 delegates to module-articles.ts methods (or becomes a no-op)
    - Test that the workflow still produces articles in `module_articles` after the change
  - [ ] 1.A.2 Modify `src/app/api/rss/combined-steps/step3-generate.ts`
    - Remove calls to `processor.generateArticlesForSection(issueId, 'primary')` and `processor.generateArticlesForSection(issueId, 'secondary')`
    - Either redirect to `module-articles.ts` methods or make step3 a no-op (since `process-rss-workflow.ts` already writes to `module_articles`)
    - Verify no active cron or workflow depends on step3 writing to the legacy table
  - [ ] 1.A.3 Modify `src/lib/rss-processor/article-generator.ts`
    - Remove or redirect `generateNewsletterArticles()` which writes to `articles` table
    - If `ModuleArticles` class depends on this as a constructor injection, preserve the class shell
  - [ ] 1.A.4 Ensure step3 tests pass
    - Run ONLY the tests written in 1.A.1
    - Verify `npm run build` and `npm run type-check` pass

  - [ ] 1.A.5 Migrate `src/lib/rss-processor/issue-lifecycle.ts` (QA review finding — 6 legacy refs)
    - Lines 125, 129, 138, 143: reads `articles`/`secondary_articles` for post-generation count checks
    - Lines 402, 407: deduplication exclusion list reads from legacy tables
    - Change all count checks and reads to query `module_articles` instead
    - These counts drive log output — incorrect counts mask generation failures
  - [ ] 1.A.6 Migrate `src/lib/rss-processor/legacy.ts` (QA review finding — 4 legacy refs)
    - Lines 67, 72: deletes from legacy tables
    - Lines 166, 207: reads from legacy tables
    - Make legacy pipeline functions no-ops or remove callers
  - [ ] 1.A.7 Remove/deprecate `RSSProcessor.generateArticlesForSection()` facade (QA review finding)
    - `src/lib/rss-processor/rss-processor.ts:99-100` delegates to legacy `articleGenerator`
    - Remove method or make it throw in non-production to prevent accidental reuse

**Files to modify:**
- `src/app/api/rss/combined-steps/step3-generate.ts`
- `src/lib/rss-processor/article-generator.ts`
- `src/lib/rss-processor/issue-lifecycle.ts`
- `src/lib/rss-processor/legacy.ts`
- `src/lib/rss-processor/rss-processor.ts`

**Acceptance Criteria:**
- Tests from 1.A.1 pass
- `npm run build` passes
- step3 no longer inserts into `articles` table
- `issue-lifecycle.ts` counts articles from `module_articles`
- `legacy.ts` functions are no-ops or callers removed
- `RSSProcessor.generateArticlesForSection()` removed or deprecated
- `process-rss-workflow.ts` continues to work (unmodified)

---

#### Task Group 1.B: Retire legacy article-selector pipeline

> **DECISION (from verification C2):** The legacy `article-selector.ts` pipeline is RETIRED, not redirected.
> The target architecture uses `process-rss-workflow.ts → module-articles.ts → module_articles` as the sole write path.
> Redirecting legacy inserts to `module_articles` would create duplicate writes alongside the module pipeline.

**Assigned implementer:** backend-engineer
**Dependencies:** None (parallel with 1.A)

- [ ] 1.B.0 Retire legacy article-selector write path
  - [ ] 1.B.1 Write 3-5 focused tests verifying module pipeline is the sole write path
    - Test that `process-rss-workflow.ts` generates articles in `module_articles` without `article-selector.ts`
    - Test that no code path calls `selectTop5Articles()` or `selectTopSecondaryArticles()`
    - Test that issue processing completes successfully with article-selector functions as no-ops
  - [ ] 1.B.2 Make `article-selector.ts` functions no-ops or remove callers
    - Identify all callers of `selectTop5Articles()`, `selectTopSecondaryArticles()`, `selectTopArticlesForIssue()`
    - Remove calls from combined-steps and any workflow code (module pipeline already covers this)
    - Make functions no-ops with deprecation warnings (full file removal deferred to Phase 5)
  - [ ] 1.B.3 Ensure tests pass — Run ONLY the tests written in 1.B.1

**Files to modify:**
- `src/lib/rss-processor/article-selector.ts` (make no-ops)
- Callers of article-selector functions (remove calls)

**Acceptance Criteria:**
- Tests from 1.B.1 pass
- No inserts to `articles` or `secondary_articles` from this file
- Module pipeline (`module-articles.ts`) remains the sole write path to `module_articles`
- No duplicate articles created

---

#### Task Group 1.C: Redirect remaining legacy writes (archive cleanup, deduplicator)
**Assigned implementer:** backend-engineer
**Dependencies:** None (parallel with 1.A, 1.B)

- [ ] 1.C.0 Complete remaining write path migrations
  - [ ] 1.C.1 Write 2-3 focused tests
    - Test that step1-archive cleanup deletes from `module_articles` (not `secondary_articles`)
    - Test that deduplicator references `module_articles`
  - [ ] 1.C.2 Modify `src/app/api/rss/combined-steps/step1-archive.ts`
    - Change `supabaseAdmin.from('secondary_articles').delete()` to `supabaseAdmin.from('module_articles').delete()`
    - Ensure delete is scoped by `issue_id` and `publication_id`
  - [ ] 1.C.3 Modify `src/app/api/rss/combined-steps/step1-archive-fetch.ts`
    - Same change as 1.C.2
  - [ ] 1.C.4 Modify `src/lib/deduplicator.ts` (lines 260-282)
    - **REMOVE** the legacy table check blocks for `'articles'` and `'secondary_articles'` entirely
    - Do NOT rename them to `'module_articles'` — the deduplicator already has a separate `module_articles` check block (lines 275-282) that must be retained
    - Renaming would create a redundant self-check on `module_articles` twice
  - [ ] 1.C.5 Ensure remaining write path tests pass
    - Run ONLY the tests from 1.C.1

**Files to modify:**
- `src/app/api/rss/combined-steps/step1-archive.ts`
- `src/app/api/rss/combined-steps/step1-archive-fetch.ts`
- `src/lib/deduplicator.ts`

**Acceptance Criteria:**
- Tests from 1.C.1 pass
- Zero writes to legacy tables from these files
- `npm run build` passes

---

#### Task Group 1.D: Migrate send-secondary cron (CTO review finding)

> **CRITICAL (from CTO review):** `send-secondary/route.ts` uses nested `articles:articles(*)` and
> `secondary_articles:secondary_articles(*)` relations at lines 92-109. After Phase 1 stops legacy writes,
> the `activeArticles.length === 0` check at line 134 will silently skip sends for every publication.
> The cron returns `success: true, skipped: true` — no alerting. This is a revenue-path silent failure.

**Assigned implementer:** backend-engineer
**Dependencies:** None (parallel with 1.A, 1.B, 1.C)

- [ ] 1.D.0 Migrate send-secondary cron to module_articles
  - [ ] 1.D.1 Write 2-3 focused tests
    - Test that send-secondary reads active articles from `module_articles` (not legacy tables)
    - Test that `activeArticles` check correctly identifies issues with module_articles content
  - [ ] 1.D.2 Refactor `src/app/api/cron/send-secondary/route.ts` (lines 92-134)
    - Replace nested `articles:articles(*)` and `secondary_articles:secondary_articles(*)` relations
    - Query `module_articles` with `is_active = true` for the issue's article modules
    - Remove `select('*')` violation — use explicit column lists
    - Update `activeArticles` construction at line 134 to source from module_articles
    - Preserve `publication_id` scoping
  - [ ] 1.D.3 Ensure tests pass

**Files to modify:**
- `src/app/api/cron/send-secondary/route.ts`

**Acceptance Criteria:**
- Tests pass
- No reads from `articles` or `secondary_articles`
- Secondary sends still fire correctly when module_articles has active content

---

#### Task Group 1.E: Migrate trigger-workflow recovery logic (CTO review finding)

> **CRITICAL (from CTO review):** `trigger-workflow/route.ts` has OIDC recovery logic (lines 47-55) that
> queries `articles` table to detect if a stuck workflow completed (`articleCount >= 3`). After Phase 1,
> new workflow runs never write to `articles`, so recovery will permanently fail to fire for new issues.

**Assigned implementer:** backend-engineer
**Dependencies:** None (parallel with 1.A-1.D)

- [ ] 1.E.0 Migrate trigger-workflow recovery check
  - [ ] 1.E.1 Write 1-2 focused tests
    - Test that OIDC recovery detects completed workflows via `module_articles` count
  - [ ] 1.E.2 Modify `src/app/api/cron/trigger-workflow/route.ts` (lines 47-55)
    - Change recovery query from `articles` to `module_articles`
    - Translate threshold: "3 articles" → equivalent module_articles check (e.g., `is_active = true` count >= 3)
    - Use explicit column lists, maintain publication_id scoping via issue join
  - [ ] 1.E.3 Ensure tests pass

**Files to modify:**
- `src/app/api/cron/trigger-workflow/route.ts`

**Acceptance Criteria:**
- Tests pass
- Recovery logic detects completed workflows via module_articles
- No reads from legacy `articles` table

---

#### Task Group 1.F: Phase 1 verification
**Assigned implementer:** testing-engineer
**Dependencies:** Task Groups 1.A, 1.B, 1.C, 1.D, 1.E

- [ ] 1.F.0 Verify Phase 1 completeness
  - [ ] 1.F.1 Run `npm run build` and `npm run type-check`
  - [ ] 1.F.2 Grep codebase for remaining INSERT/upsert to `'articles'` (excluding `module_articles`, `archived_articles`, `manual_articles`)
    - Command: `grep -rn "from('articles')" src/ --include="*.ts" | grep -v module_articles | grep -v archived_articles | grep -v manual_articles`
    - Must return zero write operations
  - [ ] 1.F.3 Deploy to staging and trigger a test workflow
    - Verify `module_articles` receives data
    - Verify `articles` and `secondary_articles` receive no new inserts
    - Verify send-secondary cron still sends correctly
    - Verify trigger-workflow recovery logic detects completed workflows
  - [ ] 1.F.4 Run all Phase 1 tests (from 1.A.1, 1.B.1, 1.C.1, 1.D.1, 1.E.1)
    - Expected: approximately 12-18 tests total

**Acceptance Criteria:**
- Build and type-check pass
- Zero write references to legacy article tables
- Staging workflow produces articles in `module_articles` only

---

### Phase 2: Migrate Template Read Paths

**Goal:** All template rendering reads from `module_articles`. Remove deprecated template functions.

#### Task Group 2.A: Migrate SendGrid to module_articles
**Assigned implementer:** backend-engineer
**Dependencies:** Phase 1 complete

- [ ] 2.A.0 Complete SendGrid migration
  - [ ] 2.A.1 Write 3-4 focused tests for SendGrid article rendering
    - Test that SendGrid path renders articles from `module_articles`
    - Test that article sections render correctly with module-specific fields
    - Test fallback behavior when `module_articles` returns 0 articles (should log error)
  - [ ] 2.A.2 Modify `src/lib/sendgrid.ts` (lines 895-903)
    - Replace calls to `generatePrimaryArticlesSection()` and `generateSecondaryArticlesSection()`
    - Use `generateArticleModuleSection()` instead, matching the pattern in `full-newsletter.ts`
    - Query `module_articles` grouped by `article_module_id`
    - All queries must use explicit column lists and filter by `publication_id`
  - [ ] 2.A.3 Add empty-articles safety check
    - If `module_articles` returns 0 articles for an issue, log an error via `console.error`
    - Do not send a newsletter with empty article sections
  - [ ] 2.A.4 Ensure SendGrid tests pass
    - Run ONLY the tests from 2.A.1

**Files to modify:**
- `src/lib/sendgrid.ts`

**Acceptance Criteria:**
- Tests from 2.A.1 pass
- SendGrid renders articles from `module_articles`
- Empty-articles safety check in place

---

#### Task Group 2.B: Remove deprecated template functions
**Assigned implementer:** backend-engineer
**Dependencies:** Task Group 2.A

- [ ] 2.B.0 Complete template cleanup
  - [ ] 2.B.1 Write 2-3 focused tests for template exports
    - Test that `generateArticleModuleSection()` is still exported and functional
    - Test that importing removed functions causes build failure (negative test)
  - [ ] 2.B.2 Remove deprecated functions from `src/lib/newsletter-templates/articles.ts`
    - Remove `generatePrimaryArticlesSection()` (lines 152-203)
    - Remove `generateSecondaryArticlesSection()` (lines 206+)
    - Keep `generateArticleModuleSection()` unchanged
  - [ ] 2.B.3 Update `src/lib/newsletter-templates/index.ts` (lines 25-26)
    - Remove exports of `generatePrimaryArticlesSection` and `generateSecondaryArticlesSection`
  - [ ] 2.B.4 Ensure template tests pass and build succeeds
    - Run tests from 2.B.1
    - Run `npm run build` to catch broken imports

**Files to modify:**
- `src/lib/newsletter-templates/articles.ts`
- `src/lib/newsletter-templates/index.ts`

**Acceptance Criteria:**
- Tests from 2.B.1 pass
- `npm run build` passes with no broken imports
- Only `generateArticleModuleSection()` remains as the article template function

---

#### Task Group 2.C: Phase 2 verification
**Assigned implementer:** testing-engineer
**Dependencies:** Task Groups 2.A, 2.B

- [ ] 2.C.0 Verify Phase 2 completeness
  - [ ] 2.C.1 Run `npm run build` and `npm run type-check`
  - [ ] 2.C.2 Deploy to staging
  - [ ] 2.C.3 Send a test review email on staging
    - Verify article sections render correctly
    - Verify no empty article sections
  - [ ] 2.C.4 Test SendGrid fallback path on staging
    - Verify articles render from `module_articles`
  - [ ] 2.C.5 Run all Phase 2 tests (from 2.A.1, 2.B.1)
    - Expected: approximately 5-7 tests total

**Acceptance Criteria:**
- Build passes
- Test review email renders articles correctly
- SendGrid path renders articles from `module_articles`

---

### Phase 3: Migrate Dashboard, Debug, and API Read Paths

**Goal:** All API routes reading articles use `module_articles` exclusively.

#### Task Group 3.A: Migrate core article API routes
**Assigned implementer:** api-engineer
**Dependencies:** Phase 2 complete

- [ ] 3.A.0 Complete core API route migration
  - [ ] 3.A.1 Write 4-6 focused tests for article API routes
    - Test `/api/databases/articles` returns data from `module_articles` only
    - Test `/api/campaigns/[id]/articles/reorder` updates `module_articles.rank`
    - Test `/api/articles/[id]/skip` reads/writes `module_articles`
    - Test `/api/campaigns/[id]/send-review` updates `module_articles.review_position`
  - [ ] 3.A.2 Modify `src/app/api/databases/articles/route.ts`
    - **SECURITY: Elevate `authTier` from `'public'` to `'authenticated'`** (Security review — exposes analytics unauthenticated)
    - Remove the `articles` table query (lines 177-200)
    - Remove the `secondary_articles` table query (lines 208-231)
    - Keep the existing `module_articles` query (lines 237+)
    - Add defense-in-depth direct `publication_id` filter on module_articles query (DBA review)
    - Consolidate response format
    - Use explicit column lists, filter by `publication_id`
  - [ ] 3.A.3 Modify `src/app/api/campaigns/[id]/articles/reorder/route.ts`
    - **SECURITY: Add publication ownership verification** before any writes (see Mandatory Tenant Verification Pattern)
    - Change from updating `articles.rank` to `module_articles.rank`
    - Add `article_module_id` scoping if needed
  - [ ] 3.A.4 Modify `src/app/api/articles/[id]/skip/route.ts`
    - **SECURITY: Add publication ownership verification** — currently accepts article ID with no tenant check
    - Change reads/writes from `articles` to `module_articles`
  - [ ] 3.A.5 Refactor `src/app/api/campaigns/[id]/send-review/route.ts` (FULL SCOPE)
    - **SECURITY: Add publication ownership verification** — currently fetches issue by ID only, no tenant check
    - **SECURITY: Add Zod validation for `force_subject_line`** input (max 200 chars, optional)
    - **Data fetch refactor (line 17):** Replace nested `articles:articles(*, rss_post:rss_posts(...))` relation with a separate `module_articles` query. Remove `select('*')` violation.
    - **Active articles construction (lines 76-90):** Rewrite `activeArticles` to source from `module_articles` filtered by `is_active = true` for the issue's article modules
    - **Zero-articles guard (QA review):** If `module_articles` returns 0 articles, log error and abort send (mid-flight issue protection)
    - **Position loop (lines 91-131):** Update to write `review_position` to `module_articles` instead of `articles`
    - Use explicit column lists throughout
  - [ ] 3.A.6 Ensure core API route tests pass
    - Run ONLY the tests from 3.A.1

**Files to modify:**
- `src/app/api/databases/articles/route.ts`
- `src/app/api/campaigns/[id]/articles/reorder/route.ts`
- `src/app/api/articles/[id]/skip/route.ts`
- `src/app/api/campaigns/[id]/send-review/route.ts`

**Acceptance Criteria:**
- Tests from 3.A.1 pass
- All routes read/write `module_articles` exclusively
- All queries use explicit column lists and filter by `publication_id`

---

#### Task Group 3.B: Migrate secondary article routes and issue operations
**Assigned implementer:** api-engineer
**Dependencies:** None (parallel with 3.A)

- [ ] 3.B.0 Complete secondary routes and issue operations migration
  - [ ] 3.B.1 Write 3-5 focused tests
    - Test `/api/campaigns/[id]/delete` removes from `module_articles` (not legacy tables)
    - Test `/api/campaigns/[id]/cleanup-duplicates` operates on `module_articles`
    - Test secondary-articles skip/toggle routes operate on `module_articles`
  - [ ] 3.B.2 Modify `src/app/api/secondary-articles/[id]/skip/route.ts`
    - Change to read/write `module_articles`
  - [ ] 3.B.3 Modify `src/app/api/secondary-articles/[id]/toggle/route.ts`
    - Change to read/write `module_articles`
  - [ ] 3.B.4 Modify `src/app/api/campaigns/[id]/delete/route.ts` (lines 45, 56)
    - **SECURITY: Add publication ownership verification** — currently fetches issue by ID only, no tenant check
    - Remove deletes from `articles` and `secondary_articles`
    - Keep existing `module_articles` delete (line 67)
  - [ ] 3.B.5 Modify `src/app/api/campaigns/[id]/cleanup-duplicates/route.ts`
    - **SECURITY: Add publication ownership verification** — currently accepts issueId with no tenant check
    - Change to operate on `module_articles`
  - [ ] 3.B.6 Ensure secondary route tests pass
    - Run ONLY the tests from 3.B.1

**Files to modify:**
- `src/app/api/secondary-articles/[id]/skip/route.ts`
- `src/app/api/secondary-articles/[id]/toggle/route.ts`
- `src/app/api/campaigns/[id]/delete/route.ts`
- `src/app/api/campaigns/[id]/cleanup-duplicates/route.ts`

**Acceptance Criteria:**
- Tests from 3.B.1 pass
- All routes operate on `module_articles`

---

#### Task Group 3.C: Migrate combined-steps read paths
**Assigned implementer:** api-engineer
**Dependencies:** None (parallel with 3.A, 3.B)

- [ ] 3.C.0 Complete combined-steps read path migration
  - [ ] 3.C.1 Write 3-4 focused tests
    - Test step5 reads `module_articles` for headline generation
    - Test step6 reads `module_articles` for subject selection
    - Test step10 reads `module_articles` for unassign-unused
  - [ ] 3.C.2 Modify `src/app/api/rss/combined-steps/step5-generate-headlines.ts` (line 21)
    - Change `secondary_articles` read to `module_articles`
  - [ ] 3.C.3 Modify `src/app/api/rss/combined-steps/step6-select-subject.ts` (line 23)
    - Change `secondary_articles` read to `module_articles`
  - [ ] 3.C.4 Modify `src/app/api/rss/combined-steps/step10-unassign-unused.ts` (line 32)
    - Change `secondary_articles` read to `module_articles`
  - [ ] 3.C.5 Modify `src/app/api/rss/combined-steps/step4-finalize.ts` (QA review — missing from plan)
    - Line 39: queries `articles` for article count used in Slack completion notification
    - Change to query `module_articles` for count
  - [ ] 3.C.6 Modify `src/app/api/rss/combined-steps/step8-finalize.ts` (QA review — missing from plan)
    - Line 18: queries `articles` for article count in completion notification
    - Change to query `module_articles` for count
  - [ ] 3.C.7 Ensure combined-steps tests pass
    - Run ONLY the tests from 3.C.1

**Files to modify:**
- `src/app/api/rss/combined-steps/step5-generate-headlines.ts`
- `src/app/api/rss/combined-steps/step6-select-subject.ts`
- `src/app/api/rss/combined-steps/step10-unassign-unused.ts`
- `src/app/api/rss/combined-steps/step4-finalize.ts`
- `src/app/api/rss/combined-steps/step8-finalize.ts`

**Acceptance Criteria:**
- Tests from 3.C.1 pass
- All combined-steps read from `module_articles`
- Slack notifications report correct article counts from `module_articles`

---

#### Task Group 3.D: Migrate cron and workflow read paths
**Assigned implementer:** api-engineer
**Dependencies:** None (parallel with 3.A-3.C)

- [ ] 3.D.0 Complete cron and workflow read path migration
  - [ ] 3.D.1 Write 2-3 focused tests
    - Test `trigger-workflow` reads from `module_articles`
    - Test `send-secondary` reads from `module_articles` with `final_position`
  - [ ] 3.D.2 Modify `src/app/api/cron/trigger-workflow/route.ts` (line 48)
    - Change `articles` read to `module_articles`
  - [ ] 3.D.3 Modify `src/app/api/cron/send-secondary/route.ts` (line 134)
    - Change `articles` read to `module_articles` with `final_position`
  - [ ] 3.D.4 Modify `src/app/api/rss/steps/archive/route.ts` (line 57)
    - Change `secondary_articles` reference to `module_articles`
  - [ ] 3.D.5 Modify `src/app/api/rss/steps/generate-articles/route.ts` (line 49)
    - Change `secondary_articles` reference to `module_articles`
  - [ ] 3.D.6 Ensure cron/workflow tests pass
    - Run ONLY the tests from 3.D.1

**Files to modify:**
- `src/app/api/cron/trigger-workflow/route.ts`
- `src/app/api/cron/send-secondary/route.ts`
- `src/app/api/rss/steps/archive/route.ts`
- `src/app/api/rss/steps/generate-articles/route.ts`

**Acceptance Criteria:**
- Tests from 3.D.1 pass
- All cron/workflow routes read from `module_articles`

---

#### Task Group 3.E: Migrate debug endpoint handlers
**Assigned implementer:** api-engineer
**Dependencies:** None (parallel with 3.A-3.D)

- [ ] 3.E.0 Complete debug handler migration
  - [ ] 3.E.1 Write 2-3 focused tests
    - Test that a representative debug endpoint returns data from `module_articles`
    - Test that `campaign.ts` debug handler uses `module_articles` for position data
  - [ ] 3.E.2 Modify `src/app/api/debug/handlers/ai.ts` (lines 149, 161)
    - Change `articles` reads to `module_articles`
    - Use explicit column lists
  - [ ] 3.E.3 Modify `src/app/api/debug/handlers/campaign.ts` (lines 42, 81, 98, 313-349, 381, 1009)
    - Change all `articles` reads to `module_articles`
    - Update `review_position`/`final_position` references
  - [ ] 3.E.4 Modify `src/app/api/debug/handlers/checks.ts` (lines 270, 864, 870, 876, 881, 1206, 1520, 1641, 1904, 2088)
    - Change all `articles` and `secondary_articles` reads to `module_articles`
    - This file has the highest volume of changes (~10 locations)
  - [ ] 3.E.5 Modify `src/app/api/debug/handlers/media.ts` (lines 89, 136)
    - Change `articles` reads to `module_articles`
  - [ ] 3.E.6 Modify `src/app/api/debug/handlers/rss.ts` (lines 443, 525, 703)
    - Change `articles` reads to `module_articles`
  - [ ] 3.E.7 Ensure debug handler tests pass
    - Run ONLY the tests from 3.E.1

**Files to modify:**
- `src/app/api/debug/handlers/ai.ts`
- `src/app/api/debug/handlers/campaign.ts`
- `src/app/api/debug/handlers/checks.ts`
- `src/app/api/debug/handlers/media.ts`
- `src/app/api/debug/handlers/rss.ts`

**Acceptance Criteria:**
- Tests from 3.E.1 pass
- All debug handlers read from `module_articles`
- All queries use explicit column lists

---

#### Task Group 3.F: Migrate frontend components
**Assigned implementer:** frontend-engineer
**Dependencies:** Task Groups 3.A-3.D (API routes must be migrated first)

- [ ] 3.F.0 Complete frontend migration
  - [ ] 3.F.1 Write 2-3 focused tests
    - Test that website newsletter page does not render legacy section types
    - Test that BreakingNewsSection receives correct props
  - [ ] 3.F.2 Modify `src/app/website/newsletter/[date]/page.tsx` (lines 149, 355)
    - Remove conditional logic for `primary_articles`/`secondary_articles` section types
    - Article modules handle all rendering
  - [ ] 3.F.3 Verify `src/components/issue-detail/BreakingNewsSection.tsx`
    - Confirm props come from `module_articles` data (passed through issue detail page)
    - No changes expected if props are already correctly sourced
  - [ ] 3.F.4 Ensure frontend tests pass
    - Run ONLY the tests from 3.F.1

**Files to modify:**
- `src/app/website/newsletter/[date]/page.tsx`
- `src/components/issue-detail/BreakingNewsSection.tsx` (verify only)

**Acceptance Criteria:**
- Tests from 3.F.1 pass
- Website newsletter page renders without legacy section types
- `npm run build` passes

---

#### Task Group 3.G: Fix select('*') and add indexes (DBA review findings)
**Assigned implementer:** database-engineer
**Dependencies:** None (parallel with 3.A-3.F)

- [ ] 3.G.0 Fix select('*') and add performance indexes
  - [ ] 3.G.1 Fix `src/lib/article-modules/article-module-selector.ts` line 144
    - Replace `select('*')` with explicit column list matching `ModuleArticle` type
    - This is the primary read path for article selection — high impact
  - [ ] 3.G.2 Add indexes for position and rank queries on `module_articles`
    ```sql
    -- Support rank-ordered reads within a module/issue
    CREATE INDEX IF NOT EXISTS idx_module_articles_rank
      ON module_articles(issue_id, article_module_id, rank)
      WHERE is_active = true;
    -- Support final_position reads for send-secondary
    CREATE INDEX IF NOT EXISTS idx_module_articles_final_position
      ON module_articles(issue_id, final_position)
      WHERE final_position IS NOT NULL;
    ```
  - [ ] 3.G.3 Deploy indexes to staging first, then production

**Files to modify:**
- `src/lib/article-modules/article-module-selector.ts`
- `db/migrations/YYYYMMDD_add_module_articles_indexes.sql`

**Acceptance Criteria:**
- No `select('*')` in article-module-selector.ts
- Indexes created on both staging and production
- `npm run build` passes

---

#### Task Group 3.H: Phase 3 verification
**Assigned implementer:** testing-engineer
**Dependencies:** Task Groups 3.A-3.F

- [ ] 3.G.0 Verify Phase 3 completeness
  - [ ] 3.G.1 Run `npm run build`, `npm run type-check`, `npm run lint`
  - [ ] 3.G.2 Grep for remaining reads from legacy tables
    - Command: `grep -rn "from('articles')" src/ --include="*.ts" | grep -v module_articles | grep -v archived_articles | grep -v manual_articles`
    - Command: `grep -rn "from('secondary_articles')" src/ --include="*.ts"`
    - Both must return zero results
  - [ ] 3.G.3 Deploy to staging
  - [ ] 3.G.4 Verify on staging:
    - Dashboard articles page loads correctly
    - Issue detail page shows articles with correct positions
    - Article skip/toggle actions work
    - Reorder action updates `module_articles.rank`
    - Debug endpoints return data
  - [ ] 3.G.5 Run all Phase 3 tests (from 3.A.1 through 3.F.1)
    - Expected: approximately 16-24 tests total across task groups

**Acceptance Criteria:**
- Build, type-check, and lint pass
- Zero reads from legacy tables in application code
- All dashboard and API functionality verified on staging

---

### Phase 4: Migrate Archiving

**Goal:** Archiving reads from `module_articles` and preserves module-specific fields.

#### Task Group 4.A: Schema migration for archived_articles
**Assigned implementer:** database-engineer
**Dependencies:** Phase 3 complete

- [ ] 4.A.0 Complete archived_articles schema migration
  - [ ] 4.A.1 Write 2-3 focused tests
    - Test that archived_articles table accepts module-specific fields
    - Test that existing archived data is still queryable (NULLs for new fields)
  - [ ] 4.A.2 Create migration file `db/migrations/YYYYMMDD_add_module_fields_to_archived_articles.sql`
    - **CRITICAL (DBA review): Add `publication_id` column** — `archived_articles` currently has no tenant scoping
    ```sql
    ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS publication_id UUID REFERENCES publications(id) ON DELETE CASCADE;
    ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS article_module_id UUID REFERENCES article_modules(id) ON DELETE SET NULL;
    ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS ai_image_url TEXT;
    ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS image_alt TEXT;
    ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS trade_image_url TEXT;
    ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS trade_image_alt TEXT;
    ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS ticker TEXT;
    ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS member_name TEXT;
    ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS transaction_type TEXT;
    CREATE INDEX IF NOT EXISTS idx_archived_articles_publication ON archived_articles(publication_id);
    CREATE INDEX IF NOT EXISTS idx_archived_articles_pub_date ON archived_articles(publication_id, issue_date);
    ```
    - Backfill `publication_id` from `publication_issues` join: `UPDATE archived_articles aa SET publication_id = pi.publication_id FROM publication_issues pi WHERE aa.issue_id = pi.id AND aa.publication_id IS NULL`
    - All new columns nullable, no defaults
    - Verify RLS remains enabled after migration
  - [ ] 4.A.3 Update `src/types/database.ts`
    - Add new nullable fields to `ArchivedArticle` interface
  - [ ] 4.A.4 Run migration on staging first
    - `npm run migrate:staging`
    - Verify existing archived data is unaffected
  - [ ] 4.A.5 Ensure schema tests pass
    - Run ONLY the tests from 4.A.1

**Files to modify:**
- `db/migrations/YYYYMMDD_add_module_fields_to_archived_articles.sql` (new)
- `src/types/database.ts`

**Acceptance Criteria:**
- Migration runs successfully on staging
- Existing archived data accessible with NULLs for new fields
- TypeScript types updated

---

#### Task Group 4.B: Migrate archiving code
**Assigned implementer:** backend-engineer
**Dependencies:** Task Group 4.A

- [ ] 4.B.0 Complete archiving code migration
  - [ ] 4.B.1 Write 3-5 focused tests
    - Test that `archiveArticles()` reads from `module_articles` with explicit column list
    - Test that archived data includes module-specific fields
    - Test that `newsletter-archiver.ts` reads from `module_articles` grouped by `article_module_id`
  - [ ] 4.B.2 Modify `src/lib/article-archive.ts`
    - Change `archiveArticles()` to read from `module_articles` instead of `articles`
    - Replace ALL `select('*')` with explicit column lists — lines 60, 226, 243 (DBA review: 3 violations, not just 1)
    - Include `publication_id` in archive insert (fetch from issue, write to archived_articles)
    - Include module-specific columns: `article_module_id`, `ai_image_url`, `image_alt`, `trade_image_url`, `trade_image_alt`, `ticker`, `member_name`, `transaction_type`
    - Filter all reads by `publication_id`
    - Fix `getArchiveStats()` (lines 265-288): replace unbounded full-table JS aggregate with COUNT query (DBA review)
    - **Verification**: After archiving on staging, run: `SELECT count(*) FROM archived_articles WHERE archived_at > NOW() - INTERVAL '1 hour' AND article_module_id IS NULL` — must return 0
  - [ ] 4.B.3 Modify `src/lib/newsletter-archiver.ts` (lines 37-82)
    - **REMOVE** the legacy reads block (lines 37-82) that fetches from `articles` and `secondary_articles`
    - The existing `module_articles` read at line ~407 is already correct and must be PRESERVED as-is
    - This is a block removal, not a rewrite — the module path already handles article archiving
    - Use explicit column lists, filter by `publication_id`
  - [ ] 4.B.4 Ensure archiving tests pass
    - Run ONLY the tests from 4.B.1

**Files to modify:**
- `src/lib/article-archive.ts`
- `src/lib/newsletter-archiver.ts`

**Acceptance Criteria:**
- Tests from 4.B.1 pass
- Archiving reads exclusively from `module_articles`
- No `select('*')` in any archiving code
- Module-specific fields preserved in archives

---

#### Task Group 4.C: Phase 4 verification
**Assigned implementer:** testing-engineer
**Dependencies:** Task Groups 4.A, 4.B

- [ ] 4.C.0 Verify Phase 4 completeness
  - [ ] 4.C.1 Run `npm run build` and `npm run type-check`
  - [ ] 4.C.2 Run archiving on staging for a recent issue
    - Verify `archived_articles` contains module-specific fields
  - [ ] 4.C.3 Verify historical archived data is still accessible
    - Query for an old archived article; confirm NULLs for new fields
  - [ ] 4.C.4 Verify newsletter archiver produces correct HTML structure
  - [ ] 4.C.5 Run all Phase 4 tests (from 4.A.1, 4.B.1)
    - Expected: approximately 5-8 tests total

**Acceptance Criteria:**
- Build passes
- Archiving works correctly with module-specific fields
- Historical data unaffected

---

### Phase 5: Cleanup and Table Drop

**Goal:** Remove all remaining legacy code and drop the `articles` and `secondary_articles` tables.

#### Task Group 5.A: Remove legacy TypeScript types and dead code
**Assigned implementer:** backend-engineer
**Dependencies:** Phase 4 complete

- [ ] 5.A.0 Complete type and dead code cleanup
  - [ ] 5.A.1 Write 2-3 focused tests
    - Test that `ModuleArticle` type is the only active article type
    - Test that removed files/routes cause build failures if re-imported
  - [ ] 5.A.2 Modify `src/types/database.ts`
    - Remove `Article` interface
    - Remove `SecondaryArticle` interface
    - Keep `ModuleArticle` and `ArchivedArticle`
  - [ ] 5.A.3 Evaluate and clean `src/lib/rss-processor/article-selector.ts`
    - Remove entirely if all functionality migrated to `module-articles.ts` and `article-module-selector.ts`
    - Or gut to only module-articles-compatible logic
  - [ ] 5.A.4 Evaluate and clean `src/lib/rss-processor/article-generator.ts`
    - Remove legacy `generateNewsletterArticles()` if fully replaced
    - Keep class shell if `ModuleArticles` depends on it via constructor injection
  - [ ] 5.A.5 Ensure cleanup tests pass
    - Run ONLY the tests from 5.A.1
    - Run `npm run build` to verify no broken imports

**Files to modify:**
- `src/types/database.ts`
- `src/lib/rss-processor/article-selector.ts`
- `src/lib/rss-processor/article-generator.ts`

**Acceptance Criteria:**
- Tests from 5.A.1 pass
- `npm run build` passes
- No dead code referencing legacy tables

---

#### Task Group 5.B: Remove legacy API route directories
**Assigned implementer:** api-engineer
**Dependencies:** Task Group 5.A

- [ ] 5.B.0 Complete legacy route removal
  - [ ] 5.B.1 Write 2-3 focused tests
    - Test that removed routes return 404
    - Test that `SectionsPanel.tsx` does not include `'secondary_articles'` in section types
  - [ ] 5.B.2 Remove `src/app/api/secondary-articles/` directory entirely
    - Contains skip and toggle routes for secondary articles
  - [ ] 5.B.3 Remove `src/app/api/campaigns/[id]/secondary-articles/` directory
    - Contains reorder route for secondary articles
  - [ ] 5.B.4 Modify `src/components/ad-modules/SectionsPanel.tsx` (line 416)
    - Remove `'secondary_articles'` from section type list
  - [ ] 5.B.5 Modify `src/app/api/databases/manual-articles/route.ts` (line 79) and `[id]/route.ts` (line 104)
    - Remove `'secondary_articles'` from allowed `section_type` values
    - Keep other valid section types
  - [ ] 5.B.6 Ensure legacy route removal tests pass
    - Run ONLY the tests from 5.B.1
    - Run `npm run build`

**Files to modify/remove:**
- `src/app/api/secondary-articles/` (remove)
- `src/app/api/campaigns/[id]/secondary-articles/` (remove)
- `src/components/ad-modules/SectionsPanel.tsx`
- `src/app/api/databases/manual-articles/route.ts`
- `src/app/api/databases/manual-articles/[id]/route.ts`

**Acceptance Criteria:**
- Tests from 5.B.1 pass
- `npm run build` passes
- Legacy API routes removed
- No references to `'secondary_articles'` as a section type

---

#### Task Group 5.C: Final codebase verification
**Assigned implementer:** testing-engineer
**Dependencies:** Task Groups 5.A, 5.B

- [ ] 5.C.0 Complete final codebase verification
  - [ ] 5.C.1 Run `npm run build`, `npm run type-check`, `npm run lint`
    - Lint must stay within `--max-warnings 360` ceiling
  - [ ] 5.C.2 Full grep verification
    - `grep -rn "'articles'" src/ --include="*.ts"` -- filter out `module_articles`, `archived_articles`, `manual_articles`, and UI string literals
    - `grep -rn "'secondary_articles'" src/ --include="*.ts"` -- must return zero
    - Both must confirm zero legacy table references
  - [ ] 5.C.3 Deploy to staging
  - [ ] 5.C.4 Full newsletter workflow on staging
    - Ingest RSS
    - Score posts
    - Generate articles
    - Review email
    - Send final
    - Verify all steps use `module_articles`
  - [ ] 5.C.5 Dashboard verification on staging
    - All pages load without errors
    - Article views load in under 2 seconds
    - Position tracking (review and final) works correctly
  - [ ] 5.C.6 Archiving verification on staging
    - Archive a recent issue
    - Verify module-specific fields preserved
    - Verify historical data accessible
  - [ ] 5.C.7 Run all tests from all phases
    - Expected total: approximately 30+ tests across all phases

**Acceptance Criteria:**
- Build, type-check, lint all pass
- Zero references to legacy tables in code
- Full workflow works end-to-end on staging
- All dashboard functionality verified

---

#### Task Group 5.D: Database table drop
**Assigned implementer:** database-engineer
**Dependencies:** Task Group 5.C (must pass all verifications)

- [ ] 5.D.0 Complete legacy table drop
  - [ ] 5.D.1 Pre-drop safety checks
    - Run unarchived data verification query:
      ```sql
      SELECT a.id, a.issue_id, a.headline
      FROM articles a
      LEFT JOIN archived_articles aa ON aa.original_article_id = a.id
      WHERE aa.id IS NULL;
      ```
    - If results exist, archive them before proceeding
    - Same check for `secondary_articles`
    - **CTO review: Also check for pre-module-system issues** that exist only in `articles` (no `module_articles` rows):
      ```sql
      SELECT a.issue_id, pi.date, count(*) AS legacy_only_articles
      FROM articles a
      JOIN publication_issues pi ON a.issue_id = pi.id
      LEFT JOIN module_articles ma ON ma.issue_id = a.issue_id
      WHERE ma.id IS NULL
      GROUP BY a.issue_id, pi.date
      ORDER BY pi.date;
      ```
    - If results exist: determine if these historical issues are displayed on website archive or any API. If so, copy to `archived_articles` before drop.
  - [ ] 5.D.1b Inspect FK constraints before DROP
    - Run `SELECT conname, conrelid::regclass, confrelid::regclass FROM pg_constraint WHERE confrelid IN ('articles'::regclass, 'secondary_articles'::regclass)`
    - Document all tables/constraints that reference these tables
    - Verify CASCADE consequences are acceptable (e.g., `archived_articles.original_article_id` FK)
    - If any unexpected FKs exist, drop them explicitly first
  - [ ] 5.D.2 Take full backup of both tables
    - Backup `articles` table (full data dump)
    - Backup `secondary_articles` table (full data dump)
    - Verify backups can be restored
    - Store backups for 30 days minimum
  - [ ] 5.D.3 Create migration file `db/migrations/YYYYMMDD_drop_legacy_article_tables.sql`
    ```sql
    -- SECURITY + DBA REVIEW: Use explicit FK drops, NOT CASCADE
    -- CASCADE may silently drop article_performance and sever archived_articles FKs

    -- Step 1: Drop FK constraints explicitly
    ALTER TABLE archived_articles DROP CONSTRAINT IF EXISTS archived_articles_original_article_id_fkey;
    DROP TABLE IF EXISTS article_performance;  -- may or may not exist

    -- Step 2: Verify no remaining FKs reference these tables
    -- SELECT conname, conrelid::regclass FROM pg_constraint
    -- WHERE confrelid IN ('articles'::regclass, 'secondary_articles'::regclass);
    -- Must return 0 rows before proceeding

    -- Step 3: Drop tables WITHOUT CASCADE
    DROP TABLE IF EXISTS secondary_articles;
    DROP TABLE IF EXISTS articles;
    ```
  - [ ] 5.D.4 Run migration on staging first
    - `npm run migrate:staging`
    - Soak for 1 week on staging before production
  - [ ] 5.D.5 After 1-week staging soak: run migration on production
    - Deploy during off-hours (not during newsletter send window)
    - Monitor error rates for 24 hours post-drop
  - [ ] 5.D.6 Post-drop verification
    - Full newsletter workflow on production
    - Dashboard loads all pages
    - No 500 errors in logs referencing dropped tables

**Files to modify:**
- `db/migrations/YYYYMMDD_drop_legacy_article_tables.sql` (new)

**Acceptance Criteria:**
- Tables dropped on staging, verified for 1 week
- Tables dropped on production
- Zero errors in production logs for 24 hours
- Full newsletter workflow completes successfully
- Backups stored and verified

---

## Summary

| Phase | Task Groups | Est. Tests | Key Risk |
|-------|-------------|------------|----------|
| Phase 1: Remove Legacy Writes | 1.A-1.F (6 groups) | 15-22 | Dual-write gap; send-secondary silent skip; trigger-workflow recovery |
| Phase 2: Migrate Template Reads | 2.A-2.C (3 groups) | 5-7 | SendGrid path breaks |
| Phase 3: Migrate API/Dashboard Reads | 3.A-3.H (8 groups) | 20-30 | Security: 5 mutation routes need pub_id checks; select('*') fixes |
| Phase 4: Migrate Archiving | 4.A-4.C (3 groups) | 6-10 | Archive data loss; publication_id backfill on archived_articles |
| Phase 5: Cleanup and Drop | 5.A-5.D (4 groups) | 4-6 + full regression | Explicit FK drops; pre-module historical data check |
| **Total** | **17 task groups** | **~38-58 tests** | |

## Critical Rules Checklist (every PR)

- [ ] Every query filters by `publication_id`
- [ ] No `select('*')` in any new or modified query
- [ ] All date comparisons use local date strings (not `toISOString()`)
- [ ] `npm run build` passes
- [ ] `npm run type-check` passes
- [ ] Deployed to staging before production
- [ ] Pre-push review completed (`/review:pre-push`)
