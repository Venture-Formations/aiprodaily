---
name: module-articles-migration
status: backlog
created: 2026-03-31T14:32:01Z
updated: 2026-03-31T14:32:01Z
---

# Specification: Complete module_articles Migration

## Goal

Eliminate the legacy `articles` and `secondary_articles` tables by making `module_articles` the single source of truth for all newsletter article data. This removes dual-write/dual-read complexity, fixes archiving gaps, and reduces maintenance surface by ~85 code references.

## User Stories

- As a newsletter operator, I want articles stored in one table so that the dashboard shows consistent data regardless of which system generated them.
- As a developer, I want a single write path so that new article features only need to be implemented once.
- As a newsletter operator, I want article reordering to work with module articles so that review and final positions are correctly captured.
- As a developer, I want deprecated template functions removed so that the codebase is easier to maintain.

## Important Clarifications (from verification)

> **FR1 Schema Gap is already resolved.** The requirements doc states that `module_articles` lacks `review_position`, `final_position`, `breaking_news_score`, and `breaking_news_category`. This is incorrect — these columns already exist in the `module_articles` schema (see `db/migrations/create_article_modules_system.sql` lines 107-112 and `ModuleArticle` TypeScript type). No schema migration is needed for `module_articles` itself.

> **Breaking news is independent.** Breaking news scores live on `rss_posts`, not on any articles table. The `breaking-news-processor.ts` operates entirely on `rss_posts` and `issue_breaking_news`. No migration needed for this system.

> **article-selector.ts should be removed, not redirected.** The target architecture uses `process-rss-workflow.ts → module-articles.ts → module_articles` as the sole write path. The legacy `article-selector.ts` pipeline should be retired (functions become no-ops or are deleted), NOT redirected to write to `module_articles` — that would create duplicate writes.

> **deduplicator.ts needs block removal.** The deduplicator checks BOTH legacy tables AND `module_articles` in separate code blocks. The legacy blocks must be removed entirely, not renamed — otherwise the deduplicator would self-check `module_articles` twice.

> **send-review/route.ts requires full refactor.** Not just the `review_position` write — the entire data fetch uses a nested `articles` relation with `select('*')`. The fetch, active article construction, and position loop all need migration.

> **send-secondary/route.ts must be migrated in Phase 1 (CTO review).** Uses nested `articles:articles(*)` and `secondary_articles:secondary_articles(*)` at lines 92-109. After legacy writes stop, the `activeArticles.length === 0` check silently skips sends. Returns `success: true, skipped: true` — no alerting. Revenue-path silent failure.

> **trigger-workflow/route.ts recovery logic must be migrated in Phase 1 (CTO review).** OIDC recovery (lines 47-55) queries `articles` count >= 3 to detect completed stuck workflows. After legacy writes stop, recovery will permanently fail to fire for new issues.

> **4 files missing from original plan (QA review).** `issue-lifecycle.ts` (6 legacy refs), `legacy.ts` (4 refs), `step4-finalize.ts` (article count for Slack notification), `step8-finalize.ts` (article count for completion). Must be migrated in Phase 1/3.

> **Multi-tenant isolation is the biggest risk (Security + DBA reviews).** `module_articles` has no direct `publication_id` column — tenant isolation depends on verifying `issue_id` ownership. 5 mutation routes (`skip`, `reorder`, `delete`, `send-review`, `cleanup-duplicates`) lack `publication_id` ownership checks. `archived_articles` also lacks `publication_id`. All must be fixed during migration.

> **`databases/articles` route uses `authTier: 'public'` (Security review).** Exposes article analytics to unauthenticated callers. Must be elevated to `authenticated` during Phase 3 migration.

> **`article-module-selector.ts:144` has `select('*')` (DBA review).** This is the primary read path for article selection and is not tracked in any phase. Must be fixed.

> **Phase 5 must use explicit FK drops, not CASCADE (Security + DBA reviews).** `DROP TABLE CASCADE` may silently drop `article_performance` table and sever `archived_articles.original_article_id` FK. Use explicit constraint drops then `DROP TABLE` without CASCADE.

## Mandatory Tenant Verification Pattern

All routes that mutate `module_articles` MUST verify issue ownership before any write:

```typescript
// Step 1: Verify issue belongs to caller's publication
const { data: issue } = await supabaseAdmin
  .from('publication_issues')
  .select('id, publication_id')
  .eq('id', issueId)
  .eq('publication_id', callerPublicationId)
  .single()
if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 })

// Step 2: Now safe to query/mutate module_articles by issue_id
```

## Core Requirements

### Functional Requirements

- All article generation writes exclusively to `module_articles` (no more dual writes to `articles`/`secondary_articles`)
- All article reads (templates, dashboard, archiving, debug endpoints) use `module_articles`
- Article reordering (review_position, final_position) operates on `module_articles`
- Breaking news scoring continues to work (scores live on `rss_posts`, references from `module_articles` via post_id)
- Archiving captures `module_articles` data including module-specific fields (article_module_id, trade images, ticker)
- Legacy tables (`articles`, `secondary_articles`) dropped after all code references are removed

### Non-Functional Requirements

- Zero downtime: each phase is independently deployable and rollback-safe
- Multi-tenant isolation: all queries maintain `publication_id` filtering
- No `select('*')` in any new or modified query
- All date comparisons use local date strings, never `toISOString()`
- Existing `module_articles` data remains unaffected throughout migration

## Current State Analysis

### The 3-Table Problem

The system currently maintains three article tables in parallel:

| Table | Write Count | Read Count | Status |
|-------|-------------|------------|--------|
| `articles` | ~5 write locations | ~30+ read locations | Legacy, still active |
| `secondary_articles` | ~3 write locations | ~15+ read locations | Legacy, still active |
| `module_articles` | ~8 write locations | ~40+ read locations | Current, primary |

**Dual-write paths:**
- `process-rss-workflow.ts` drives `module-articles.ts` (writes to `module_articles`)
- `combined-steps/step3-generate.ts` calls `processor.generateArticlesForSection()` which writes to `articles` via `article-generator.ts`
- `article-selector.ts::selectTopArticlesForIssue()` writes to both `articles` and `secondary_articles`

**Dual-read paths:**
- `full-newsletter.ts` uses `generateArticleModuleSection()` (reads `module_articles`) -- this is the active path
- `sendgrid.ts` still uses `generatePrimaryArticlesSection()` and `generateSecondaryArticlesSection()` (read legacy tables) -- this is a fallback path
- `newsletter-archiver.ts` reads from all three tables
- `article-archive.ts` reads only from `articles`
- Dashboard articles API (`src/app/api/databases/articles/route.ts`) reads from all three tables

### Schema Comparison

The `module_articles` table already has all columns needed. The original migration (`create_article_modules_system.sql`) included `review_position`, `final_position`, `breaking_news_score`, and `breaking_news_category`. The TypeScript type `ModuleArticle` in `src/types/database.ts` also includes these fields. No schema changes are required.

**Columns unique to module_articles** (must be preserved): `article_module_id`, `ai_image_url`, `image_alt`, `trade_image_url`, `trade_image_alt`, `ticker`, `member_name`, `transaction_type`

### Breaking News Architecture

Breaking news scores live on `rss_posts` (not on `articles`). The `breaking-news-processor.ts` updates `rss_posts.breaking_news_score` and `rss_posts.breaking_news_category`. The `module_articles` table has its own `breaking_news_score`/`breaking_news_category` columns but they are not currently populated during the module workflow. The breaking news API route (`/api/campaigns/[id]/breaking-news`) reads from `rss_posts` directly and uses `issue_breaking_news` for selections. This architecture is independent of the articles table migration and requires no changes.

### Template Rendering

Three functions in `src/lib/newsletter-templates/articles.ts`:

| Function | Status | Table | Callers |
|----------|--------|-------|---------|
| `generateArticleModuleSection()` | ACTIVE | `module_articles` | `full-newsletter.ts` |
| `generatePrimaryArticlesSection()` | DEPRECATED | `articles` | `sendgrid.ts` |
| `generateSecondaryArticlesSection()` | DEPRECATED | `secondary_articles` | `sendgrid.ts` |

The `full-newsletter.ts` (used by review and final send) already uses only `generateArticleModuleSection()`. The `sendgrid.ts` legacy path is a secondary email provider fallback that still uses the deprecated functions.

## Target Architecture

After migration, `module_articles` is the only article table:

```
Workflow writes:
  process-rss-workflow.ts -> module-articles.ts -> module_articles

Template reads:
  full-newsletter.ts -> generateArticleModuleSection() -> module_articles

Dashboard reads:
  /api/databases/articles -> module_articles
  /api/campaigns/[id]/article-modules -> module_articles

Archiving:
  newsletter-archiver.ts -> module_articles
  article-archive.ts -> module_articles -> archived_articles

Position tracking:
  send-review -> module_articles.review_position
  send-final -> module_articles.final_position (already implemented)
```

## Migration Phases

Each phase is independently deployable and has its own rollback strategy. Phases are ordered to minimize risk: writes migrate first, then reads, then cleanup.

---

### Phase 1: Remove Legacy Write Paths

**Goal:** Stop writing to `articles` and `secondary_articles`. After this phase, only `module_articles` receives new data.

**Files to modify:**

1. **`src/app/api/rss/combined-steps/step3-generate.ts`**
   - Currently calls `processor.generateArticlesForSection(issueId, 'primary')` and `processor.generateArticlesForSection(issueId, 'secondary')`, which write to the `articles` table
   - Change to: no-op or remove. The `process-rss-workflow.ts` already handles article generation via `module-articles.ts` writing to `module_articles`. The combined-steps path is the legacy step-by-step API
   - Verify: if `combined-steps/step3` is still invoked by any active cron or workflow, redirect it to use `module-articles.ts` methods instead

2. **`src/lib/rss-processor/article-selector.ts`**
   - `selectTop5Articles()` inserts into `articles` table (line 68-79)
   - `selectTopSecondaryArticles()` inserts into `secondary_articles` table
   - These are called by `selectTopArticlesForIssue()` which is used by the legacy step-based processing
   - Change to: have selection logic operate on `module_articles` instead, or delegate to `ModuleArticles.selectTopArticlesForModule()` / `ArticleModuleSelector.selectTopArticlesForIssue()`

3. **`src/lib/rss-processor/article-generator.ts`**
   - `generateNewsletterArticles()` writes to `articles` table (via the `section` parameter distinguishing primary/secondary)
   - Change to: remove or redirect to `module-articles.ts` methods

4. **`src/app/api/rss/combined-steps/step1-archive.ts`** and **`step1-archive-fetch.ts`**
   - Both contain `supabaseAdmin.from('secondary_articles').delete().eq('issue_id', issueId)` cleanup
   - Change to: delete from `module_articles` instead (or remove if workflow handles cleanup)

5. **`src/lib/deduplicator.ts`** (line 261)
   - References `'articles'` and `'secondary_articles'` table names
   - Change to: use `'module_articles'`

**Rollback:** Revert the code changes. No data migration in this phase, so no data rollback needed. Legacy tables still exist and can be re-enabled.

**Verification:**
- Run `npm run build` and `npm run type-check` pass
- Trigger a test workflow on staging; verify `module_articles` receives data and `articles`/`secondary_articles` receive no new inserts
- Check that `process-rss-workflow.ts` still works end-to-end (it already writes to `module_articles`)

---

### Phase 2: Migrate Read Paths (Templates and SendGrid)

**Goal:** All template rendering reads from `module_articles` only. Remove deprecated template functions.

**Files to modify:**

1. **`src/lib/sendgrid.ts`** (lines 895-903)
   - Currently imports and calls `generatePrimaryArticlesSection()` and `generateSecondaryArticlesSection()` for the `primary_articles` and `secondary_articles` section types
   - Change to: use `generateArticleModuleSection()` for article module sections, matching the pattern in `full-newsletter.ts`
   - If SendGrid path needs module data, query `module_articles` grouped by `article_module_id`

2. **`src/lib/newsletter-templates/articles.ts`**
   - Remove `generatePrimaryArticlesSection()` (lines 152-203)
   - Remove `generateSecondaryArticlesSection()` (lines 206+)
   - Keep only `generateArticleModuleSection()`

3. **`src/lib/newsletter-templates/index.ts`** (lines 25-26)
   - Remove exports of `generatePrimaryArticlesSection` and `generateSecondaryArticlesSection`

**Rollback:** Revert code. The deprecated functions can be restored from git history. No data changes.

**Verification:**
- `npm run build` passes (no broken imports)
- Send a test review email on staging; verify article sections render correctly
- Verify SendGrid fallback path renders articles from `module_articles`

---

### Phase 3: Migrate Read Paths (Dashboard, Debug, API Routes)

**Goal:** All API routes that read articles use `module_articles` exclusively.

**Files to modify:**

1. **`src/app/api/databases/articles/route.ts`** (lines 177-231)
   - Remove the `articles` table query (lines 177-200)
   - Remove the `secondary_articles` table query (lines 208-231)
   - Keep and rely on the existing `module_articles` query (lines 237+)
   - Consolidate response format to use module articles only

2. **`src/app/api/campaigns/[id]/articles/reorder/route.ts`**
   - Currently updates `articles.rank` (line 29)
   - Change to: update `module_articles.rank`
   - Note: this route may need the `article_module_id` context for proper scoping

3. **`src/app/api/articles/[id]/skip/route.ts`**
   - Reads/writes `articles` table (lines 13, 37)
   - Change to: read/write `module_articles`

4. **`src/app/api/secondary-articles/[id]/skip/route.ts`** and **`toggle/route.ts`**
   - Read/write `secondary_articles` table
   - Change to: read/write `module_articles` or remove if functionality is covered by module article routes

5. **`src/app/api/campaigns/[id]/send-review/route.ts`** (lines 92-105)
   - Updates `articles.review_position` (line 96)
   - Change to: update `module_articles.review_position`
   - The `send-final` route (line 40) already updates `module_articles.final_position` -- no change needed there

6. **`src/app/api/campaigns/[id]/delete/route.ts`** (lines 45, 56)
   - Deletes from `articles` and `secondary_articles`
   - Change to: delete from `module_articles` (or keep the existing `module_articles` delete at line 67 and remove the legacy ones)

7. **`src/app/api/campaigns/[id]/cleanup-duplicates/route.ts`**
   - References both `articles` and `secondary_articles` tables
   - Change to: operate on `module_articles`

8. **`src/app/api/rss/combined-steps/step5-generate-headlines.ts`** (line 21)
   - Reads `secondary_articles`
   - Change to: read `module_articles`

9. **`src/app/api/rss/combined-steps/step6-select-subject.ts`** (line 23)
   - Reads `secondary_articles`
   - Change to: read `module_articles`

10. **`src/app/api/rss/combined-steps/step10-unassign-unused.ts`** (line 32)
    - Reads `secondary_articles`
    - Change to: read `module_articles`

11. **`src/app/api/cron/trigger-workflow/route.ts`** (line 48)
    - Reads `articles`
    - Change to: read `module_articles`

12. **`src/app/api/cron/send-secondary/route.ts`** (line 134)
    - Reads `articles` with `final_position`
    - Change to: read `module_articles` with `final_position`

13. **`src/app/api/rss/steps/archive/route.ts`** (line 57) and **`generate-articles/route.ts`** (line 49)
    - Reference `secondary_articles`
    - Change to: reference `module_articles`

14. **`src/app/website/newsletter/[date]/page.tsx`** (lines 149, 355)
    - Conditional logic around `primary_articles`/`secondary_articles` section types
    - Change to: skip legacy section types entirely (article modules handle rendering)

15. **`src/components/issue-detail/BreakingNewsSection.tsx`**
    - References `breaking_news_category` and `breaking_news_score` -- these come from the issue detail page which fetches article data
    - Verify this component reads from the correct source (likely passed as props from the issue page)

16. **Debug handlers** (`src/app/api/debug/handlers/`):
    - `ai.ts` (lines 149, 161): reads `articles`
    - `campaign.ts` (lines 42, 81, 98, 313-349, 381, 1009): reads `articles`, references `review_position`/`final_position`
    - `checks.ts` (lines 270, 864, 870, 876, 881, 1206, 1520, 1641, 1904, 2088): reads `articles` and `secondary_articles`
    - `media.ts` (lines 89, 136): reads `articles`
    - `rss.ts` (lines 443, 525, 703): reads `articles`
    - Change all to: read from `module_articles` with appropriate column lists
    - These are debug endpoints so lower risk, but high volume of changes

**Rollback:** Revert code changes. Legacy tables still exist with historical data.

**Verification:**
- `npm run build` and `npm run type-check` pass
- Dashboard articles page loads correctly on staging
- Issue detail page shows articles with correct positions
- Debug endpoints return data
- Article skip/toggle actions work from the dashboard
- Reorder action updates `module_articles.rank`

---

### Phase 4: Migrate Archiving

**Goal:** Archiving reads from `module_articles` and preserves module-specific fields.

**Files to modify:**

1. **`src/lib/article-archive.ts`**
   - `archiveArticles()` (line 58) reads from `articles` table with `select('*')` -- this violates the no-select-star rule and must be fixed
   - Change to: read from `module_articles` with explicit column list
   - Add module-specific columns to the archive data: `article_module_id`, `ai_image_url`, `image_alt`, `trade_image_url`, `trade_image_alt`, `ticker`, `member_name`, `transaction_type`

2. **`archived_articles` table schema** (database migration required)
   - Add columns: `article_module_id UUID`, `ai_image_url TEXT`, `image_alt TEXT`, `trade_image_url TEXT`, `trade_image_alt TEXT`, `ticker TEXT`, `member_name TEXT`, `transaction_type TEXT`
   - All nullable with no defaults (historical archived data will have NULLs for these)
   - Migration file: `db/migrations/YYYYMMDD_add_module_fields_to_archived_articles.sql`

3. **`src/lib/newsletter-archiver.ts`** (lines 37-82)
   - Reads from `articles` (line 38) and `secondary_articles` (line 64)
   - Change to: read from `module_articles` only, grouped by `article_module_id`
   - Include module-specific fields in the archive payload

4. **`src/types/database.ts`**
   - Update `ArchivedArticle` interface to include the new module-specific fields
   - All new fields nullable

**Rollback:** Revert code. The `archived_articles` schema change is additive (new nullable columns), so it does not need rollback. Historical archived data is unaffected.

**Verification:**
- Run archiving on staging for a recent issue
- Verify `archived_articles` contains module-specific fields
- Verify historical archived data is still accessible (NULLs for new fields)
- Verify newsletter archiver produces correct HTML structure

---

### Phase 5: Cleanup and Table Drop

**Goal:** Remove all remaining legacy code and drop the `articles` and `secondary_articles` tables.

**Pre-requisite check:** Run a grep across the entire codebase to confirm zero references to `'articles'` table (excluding `module_articles`, `archived_articles`, `manual_articles`) and zero references to `'secondary_articles'`.

**Files to modify:**

1. **`src/types/database.ts`**
   - Remove `Article` interface
   - Remove `SecondaryArticle` interface
   - Keep `ModuleArticle` and `ArchivedArticle`

2. **`src/lib/rss-processor/article-selector.ts`**
   - Remove the entire file if all functionality has been migrated to `module-articles.ts` and `article-module-selector.ts`
   - Or gut the file to only contain module-articles-compatible logic

3. **`src/lib/rss-processor/article-generator.ts`**
   - Remove legacy `generateNewsletterArticles()` if all generation is handled by `module-articles.ts`
   - Keep the class if `ModuleArticles` still depends on it as a dependency (constructor injection)

4. **`src/app/api/secondary-articles/` directory**
   - Remove entirely (skip and toggle routes for secondary articles)

5. **`src/app/api/campaigns/[id]/secondary-articles/` directory**
   - Remove reorder route for secondary articles

6. **`src/components/ad-modules/SectionsPanel.tsx`** (line 416)
   - Remove `'secondary_articles'` from section type list

7. **`src/app/api/databases/manual-articles/route.ts`** (line 79) and **`[id]/route.ts`** (line 104)
   - Remove `'secondary_articles'` from allowed `section_type` values
   - Or keep if manual articles can still target different module positions

8. **Database migration: Drop tables**
   - File: `db/migrations/YYYYMMDD_drop_legacy_article_tables.sql`
   - Content:
     ```sql
     -- Only run after confirming zero code references to these tables
     DROP TABLE IF EXISTS secondary_articles CASCADE;
     DROP TABLE IF EXISTS articles CASCADE;
     ```
   - Run on staging first, verify for 1 week, then production

**Rollback:** This is the only phase with a destructive database change. Before dropping tables:
- Take a full backup of both tables
- Verify the backup can be restored
- Keep the backup for 30 days minimum
- The code revert is straightforward (restore deleted files from git)

**Verification:**
- `npm run build` passes
- `npm run type-check` passes
- `npm run lint` passes (with current warning ceiling)
- Full grep: `grep -rn "'articles'" src/` returns zero hits for the legacy table name (exclude `module_articles`, `archived_articles`, `manual_articles`, string literals in UI text)
- Full newsletter workflow on staging: ingest, score, generate, review, send
- Dashboard loads all pages without errors
- Archiving works for new issues
- Historical archived data accessible

---

## Reusable Components

### Existing Code to Leverage

- **`src/lib/rss-processor/module-articles.ts`** -- Already handles all article generation for modules (assign, title, body, fact-check, select). This is the target write path.
- **`src/lib/article-modules/article-module-selector.ts`** -- Already handles module-level selection with `selectTopArticlesForIssue()` and `selectTopArticlesForModule()`. Has pagination, dedup, and ranking logic.
- **`src/lib/newsletter-templates/articles.ts::generateArticleModuleSection()`** -- Already the active template function. Supports block ordering, trade images, AI images, source images.
- **`src/lib/newsletter-templates/build-snapshot.ts`** -- Already builds issue snapshots from `module_articles` for the full newsletter generator.
- **`src/app/api/cron/send-final/route.ts::logFinalArticlePositions()`** -- Already writes `final_position` to `module_articles` (lines 36-48). No changes needed here.
- **`src/app/api/campaigns/[id]/article-modules/route.ts`** -- Already provides full CRUD for module articles. Can serve as the pattern for migrating other article API routes.

### New Code Required

- **Archived articles schema migration** -- New columns on `archived_articles` to accommodate module-specific fields. Cannot reuse existing schema because the current `archived_articles` was designed for the legacy `articles` table.
- **SendGrid module-articles integration** -- The SendGrid fallback path needs new code to query and render module articles, since it currently assumes the legacy table structure.

## Technical Approach

### Database

- No new tables created
- `module_articles` schema already complete (verified in `create_article_modules_system.sql`)
- `archived_articles` needs additive column migration (8 new nullable columns)
- Final phase drops `articles` and `secondary_articles` tables

### API

- Approximately 30 API route files need table reference changes
- Pattern: replace `.from('articles')` with `.from('module_articles')` and add `.eq('article_module_id', moduleId)` where module scoping is needed
- All modified queries must use explicit column lists and filter by `publication_id` (via issue_id join or direct)

### Frontend

- Dashboard articles page (`/databases/articles`) is a redirect to analytics -- minimal change
- Issue detail page reads from API routes that will be migrated
- `SectionsPanel.tsx` needs `'secondary_articles'` removed from section type list
- Website archive page (`/newsletter/[date]`) needs legacy section type handling removed

### Testing

- Each phase should be verified on staging with a full newsletter cycle
- Debug endpoints serve as integration tests (they query and display article data)
- `npm run build`, `npm run type-check`, `npm run lint` as baseline checks
- Manual verification: send a review email, confirm articles render

## Out of Scope

- Changing the article module system architecture (module definitions, criteria, scoring)
- Adding new article features (e.g., new block types, new AI generation modes)
- Modifying the RSS feed scoring pipeline beyond redirecting write targets
- UI/UX redesign of the dashboard
- Changing the breaking news system (it operates on `rss_posts`, independent of this migration)
- Migrating `manual_articles` (separate system, not part of this migration)

## Data Migration Strategy

No data migration between tables is needed. The reason:

1. `module_articles` has been the active write target for the workflow since the module system was introduced
2. Legacy `articles` and `secondary_articles` contain data for the same issues but are no longer used for rendering (the active `full-newsletter.ts` path reads `module_articles`)
3. Historical data in the legacy tables is preserved in `archived_articles` (from the archiving step that runs at the start of each new issue)
4. After Phase 5, the legacy tables are dropped, but all their data was already archived

If any concern exists about unarchived legacy data, run a one-time verification query before Phase 5:

```sql
-- Find any articles in legacy tables that were never archived
SELECT a.id, a.issue_id, a.headline
FROM articles a
LEFT JOIN archived_articles aa ON aa.original_article_id = a.id
WHERE aa.id IS NULL;
```

If results exist, archive them before proceeding with the table drop.

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Newsletter sends with empty article sections | Medium | High | Phase 2 includes fallback check: if `module_articles` returns 0 articles for an issue, log an error and alert via Slack before sending |
| SendGrid path breaks after deprecated function removal | Low | Medium | Phase 2: test SendGrid path explicitly on staging; the path is rarely used (MailerLite is primary) |
| Debug endpoints break | High | Low | Phase 3: debug endpoints are developer tools; breakage is low-impact and easily caught |
| Archiving loses data | Low | High | Phase 4: compare archived article counts before/after migration on staging; add module-specific fields as nullable to preserve existing data |
| Table drop causes cascade failures | Low | Critical | Phase 5: full grep verification, 1-week staging soak, full backup before production drop |
| Dual-write gap during Phase 1 rollout | Medium | Medium | Deploy Phase 1 during off-hours (not during newsletter send window); verify next morning's issue generates correctly |

## Success Criteria

- Zero references to `articles` or `secondary_articles` tables in application code (excluding test files and migration history)
- Full newsletter workflow (ingest through send) completes successfully using only `module_articles`
- Archived newsletters contain module-specific fields (article_module_id, trade images, ticker)
- `npm run build`, `npm run type-check`, and `npm run lint` all pass
- No increase in error rates in production logs after each phase deployment
- Dashboard article views load in under 2 seconds
- Review and final position tracking works correctly via `module_articles`
