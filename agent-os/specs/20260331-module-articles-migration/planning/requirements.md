---
name: module-articles-migration-requirements
created: 2026-03-31T13:42:40Z
updated: 2026-03-31T13:42:40Z
---

# Requirements: Complete module_articles Migration

## Problem Statement
The newsletter article system has a partially-completed migration from legacy tables (`articles`, `secondary_articles`) to the module-based system (`module_articles`). Both systems run in parallel:

- **Dual writes**: Workflow step3 still inserts into legacy `articles`; module-articles.ts writes to `module_articles` separately
- **Dual reads**: Template rendering has 3 functions — 1 active (module_articles), 2 deprecated but still functional (articles, secondary_articles)
- **Schema gaps**: module_articles lacks `review_position`, `final_position`, `breaking_news_score`, `breaking_news_category`
- **Archiving gap**: secondary_articles not individually archived
- **~158 code references** across the 3 tables

## Current State (from codebase analysis)

### Legacy articles table (56 references)
- Written by: `rss-processor/article-selector.ts`, `article-generator.ts`, combined-steps/step3
- Read by: dashboard articles page, newsletter templates (deprecated functions), archiving, 10+ debug endpoints
- Schema: id, post_id, issue_id, headline, content, rank, is_active, skipped, fact_check_score, fact_check_details, word_count, review_position, final_position, breaking_news_score, breaking_news_category, ai_summary, ai_title

### Legacy secondary_articles table (29 references)
- Written by: `article-selector.ts::selectTopSecondaryArticles()`, combined-steps/step1 (DELETE)
- Read by: newsletter templates (deprecated), dashboard, debug endpoints
- Schema: identical to articles

### module_articles table (73 references)
- Written by: `rss-processor/module-articles.ts` (assignPostsToModule, generateTitlesForModule, generateBodiesForModule, factCheckArticlesForModule, selectTopArticlesForModule)
- Read by: newsletter templates (active), RSS feed generator, dashboard, workflows, subject/welcome generators, archiving
- Schema: adds article_module_id, ai_image_url, image_alt, trade_image_url, trade_image_alt, ticker, member_name, transaction_type; lacks review_position, final_position, breaking_news_*

### Newsletter Template Rendering
- `generateArticleModuleSection()` — ACTIVE, reads module_articles
- `generatePrimaryArticlesSection()` — DEPRECATED, reads articles
- `generateSecondaryArticlesSection()` — DEPRECATED, reads secondary_articles
- No feature flag or conditional logic — decision based on which table has data

### Archiving
- `ArticleArchiveService` archives from `articles` table only (not module_articles)
- `NewsletterArchiver` archives from all 3 tables into full newsletter HTML
- secondary_articles never individually archived — data integrity risk

### Workflow Pipeline
```
step1-archive → step2-extract-score → step3-generate → step4-finalize →
step5-headlines → step6-subject → step7-welcome → step8-finalize → step10-cleanup
```
Step3 still writes to legacy `articles` table.
Module articles are generated in parallel by process-rss-workflow.ts.

## Functional Requirements

### FR1: Schema Alignment
- Add missing columns to module_articles: `review_position`, `final_position`, `breaking_news_score`, `breaking_news_category`
- These must be nullable with sensible defaults
- No changes to module_articles unique features (article_module_id, trade images, financial metadata)

### FR2: Unified Write Path
- All article generation must write to module_articles only
- combined-steps/step3 must use module-articles.ts instead of legacy insert
- Article selection, scoring, fact-checking all target module_articles
- Breaking news detection must populate module_articles.breaking_news_score

### FR3: Unified Read Path
- Newsletter template rendering uses only generateArticleModuleSection()
- Remove deprecated generatePrimaryArticlesSection() and generateSecondaryArticlesSection()
- Dashboard articles page reads from module_articles only
- All API routes that read articles use module_articles

### FR4: Archiving Migration
- ArticleArchiveService must archive from module_articles
- Ensure archived_articles schema can accommodate module_articles fields
- Historical archived data (from legacy articles) must remain accessible

### FR5: Dashboard Reordering
- Implement review_position/final_position support in module_articles
- Dashboard must allow reordering articles within each module
- API routes for reorder must target module_articles

### FR6: Breaking News
- Breaking news scoring must work with module_articles
- breaking_news_score and breaking_news_category columns used by selection logic
- issue_breaking_news table references must be compatible

### FR7: Cleanup
- Remove all legacy articles/secondary_articles INSERT/SELECT code
- Remove deprecated template functions
- Remove legacy debug endpoints
- Drop articles and secondary_articles tables (final step, after verification)
- Update TypeScript types in src/types/database.ts

## Non-Functional Requirements

### NFR1: Zero Downtime
- Migration must not disrupt daily newsletter production
- Each phase deployable independently
- Rollback strategy for each phase

### NFR2: Data Integrity
- No article data loss during transition
- Historical archived data preserved
- All existing module_articles data unaffected

### NFR3: Multi-Tenant Isolation
- All queries must maintain publication_id filtering
- Module-level isolation preserved

## Out of Scope
- Changing the module system architecture itself
- Adding new article features
- Modifying the RSS feed scoring pipeline (beyond write target changes)
- UI/UX redesign of the dashboard articles page

## Dependencies
- module_articles table must be the active write target before reads migrate
- Template rendering migration depends on all content being in module_articles
- Table drop depends on all code references being removed
- archived_articles schema must be updated before archiving migration

## Risks
- **Dual-write gap**: During transition, some articles may only exist in one table
- **Template rendering**: If module_articles is empty for an issue, newsletter would have no articles
- **Breaking news**: Feature may be partially broken during migration if not handled carefully
- **Dashboard**: Users may see inconsistent article data during transition
