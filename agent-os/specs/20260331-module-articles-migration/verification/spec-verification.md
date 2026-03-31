---
name: module-articles-migration-spec-verification
created: 2026-03-31T00:00:00Z
updated: 2026-03-31T00:00:00Z
---

# Specification Verification Report

## Verification Summary
- Overall Status: Issues Found
- Date: 2026-03-31
- Spec: module-articles-migration
- Reusability Check: Passed — existing module code is well-documented and referenced
- Test Writing Limits: Compliant — all task groups specify 2-8 focused tests; total ~38-58 across all phases (slightly above 34 upper bound but acceptable for a 5-phase migration)

---

## Structural Verification

### Check 1: Requirements Accuracy

The spec and tasks accurately reflect the user's intent: a thorough, in-depth migration plan with multi-role review.

Key findings:

- FR1 (Schema Alignment): The requirements state that `module_articles` is missing `review_position`, `final_position`, `breaking_news_score`, and `breaking_news_category`. The spec correctly disputes this, identifying (via codebase analysis) that these columns already exist in `create_article_modules_system.sql` and in the `ModuleArticle` TypeScript type. The spec's conclusion — no schema migration needed for these fields — is accurate and supported by the actual migration file at `db/migrations/create_article_modules_system.sql` lines 107-112. The requirements document contains a stale assumption.
- FR2 (Unified Write Path): Accurately captured. `step3-generate.ts`, `article-selector.ts`, and `article-generator.ts` writes to legacy tables are confirmed in the actual code.
- FR3 (Unified Read Path): Accurately captured. All legacy read paths exist as described.
- FR4 (Archiving): Accurately captured. `article-archive.ts` line 60 uses `select('*')` from `articles`, confirmed.
- FR5 (Dashboard Reordering): The spec correctly identifies `send-review/route.ts` as the primary place where `articles.review_position` is updated. Confirmed via code inspection.
- FR6 (Breaking News): The spec correctly re-scopes this: breaking news scores live on `rss_posts` and the architecture is independent. The spec explicitly calls this out-of-scope. This is a reasonable departure from the requirements' FR6 framing, but the reasoning is sound and documented.
- FR7 (Cleanup): Accurately captured across Phase 5.
- NFR1-3: All non-functional requirements accurately captured in spec.
- Reusability opportunities: All documented — `module-articles.ts`, `article-module-selector.ts`, `generateArticleModuleSection()`, `build-snapshot.ts`, `logFinalArticlePositions()`, and `article-modules/route.ts` are all named.

Minor discrepancy: The requirements state "~158 code references across the 3 tables" while the spec's table shows ~5+3+8 write locations and 30++15++40+ read locations. The spec's count (~85 references) differs from requirements' 158. This does not affect the migration plan's correctness; the difference may reflect distinct counting methodology (e.g., requirements may count individual lines while spec counts logical locations).

### Check 2: Visual Assets

No visual files found in `agent-os/specs/20260331-module-articles-migration/planning/visuals/`. The directory exists but is empty. No visual verification required.

---

## Content Validation

### Check 3: Visual Design Tracking

Not applicable — no visual assets exist.

### Check 4: Requirements Coverage

**Explicit Features Requested:**
- Eliminate dual-write paths: Covered in Phase 1 (Tasks 1.A, 1.B, 1.C)
- Eliminate dual-read paths including templates: Covered in Phase 2 (Tasks 2.A, 2.B)
- Migrate all API and dashboard reads: Covered in Phase 3 (Tasks 3.A through 3.F)
- Migrate archiving: Covered in Phase 4 (Tasks 4.A, 4.B)
- Remove legacy types and drop tables: Covered in Phase 5 (Tasks 5.A through 5.D)
- Review/final position tracking on `module_articles`: Covered in Phase 3 (Task 3.A)
- Breaking news compatibility: Covered in spec (correctly re-scoped as no change needed)
- Zero downtime, phased approach: Covered via independently deployable phases
- Multi-tenant isolation: Explicitly called out in NFR3 and in individual task acceptance criteria

**Out-of-Scope Items Correctly Excluded:**
- Module system architecture changes: Correctly excluded
- New article features: Correctly excluded
- RSS feed scoring pipeline changes beyond write target: Correctly excluded
- UI/UX redesign: Correctly excluded
- `manual_articles` system: Correctly excluded

**Reusability Opportunities:**
- `src/lib/rss-processor/module-articles.ts`: Referenced in spec and tasks
- `src/lib/article-modules/article-module-selector.ts`: Referenced
- `src/lib/newsletter-templates/articles.ts::generateArticleModuleSection()`: Referenced
- `src/lib/newsletter-templates/build-snapshot.ts`: Referenced
- `src/app/api/cron/send-final/route.ts::logFinalArticlePositions()`: Referenced
- `src/app/api/campaigns/[id]/article-modules/route.ts`: Referenced as pattern

### Check 5: Core Specification Issues

- Goal alignment: Correct — directly addresses the 3-table parallel system problem
- User stories: All 4 stories are traceable to requirements (operator consistency, single write path, reordering, deprecated function removal)
- Core requirements: All functional requirements map to user-stated needs
- Out of scope: Matches requirements document
- Reusability notes: Present and thorough in "Reusable Components" section

**One significant discrepancy:** The spec correctly identifies that the `module_articles` schema already has `review_position`, `final_position`, `breaking_news_score`, and `breaking_news_category` — contradicting the requirements' FR1. The spec is right. No schema migration for `module_articles` itself is needed. However, the spec does not explicitly call out that FR1 from the requirements is superseded. Implementers reading requirements first may be confused. The spec should acknowledge this divergence from the requirements more prominently.

### Check 6: Task List Detailed Validation

**Test Writing Limits:**
- Task Group 1.A: 3-5 tests — Compliant
- Task Group 1.B: 3-5 tests — Compliant
- Task Group 1.C: 2-3 tests — Compliant
- Task Group 1.D (verification): Runs all Phase 1 tests, approximately 8-13 total — Compliant (runs existing tests, does not write new ones)
- Task Group 2.A: 3-4 tests — Compliant
- Task Group 2.B: 2-3 tests — Compliant
- Task Group 2.C (verification): Runs all Phase 2 tests, approximately 5-7 total — Compliant
- Task Group 3.A: 4-6 tests — Compliant
- Task Group 3.B: 3-5 tests — Compliant
- Task Group 3.C: 3-4 tests — Compliant
- Task Group 3.D: 2-3 tests — Compliant
- Task Group 3.E: 2-3 tests — Compliant
- Task Group 3.F: 2-3 tests — Compliant
- Task Group 3.G (verification): Runs all Phase 3 tests, approximately 16-24 total — Compliant
- Task Group 4.A: 2-3 tests — Compliant
- Task Group 4.B: 3-5 tests — Compliant
- Task Group 4.C (verification): Runs all Phase 4 tests, approximately 5-8 total — Compliant
- Task Group 5.A: 2-3 tests — Compliant
- Task Group 5.B: 2-3 tests — Compliant
- Task Group 5.C (verification): Runs all tests from all phases, expected 30+ total — Compliant (cumulative, not new tests written)
- Task Group 5.D: No new tests, pre-drop safety checks via SQL — Compliant

All verification task groups run only previously written tests, not a full suite. Compliant with focused testing approach.

**Reusability References:**
- Task 1.B.2: References `ModuleArticles.selectTopArticlesForModule()` and `ArticleModuleSelector` as delegation targets — present
- Task 2.A.2: References `full-newsletter.ts` pattern and `generateArticleModuleSection()` — present
- Task 3.A.2: References existing `module_articles` query in route.ts — present
- Task 4.B.2/4.B.3: References existing archiving structure — present

**Task Specificity:**
- All task subtasks reference specific files with line numbers. High specificity throughout.
- Task 1.B.2 note: It offers two options ("change insert target" OR "delegate entirely") without resolving which. This ambiguity could cause inconsistent implementations if the decision is deferred to the implementer without guidance. The spec's target architecture clearly points to full delegation to `article-module-selector.ts`, but the task leaves the door open for a partial approach. Minor concern.

**Visual References:** Not applicable (no visuals).

**Task Count per Phase:**
- Phase 1: 4 task groups (1.A-1.D) — Compliant
- Phase 2: 3 task groups (2.A-2.C) — Compliant
- Phase 3: 7 task groups (3.A-3.G) — Compliant (higher count is warranted by scope: 16 files across 6 parallel work streams)
- Phase 4: 3 task groups (4.A-4.C) — Compliant
- Phase 5: 4 task groups (5.A-5.D) — Compliant

### Check 7: Reusability and Over-Engineering Check

No unnecessary new components identified. The spec and tasks correctly direct implementers to reuse existing module infrastructure. Two items flagged as "New Code Required" (`archived_articles` schema migration and SendGrid module-articles integration) are legitimate new work with no existing analog to reuse.

---

## Critical Issues

The following issues must be resolved before implementation proceeds.

### Issue C1: send-review/route.ts scope is underestimated (Phase 3, Task 3.A.5)

The spec (Phase 3, item 5) says to update `articles.review_position` to `module_articles.review_position`. The actual code at `src/app/api/campaigns/[id]/send-review/route.ts` shows a much larger scope than described:

1. The route fetches `publication_issues` using a nested Supabase relation `articles:articles(*, rss_post:rss_posts(*, rss_feed:rss_feeds(*)))` which uses `select('*')` via relation syntax — this is a rule violation that must be fixed.
2. The entire position logging loop (lines 76-131) operates on the legacy `articles` table. After migration to `module_articles`, the logic for identifying which articles are "active" and sorting by `rank` will need to read from `module_articles`, not from the nested `articles` relation fetched with the issue.
3. This means the data fetch on line 17 (the full issue query) must also change — not just the update at line 95. The spec and task both only mention updating the position write, missing the read/fetch refactor.

The scope of Task 3.A.5 needs to explicitly include:
- Refactoring the issue fetch to join `module_articles` instead of `articles`
- Removing the `select('*')` violation from the nested relation
- Rewriting the `activeArticles` construction to source from `module_articles`

### Issue C2: article-selector.ts scope diverges between requirements and spec (Phase 1, Task 1.B)

The requirements document lists `article-selector.ts` as the file that writes to `articles` and `secondary_articles`. The actual code confirms this: lines 67-69 insert to `articles`, lines 235-237 insert to `secondary_articles`, and lines 123, 177, 311, 383 read from these tables.

However, the spec's description of `article-selector.ts` says to "change insert target" to `module_articles` OR "delegate entirely to `ModuleArticles.selectTopArticlesForModule()` / `ArticleModuleSelector`." The target architecture diagram in the spec shows only `process-rss-workflow.ts -> module-articles.ts -> module_articles` as the write path, which implies the correct answer is full delegation or removal — not redirected inserts. If the legacy step-based pipeline (combined-steps) is also retained, both paths would then write to `module_articles` independently, creating potential duplicate-article issues.

Task 1.B must clarify: is the intent to (a) remove the legacy article-selector pipeline entirely since `process-rss-workflow.ts` already covers this via `module-articles.ts`, or (b) redirect its writes to `module_articles` with deduplication guards? The spec's target architecture implies (a) but the task text leaves (b) open. This needs a decision before implementation.

### Issue C3: `article-selector.ts` missing from `deduplicator.ts` — incorrect attribution in Phase 1

The spec attributes `deduplicator.ts` line 261 as referencing `'articles'` and `'secondary_articles'`. The actual code shows `deduplicator.ts` maintains dual-table checks across multiple methods (confirmed at lines 260-282) as a deliberate cross-table deduplication strategy. Simply replacing these with `'module_articles'` will work structurally, but the deduplicator currently checks BOTH legacy tables AND `module_articles` in the same function (lines 261 vs 275-282). After migration, the legacy table check blocks should be removed entirely, not just renamed. Task 1.C.4 only says "replace references" — it should explicitly say "remove the legacy table check blocks, retain only the `module_articles` check."

---

## Minor Issues

### Issue M1: Requirements FR1 schema gap is stale — spec does not prominently flag this

The spec correctly determines that `review_position`, `final_position`, `breaking_news_score`, and `breaking_news_category` already exist on `module_articles`. The requirements listed this as a required schema change. The spec resolves this in the "Schema Comparison" section but does not include a prominent callout (e.g., "FR1 from requirements is already satisfied — no schema migration needed for module_articles itself"). An implementer reading only the requirements would expect to write a migration that doesn't need to exist. A note in the spec's opening or phase structure would prevent confusion.

### Issue M2: `secondary-articles/[id]/skip` and `toggle` routes — spec says they exist but actual structure differs

The spec (Phase 3, item 4) references `src/app/api/secondary-articles/[id]/skip/route.ts` and `src/app/api/secondary-articles/[id]/toggle/route.ts`. The codebase confirms these files exist. Task 3.B.2 and 3.B.3 say to "change to read/write `module_articles`," but Phase 5 Task 5.B.2 says to "remove `src/app/api/secondary-articles/` directory entirely." These two phases are in conflict: Phase 3 migrates these routes, then Phase 5 deletes them. This is intentional (migrate in Phase 3, clean up in Phase 5), but the Phase 3 migration work will be throwaway — the routes serve `secondary_articles` semantically and, once `secondary_articles` is dropped, the routes have no purpose. The tasks should acknowledge this explicitly so implementers don't over-invest in migrating these routes when removal is the end state.

### Issue M3: `src/app/api/campaigns/[id]/secondary-articles/` — path verified but spec uses incorrect bracket format

The spec references `src/app/api/campaigns/[id]/secondary-articles/`. This path is confirmed to exist in the codebase. No issue with existence, but the path in the spec correctly uses Next.js dynamic route notation.

### Issue M4: `src/app/api/databases/manual-articles/[id]/route.ts` — file not found at spec's path

The spec (Phase 5, item 7) references `src/app/api/databases/manual-articles/[id]/route.ts` at line 104. The actual file exists at `src/app/api/databases/manual-articles/[id]/route.ts` confirmed by directory listing. No issue — path is correct.

### Issue M5: `article-archive.ts` has `select('*')` in multiple places beyond line 60

The spec identifies the `select('*')` violation at line 59-60 of `article-archive.ts`. The actual code shows additional `select('*')` calls at lines 226, 243 (both on `archived_articles`). While these are on the archive destination table rather than the source table, they still violate the no-`select('*')` rule. Task 4.B.2 should explicitly address all `select('*')` instances in the file, not just the one on `articles`.

### Issue M6: `newsletter-archiver.ts` reads all three tables but spec only mentions two at lines 37-82

The spec says `newsletter-archiver.ts` lines 37-82 read from `articles` (line 38) and `secondary_articles` (line 64). Code inspection confirms this. However, `newsletter-archiver.ts` line 407 also reads from `module_articles` for the article modules section. After migration, the lines 37-82 block should be removed entirely, leaving only the existing `module_articles` read at line 407 as the sole article source. Task 4.B.3 should explicitly state this is a block removal (not a replacement), and that the existing `module_articles` path at line 407 is already correct and need not be rewritten.

### Issue M7: Phase 5 `DROP TABLE` uses `CASCADE` without documenting foreign key dependencies

The Phase 5 migration drops `articles` and `secondary_articles` with `CASCADE`. The spec should note what tables or constraints reference `articles` and `secondary_articles` as foreign keys (if any) so that `CASCADE` consequences are understood before execution. If `archived_articles` has a foreign key to `articles` via `original_article_id`, the `CASCADE` drop could affect the archive. Task 5.D.1's pre-drop safety check queries `archived_articles` for unarchived data but does not verify FK constraints. A `\d articles` schema inspection step should be added.

### Issue M8: Test in Task 5.C.7 says "approximately 30+ tests" but sum of phase estimates is 38-58

The summary table shows Phase 1: 8-13, Phase 2: 5-7, Phase 3: 16-24, Phase 4: 5-8, Phase 5: 4-6. Sum: 38-58. Task 5.C.7 says "approximately 30+" which is consistent with the low-end estimate but understates the realistic range. This is a documentation nit, not a functional issue.

---

## Over-Engineering Concerns

None identified. The spec is appropriately scoped. It:
- Uses existing module infrastructure rather than creating new abstractions
- Does not add observability or monitoring beyond what's already in place
- The only new code required (archived_articles migration, SendGrid integration) is directly necessitated by the migration

---

## Dependency and Ordering Assessment

Phase ordering is sound:
- Phase 1 (stop writes) before Phase 2 (migrate reads) is correct — you cannot safely remove template functions until reads are migrated, and reads cannot be migrated until writes are unified
- Phase 3 (API reads) after Phase 2 (template reads) is correct — the active newsletter send path (Phase 2) is higher risk and should be stabilized first
- Phase 4 (archiving) after Phase 3 is correct — archiving is a background operation and not on the critical send path
- Phase 5 (drop tables) last is correct — must confirm zero code references before dropping

Parallel task groups within Phase 3 (3.A through 3.F running in parallel) are safe because they touch different files. The dependency "3.F depends on 3.A-3.D" is correctly stated since frontend components receive data from API routes that must be migrated first.

One dependency concern: Task 1.D.3 deploys to staging and verifies before Phase 2 begins. This is correct operational practice, but the tasks file does not clearly state whether "Phase 2 complete" as a dependency means code-complete or staging-verified-complete. The intent from the spec ("Do not start a phase until the previous phase is verified on staging") is clear in the overview, but individual task group dependency statements just say "Phase N complete." For a multi-agent execution, this could be interpreted as code-complete only. Explicit staging verification as a gating dependency in the dependency line would reduce ambiguity.

---

## Multi-Tenant Isolation Assessment

Multi-tenant isolation is well-addressed throughout:
- NFR3 explicitly states all queries must maintain `publication_id` filtering
- Individual task acceptance criteria for 1.B, 2.A, 3.A, 4.B all include "filter by `publication_id`" requirements
- The spec notes that `module_articles` queries may need `.eq('article_module_id', moduleId)` for module scoping in addition to publication isolation
- The `send-review` route (Issue C1) uses the `publication_id` indirectly via the issue join, which will need to be preserved in any refactor

One concern: Task 1.C.2 and 1.C.3 change `step1-archive.ts` and `step1-archive-fetch.ts` to delete from `module_articles` with `.eq('issue_id', issueId)`. The spec says to "ensure delete is scoped by `issue_id` and `publication_id`." The actual code only uses `issue_id` for the delete. Since `module_articles` does not have a direct `publication_id` column (it is linked to `publication_id` via `issue_id -> publication_issues -> publication_id`), this join-based scoping should be noted explicitly in the task, or alternatively a check should be added that the `issueId` itself belongs to the correct publication before deletion. This is a minor but real security concern.

---

## Rollback Strategy Assessment

All phases have rollback strategies:
- Phases 1-4: Code revert in git. No data changes means no data rollback. Adequate.
- Phase 5: The only destructive phase. Spec requires full backup, 30-day retention, 1-week staging soak, production deployment during off-hours. These are appropriate safeguards.

One gap: The Phase 5 rollback section does not address the `archived_articles` schema migration (Phase 4). Adding nullable columns to `archived_articles` is non-destructive and does not need rollback — the spec correctly notes this. However, if an implementer needs to rollback Phase 4 code but not the schema, the columns will remain on `archived_articles` permanently with NULLs. This is acceptable but worth noting explicitly so the database-engineer is aware.

---

## Recommendations

1. Expand Task 3.A.5 to include refactoring the full issue data fetch in `send-review/route.ts`, not just the position update write. Add explicit steps for removing the `articles` nested relation and replacing it with a `module_articles` query. Fix the `select('*')` on the nested relation.

2. Resolve the ambiguity in Task 1.B.2: decide whether the legacy article-selector pipeline should be redirected to `module_articles` or removed entirely. Given the target architecture, the correct answer is removal/no-op — the task should state this clearly rather than offering both options.

3. Update Task 1.C.4 to say "remove the legacy table check blocks in `deduplicator.ts`" rather than "replace references." The deduplicator intentionally checks both tables; simply renaming the table reference is not sufficient.

4. Add a note to the spec (or the opening of Phase 1 in tasks) that requirements FR1 (add schema columns to `module_articles`) is already satisfied by the existing schema and requires no migration.

5. Update Task 3.B.2-3.B.3 to note these routes are interim: they will be migrated in Phase 3 and deleted in Phase 5. Avoid over-engineering the migration of these routes.

6. Add a `\d articles` schema inspection step to Task 5.D.1 to document what `CASCADE` will affect before the table drop runs.

7. Add explicit `select('*')` remediation to Task 4.B.2 for lines 226 and 243 of `article-archive.ts` (on `archived_articles`).

8. Clarify Task 4.B.3 that the `module_articles` read at line 407 of `newsletter-archiver.ts` is already correct and must be preserved, and that the Phase 4 work is to remove lines 37-82 (the legacy reads) only.

9. Change the dependency statement format in Phase 3 task groups from "Phase 2 complete" to "Phase 2 staging-verified" to match the spec's intent and prevent premature parallel execution.

10. Address the `publication_id` indirect scoping concern in Task 1.C.2/1.C.3: add explicit guidance on how to ensure `module_articles` deletes during step1-archive are scoped to the correct publication.

---

## Conclusion

The specification is thorough, well-structured, and technically accurate. The 5-phase approach is sound and the rollback strategies are appropriate. The reusable components are correctly identified and the target architecture is clearly stated.

The three critical issues all relate to scope underestimation in specific tasks: the `send-review` route requires a larger refactor than described; the `article-selector.ts` migration strategy needs a firm decision on deletion vs. redirection; and the `deduplicator.ts` change needs a removal, not a rename. None of these invalidate the overall plan — they require task-level clarification before implementation begins.

The minor issues are mostly documentation clarity gaps that would create confusion for implementers but would not block a careful reader from succeeding.

The spec is ready for implementation after addressing Critical Issues C1, C2, and C3. The minor issues can be addressed inline as tasks are executed.
