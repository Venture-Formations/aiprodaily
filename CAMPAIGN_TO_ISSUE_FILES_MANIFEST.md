# Campaign → Issue Migration: File Manifest

**Date:** 2025-11-13
**Total Files:** 294 files containing "campaign" terminology

This document lists all files that require updates during the campaign → issue migration, organized by priority and phase.

## Quick Stats

- **Critical API Routes:** 78 files
- **Frontend Pages/Components:** 15 files
- **Library/Service Files:** 32 files
- **Database/Type Files:** 26 files
- **Documentation:** 75 files
- **Debug/Test Files:** 68 files

---

## Phase 1: Documentation Only (Low Risk)

### Primary Documentation
```
CLAUDE.md
README.md
MASTER_TO_MAIN_MIGRATION_PLAN.md
FINAL_MIGRATION_COMPLETE.md
MIGRATION_SUMMARY.md
MIGRATION_NEWSLETTER_TO_PUBLICATION.md
TABLES_WITH_PUBLICATION_ID.md
```

### Documentation Folders

#### docs/workflows/
```
docs/workflows/RSS_PROCESSOR_INTEGRATION_NOTES.md
docs/workflows/RSS_INGESTION_IMPLEMENTATION.md
docs/workflows/rss-processing.md
docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md
```

#### docs/guides/
```
docs/guides/TROUBLESHOOTING_GUIDE.md
docs/guides/SECONDARY_ARTICLES_IMPLEMENTATION_GUIDE.md
docs/guides/NEWSLETTER_ARCHIVE_TO_WEBSITE_IMPLEMENTATION_GUIDE.md
docs/guides/IMPLEMENTATION_COMPLETE_HYBRID_RSS.md
docs/guides/FEATURE_WELCOME_SECTION.md
docs/guides/FEATURE_PUBLIC_NEWSLETTER_ARCHIVE.md
docs/guides/FEATURE_NEWSLETTER_ARCHIVE.md
docs/guides/AI_PROFESSIONAL_NEWSLETTER_PLAN.md
docs/guides/AI_FEATURES_IMPLEMENTATION_COMPLETE.md
docs/guides/AI_APPS_IMPLEMENTATION_GUIDE.md
docs/guides/AFFILIATE_APPS_IMPLEMENTATION.md
```

#### docs/status/
```
docs/status/Untitled-1.md
docs/status/SESSION_PROGRESS.md
docs/status/SESSION_NOTES.md
docs/status/PHASE_1_UPDATES_NEEDED.md
docs/status/MULTI_TENANT_STATUS.md
docs/status/COMPILATION_FIXES_NEEDED.md
docs/status/CLEANUP_RECOMMENDATIONS.md
docs/status/claude-optimized-explained.md
```

#### docs/migrations/
```
docs/migrations/SCHEMA_FIXES_APPLIED.md
docs/migrations/MULTI_TENANT_MIGRATION_GUIDE.md
docs/migrations/MULTI_TENANT_MIGRATION.md
docs/migrations/DATABASE_SETUP_GUIDE.md
docs/migrations/DASHBOARD_MIGRATION_STATUS.md
```

#### docs/other/
```
docs/structure.md
docs/feature-summary.md
docs/troubleshooting/common-issues.md
docs/recipes/quick-actions.md
docs/patterns/backend.md
docs/operations/cron-jobs.md
docs/examples/zod-validation-comparison.md
docs/checklists/TESTING_CHECKLIST.md
docs/checklists/DEPLOYMENT_TASKS.md
docs/architecture/system-overview.md
docs/architecture/PUBLICATION_AS_APP_ARCHITECTURE.md
docs/architecture/FUNCTION_VS_PUBLICATION_BASED.md
docs/architecture/BEST_PRACTICES_REVIEW.md
docs/architecture/ARCHITECTURE_TREE_DIAGRAM.md
docs/reference/ST_CLOUD_SCOOP_REFERENCES.md
```

#### docs/backup_files/
```
docs/backup_files/CLAUDE.md.backup
docs/backup_files/CLAUDE.md.backup2
docs/backup_files/CLAUDE.md.backup3
```

### Claude Configuration

#### .claude/skills/
```
.claude/skills/supabase-database-ops/SKILL.md
.claude/skills/nextjs-api-routes/SKILL.md
.claude/skills/newsletter-campaign-workflow/SKILL.md   ← Rename this skill!
.claude/skills/ai-content-generation/SKILL.md
.claude/skills/skill-rules.json
```

#### .claude/agents/
```
.claude/agents/agent-os/api-engineer.md
.claude/agents/agent-os/backend-verifier.md
.claude/agents/agent-os/database-engineer.md
.claude/agents/agent-os/frontend-verifier.md
.claude/agents/agent-os/implementation-verifier.md
.claude/agents/agent-os/product-planner.md
.claude/agents/agent-os/spec-initializer.md
.claude/agents/agent-os/spec-researcher.md
.claude/agents/agent-os/spec-verifier.md
.claude/agents/agent-os/spec-writer.md
.claude/agents/agent-os/tasks-list-creator.md
.claude/agents/agent-os/testing-engineer.md
.claude/agents/agent-os/ui-designer.md
.claude/agents/feature_documenter.md
```

#### .claude/commands/
```
.claude/commands/agent-os/create-spec.md
.claude/commands/agent-os/implement-spec.md
.claude/commands/agent-os/new-spec.md
.claude/commands/agent-os/plan-product.md
.claude/commands/doc-feature.md
```

#### .claude/settings/
```
.claude/settings.local.json
```

### Agent-OS Documentation
```
agent-os/product/mission.md
agent-os/product/roadmap.md
agent-os/product/tech-stack.md
agent-os/standards/backend/api.md
agent-os/standards/backend/migrations.md
agent-os/standards/backend/models.md
agent-os/standards/backend/queries.md
agent-os/standards/frontend/accessibility.md
agent-os/standards/frontend/components.md
agent-os/standards/frontend/css.md
agent-os/standards/frontend/responsive.md
agent-os/standards/global/coding-style.md
agent-os/standards/global/commenting.md
agent-os/standards/global/conventions.md
agent-os/standards/global/error-handling.md
agent-os/standards/global/tech-stack.md
agent-os/standards/global/validation.md
agent-os/standards/testing/test-writing.md
```

### Other Documentation
```
.cursorrules
claude.md
```

---

## Phase 2: Type Definitions & Interfaces (Medium Risk)

### Critical Type Files
```
src/types/database.ts                    ← PRIMARY - All type definitions
src/types/workflow-states.ts
```

**Changes needed in database.ts:**
- `NewsletterCampaign` → `PublicationIssue` (or just `Issue`)
- `CampaignStatus` → `IssueStatus`
- `CampaignAIAppSelection` → `IssueAIAppSelection`
- `CampaignPromptSelection` → `IssuePromptSelection`
- `CampaignEvent` → `IssueEvent`
- `CampaignVrboSelection` → `IssueVrboSelection`
- `CampaignDiningSelection` → `IssueDiningSelection`
- `CampaignAdvertisement` → `IssueAdvertisement`
- All `campaign_id` → `issue_id` in interfaces
- `campaign_date` → `issue_date`
- `campaign_status` → `issue_status`
- `mailerlite_campaign_id` → `mailerlite_issue_id`

### Validation Schemas
```
src/lib/validation/article-schemas.ts
```

---

## Phase 3: API Routes (High Priority - Production Impact)

### Main Campaign API Routes
```
src/app/api/campaigns/route.ts                              ← List/create
src/app/api/campaigns/create-with-workflow/route.ts        ← Create with workflow
src/app/api/campaigns/[id]/route.ts                        ← Get/update/delete
src/app/api/campaigns/[id]/articles/route.ts               ← Article management
src/app/api/campaigns/[id]/articles/reorder/route.ts
src/app/api/campaigns/[id]/breaking-news/route.ts
src/app/api/campaigns/[id]/cleanup-duplicates/route.ts
src/app/api/campaigns/[id]/delete/route.ts
src/app/api/campaigns/[id]/events/route.ts
src/app/api/campaigns/[id]/generate-subject/route.ts
src/app/api/campaigns/[id]/preview/route.ts
src/app/api/campaigns/[id]/prompt/route.ts
src/app/api/campaigns/[id]/regenerate-welcome/route.ts
src/app/api/campaigns/[id]/reprocess/route.ts
src/app/api/campaigns/[id]/secondary-articles/reorder/route.ts
src/app/api/campaigns/[id]/send-final/route.ts
src/app/api/campaigns/[id]/send-review/route.ts
src/app/api/campaigns/[id]/status/route.ts
src/app/api/campaigns/[id]/subject-line/route.ts
```

**Action:** Rename folder `src/app/api/campaigns/` → `src/app/api/issues/`

### Workflow API Routes
```
src/app/api/workflows/create-campaign/route.ts             ← Rename route
```

### Cron Job Routes
```
src/app/api/cron/create-campaign/route.ts                  ← Rename endpoint
src/app/api/cron/send-review/route.ts
src/app/api/cron/send-final/route.ts
src/app/api/cron/monitor-workflows/route.ts
src/app/api/cron/rss-processing/route.ts
src/app/api/cron/generate-subject/route.ts
src/app/api/cron/ingest-rss/route.ts
src/app/api/cron/trigger-phase2/route.ts
src/app/api/cron/workflow-coordinator/route.ts
src/app/api/cron/process-breaking-news/route.ts
src/app/api/cron/send-newsletter/route.ts
src/app/api/cron/import-metrics/route.ts
```

### Other API Routes Referencing Campaigns
```
src/app/api/articles/[id]/skip/route.ts
src/app/api/articles/manual/route.ts
src/app/api/articles/manual/route-with-zod-example.ts
src/app/api/secondary-articles/[id]/skip/route.ts
src/app/api/secondary-articles/[id]/toggle/route.ts
src/app/api/analytics/[campaign]/route.ts                  ← Rename param
src/app/api/databases/articles/route.ts
src/app/api/newsletters/[slug]/dashboard/route.ts
src/app/api/rss/status/[campaignId]/route.ts              ← Rename param
src/app/api/rss/recent-posts/route.ts
src/app/api/rss-posts/recent/route.ts
src/app/api/settings/slack/route.ts
src/app/api/settings/email/route.ts
src/app/api/ai/test-prompt-multiple/route.ts
src/app/api/test-welcome/route.ts
```

### RSS Processing Routes
```
src/app/api/rss/steps/finalize/route.ts
src/app/api/rss/steps/fetch-feeds/route.ts
src/app/api/rss/steps/extract-articles/route.ts
src/app/api/rss/steps/archive/route.ts
src/app/api/rss/steps/generate-articles/route.ts
src/app/api/rss/steps/score-posts/route.ts
src/app/api/rss/process/route.ts
src/app/api/rss/process-phase1/route.ts
src/app/api/rss/process-phase2/route.ts
src/app/api/rss/combined-steps/step1-archive.ts
src/app/api/rss/combined-steps/step1-archive-fetch.ts
src/app/api/rss/combined-steps/step2-fetch-extract.ts
src/app/api/rss/combined-steps/step2-extract-score.ts
src/app/api/rss/combined-steps/step3-score.ts
src/app/api/rss/combined-steps/step3-generate.ts
src/app/api/rss/combined-steps/step4-deduplicate.ts
src/app/api/rss/combined-steps/step4-finalize.ts
src/app/api/rss/combined-steps/step5-generate-headlines.ts
src/app/api/rss/combined-steps/step6-select-subject.ts
src/app/api/rss/combined-steps/step7-welcome.ts
src/app/api/rss/combined-steps/step8-finalize.ts
src/app/api/rss/combined-steps/step10-unassign-unused.ts
```

---

## Phase 3: Core Library Files (High Priority)

### Workflow Libraries
```
src/lib/workflows/create-campaign-workflow.ts              ← HIGH PRIORITY
src/lib/workflows/process-rss-workflow.ts
src/lib/workflows/reprocess-articles-workflow.ts
```

### Service Libraries
```
src/lib/rss-processor.ts
src/lib/breaking-news-processor.ts
src/lib/schedule-checker.ts
src/lib/openai.ts
src/lib/deduplicator.ts
src/lib/subject-line-generator.ts
src/lib/newsletter-archiver.ts
src/lib/app-selector.ts
src/lib/ad-scheduler.ts
src/lib/welcome-section-generator.ts
src/lib/newsletter-templates.ts
src/lib/article-archive.ts
src/lib/slack.ts
src/lib/mailerlite.ts
src/lib/prompt-selector.ts
src/lib/workflow-state.ts
src/lib/url-tracking.ts
```

---

## Phase 3: Frontend Pages & Components (User-Facing)

### Dashboard Pages
```
src/app/dashboard/[slug]/page.tsx                          ← Dashboard home
src/app/dashboard/[slug]/campaigns/page.tsx                ← List page - RENAME ROUTE
src/app/dashboard/[slug]/campaigns/[id]/page.tsx           ← Detail page - RENAME ROUTE
src/app/dashboard/[slug]/campaigns/new/page.tsx            ← Create page - RENAME ROUTE
src/app/dashboard/[slug]/settings/page.tsx
src/app/dashboard/[slug]/settings/AIPromptTesting/page.tsx
src/app/dashboard/[slug]/databases/articles/page.tsx
src/app/dashboard/[slug]/analytics/page.tsx
```

### Website Pages
```
src/app/website/page.tsx
src/app/website/newsletters/page.tsx
src/app/website/newsletter/[date]/page.tsx
```

### Components
```
src/components/DeleteCampaignModal.tsx                     ← Rename to DeleteIssueModal.tsx
src/components/MobileMenu.tsx
src/components/Layout.tsx
src/components/website/newsletters-list.tsx
src/components/ui/StatusBadge.tsx
src/components/ui/LoadingSkeleton.tsx
src/components/ui/index.ts
```

### Backup Files
```
src/app/dashboard/[slug]/settings/page.tsx.backup-ui
src/app/website/newsletter/[date]/page.tsx.backup
src/lib/openai.ts.backup
```

---

## Phase 4: Debug Routes (Lower Priority)

### Debug Campaign Routes
```
src/app/api/debug/(campaign)/activate-articles/route.ts
src/app/api/debug/(campaign)/archive-campaign/route.ts
src/app/api/debug/(campaign)/archived-articles/route.ts
src/app/api/debug/(campaign)/assign-test-ad/route.ts
src/app/api/debug/(campaign)/campaign-articles/route.ts
src/app/api/debug/(campaign)/complete-campaign/route.ts
src/app/api/debug/(campaign)/init-newsletter-archives/route.ts
src/app/api/debug/(campaign)/manual-review-send/route.ts
src/app/api/debug/(campaign)/recent-campaigns/route.ts
src/app/api/debug/(campaign)/reset-campaign/route.ts
src/app/api/debug/(campaign)/setup-secondary-articles/route.ts
src/app/api/debug/(campaign)/tomorrow-campaign/route.ts
```

**Action:** Rename folder `src/app/api/debug/(campaign)/` → `src/app/api/debug/(issue)/`

### Debug Check Routes
```
src/app/api/debug/(checks)/check-ai-apps-selection/route.ts
src/app/api/debug/(checks)/check-app-selections/route.ts
src/app/api/debug/(checks)/check-article-failures/route.ts
src/app/api/debug/(checks)/check-campaign-ad/route.ts
src/app/api/debug/(checks)/check-campaign-data/route.ts
src/app/api/debug/(checks)/check-campaign-dates/route.ts
src/app/api/debug/(checks)/check-campaign-ids/route.ts
src/app/api/debug/(checks)/check-campaign-relations/route.ts
src/app/api/debug/(checks)/check-campaign-schedule/route.ts
src/app/api/debug/(checks)/check-dates/route.ts
src/app/api/debug/(checks)/check-deduplication/route.ts
src/app/api/debug/(checks)/check-last-run/route.ts
src/app/api/debug/(checks)/check-latest-campaign/route.ts
src/app/api/debug/(checks)/check-latest-rss-run/route.ts
src/app/api/debug/(checks)/check-logs/route.ts
src/app/api/debug/(checks)/check-low-article-alerts/route.ts
src/app/api/debug/(checks)/check-openai-posts/route.ts
src/app/api/debug/(checks)/check-positions/route.ts
src/app/api/debug/(checks)/check-posts/route.ts
src/app/api/debug/(checks)/check-prompts/route.ts
src/app/api/debug/(checks)/check-secondary-articles/route.ts
src/app/api/debug/(checks)/check-skip-column/route.ts
src/app/api/debug/(checks)/check-system-logs/route.ts
src/app/api/debug/(checks)/verify-ai-features/route.ts
src/app/api/debug/(checks)/verify-multitenant/route.ts
```

### Debug Test Routes
```
src/app/api/debug/(tests)/test-ad-selection/route.ts
src/app/api/debug/(tests)/test-affiliate-selection/route.ts
src/app/api/debug/(tests)/test-ai-criteria/route.ts
src/app/api/debug/(tests)/test-app-selection/route.ts
src/app/api/debug/(tests)/test-article-generation/route.ts
src/app/api/debug/(tests)/test-breaking-news/route.ts
src/app/api/debug/(tests)/test-deduper/route.ts
src/app/api/debug/(tests)/test-mailerlite.route.ts
src/app/api/debug/(tests)/test-mailerlite-campaign/route.ts
src/app/api/debug/(tests)/test-mailerlite-review/route.ts
src/app/api/debug/(tests)/test-mailerlite-schedule/route.ts
src/app/api/debug/(tests)/test-mailerlite-schedule-format/route.ts
src/app/api/debug/(tests)/test-manual-app-selection/route.ts
src/app/api/debug/(tests)/test-new-deduplicator/route.ts
src/app/api/debug/(tests)/test-reorder/route.ts
src/app/api/debug/(tests)/test-status-update/route.ts
src/app/api/debug/(tests)/test-subject-generation/route.ts
```

### Debug Maintenance Routes
```
src/app/api/debug/(maintenance)/add-phase2-statuses/route.ts
src/app/api/debug/(maintenance)/fix-oct-8-featured/route.ts
src/app/api/debug/(maintenance)/fix-tomorrow-campaign/route.ts
src/app/api/debug/(maintenance)/reset-app-usage/route.ts
src/app/api/debug/(maintenance)/reset-deduplication/route.ts
```

### Debug Other Routes
```
src/app/api/debug/(ai)/ai-apps-status/route.ts
src/app/api/debug/(ai)/force-ai-apps/route.ts
src/app/api/debug/(ai)/manual-select-apps/route.ts
src/app/api/debug/(integrations)/mailerlite-campaign-debug/route.ts
src/app/api/debug/(integrations)/mailerlite-test/route.ts
src/app/api/debug/(rss)/backfill-full-text/route.ts
src/app/api/debug/(rss)/rss-images/route.ts
src/app/api/debug/(rss)/rss-posts-count/route.ts
src/app/api/debug/(rss)/rss-status/route.ts
src/app/api/debug/(rss)/trace-rss-processing/route.ts
src/app/api/debug/(media)/images/route.ts
src/app/api/debug/(media)/process-images/route.ts
src/app/api/debug/README.md
src/app/api/debug/add-phase2-statuses/route.ts
```

---

## Phase 4: Database Migration Files

### SQL Migration Files
```
db/migrations/CAMPAIGN_TO_ISSUE_MIGRATION.sql              ← NEW - Run this
db/migrations/CAMPAIGN_TO_ISSUE_MIGRATION_ROLLBACK.sql    ← NEW - Emergency rollback

db/migrations/fix_campaign_id_default.sql                  ← Update references
db/migrations/hybrid_rss_processing.sql
db/migrations/database_complete_schema.sql
db/migrations/database_diagnostic.sql
db/migrations/database_migration_workflow_state.sql
db/migrations/database_migration_secondary_articles.sql
db/migrations/database_rss_feeds_migration.sql
db/migrations/database_cleanup.sql
db/migrations/database_ai_features_schema.sql
db/migrations/update_welcome_to_three_columns.sql
db/migrations/add_welcome_section.sql
db/migrations/add_secondary_articles_column.sql
db/migrations/add_phase2_statuses.sql
db/migrations/add_criteria_scoring_columns.sql
db/migrations/create_deduplication_tables.sql
db/migrations/check_actual_types.sql
db/migrations/check-duplicates.sql
db/migrations/fix_duplicate_tables.sql
db/migrations/rename_newsletters_to_publications.sql       ← Reference for pattern
```

---

## Phase 5: Scripts & Maintenance

### Maintenance Scripts
```
scripts/maintenance/check-campaign-structure.js            ← Rename to check-issue-structure.js
scripts/maintenance/verify-database.js
scripts/maintenance/check-ai-features.js
scripts/maintenance/check-column-types.js
scripts/maintenance/check-database-types.js
scripts/maintenance/list-all-tables.js
scripts/maintenance/simple-table-check.js
scripts/maintenance/secure-debug-routes.js
```

### Test Scripts
```
scripts/tests/test-ad-assign.js
scripts/tests/test-nightly-batch.sh
scripts/tests/test-supabase-connection.js
```

---

## Phase 6: Configuration Files

### Vercel Configuration
```
vercel.json                                                ← Update cron paths
vercel.json.backup
```

### Test Data Files
```
campaign-data.json                                         ← Rename to issue-data.json
campaign-test.json                                         ← Rename to issue-test.json
```

---

## Search & Replace Patterns

### Database Queries
```javascript
// Old
.from('newsletter_campaigns')

// New
.from('publication_issues')
```

### Column References
```javascript
// Old
campaign_id
campaign_date
campaign_status
mailerlite_campaign_id

// New
issue_id
issue_date
issue_status
mailerlite_issue_id
```

### Type Names
```typescript
// Old
Campaign
CampaignStatus
NewsletterCampaign
CampaignAIAppSelection
CampaignPromptSelection

// New
Issue
IssueStatus
PublicationIssue (or just Issue)
IssueAIAppSelection
IssuePromptSelection
```

### Function Names
```typescript
// Old
createCampaign()
getCampaignById()
updateCampaign()
deleteCampaign()

// New
createIssue()
getIssueById()
updateIssue()
deleteIssue()
```

### URL Paths
```
// Old
/dashboard/[slug]/campaigns
/api/campaigns
/api/workflows/create-campaign

// New
/dashboard/[slug]/issues
/api/issues
/api/workflows/create-issue
```

### Component Names
```
// Old
DeleteCampaignModal

// New
DeleteIssueModal
```

---

## Excluded Files (No Changes Needed)

### Node Modules (AWS SDK)
These files contain "campaign" but are third-party code - DO NOT MODIFY:
```
node_modules/@aws-sdk/client-sesv2/dist-es/commands/GetDomainDeliverabilityCampaignCommand.js
node_modules/@aws-sdk/client-sesv2/dist-es/commands/ListDomainDeliverabilityCampaignsCommand.js
node_modules/@aws-sdk/client-sesv2/dist-es/pagination/ListDomainDeliverabilityCampaignsPaginator.js
(and related TypeScript definition files)
```

---

## Migration Checklist by File Type

### ✅ Documentation (75 files)
- [ ] Update all markdown files
- [ ] Update Claude skills and agents
- [ ] Update command files
- [ ] Update standards documentation

### ✅ Types & Interfaces (2 files)
- [ ] src/types/database.ts - All interfaces
- [ ] src/types/workflow-states.ts

### ✅ API Routes (78 files)
- [ ] Rename /campaigns folder to /issues
- [ ] Update all route handlers
- [ ] Update cron job endpoints
- [ ] Update workflow endpoints
- [ ] Update RSS processing routes

### ✅ Libraries (32 files)
- [ ] Update all workflow files
- [ ] Update all service libraries
- [ ] Update function names
- [ ] Update variable names

### ✅ Frontend (15 files)
- [ ] Rename campaign routes to issue routes
- [ ] Update page components
- [ ] Rename DeleteCampaignModal
- [ ] Update UI labels

### ✅ Debug Routes (68 files)
- [ ] Rename debug/(campaign) folder
- [ ] Update all debug routes
- [ ] Update test routes

### ✅ Database (26 files)
- [ ] Run CAMPAIGN_TO_ISSUE_MIGRATION.sql
- [ ] Verify data integrity
- [ ] Update migration reference docs

### ✅ Scripts (8 files)
- [ ] Update maintenance scripts
- [ ] Update test scripts
- [ ] Rename campaign-*.json files

### ✅ Configuration (2 files)
- [ ] Update vercel.json cron paths
- [ ] Verify redirects in next.config.js

---

## Automated Search Commands

### Find all campaign references
```bash
grep -r "campaign" --include="*.ts" --include="*.tsx" --include="*.js" src/
```

### Find newsletter_campaigns table references
```bash
grep -r "newsletter_campaigns\|campaign_id" --include="*.ts" --include="*.tsx" src/
```

### Find Campaign types
```bash
grep -r "Campaign[A-Z]\|: Campaign\|<Campaign" --include="*.ts" --include="*.tsx" src/
```

### Find campaign routes
```bash
find src/app -type d -name "*campaign*"
```

---

## Post-Migration Verification

### Database Checks
```sql
-- Verify table renamed
SELECT * FROM publication_issues LIMIT 1;

-- Verify foreign keys
SELECT COUNT(*) FROM articles WHERE issue_id IS NOT NULL;

-- Check for orphaned records
SELECT COUNT(*) FROM articles a
LEFT JOIN publication_issues i ON a.issue_id = i.id
WHERE i.id IS NULL;
```

### TypeScript Checks
```bash
npm run type-check
npm run lint
```

### Runtime Checks
```bash
# Test API endpoints
curl http://localhost:3000/api/issues
curl http://localhost:3000/api/workflows/create-issue

# Check redirects
curl -I http://localhost:3000/api/campaigns  # Should redirect to /api/issues
```

---

## Estimated Migration Time

| Phase | Duration | Risk |
|-------|----------|------|
| Phase 1: Documentation | 2-3 hours | Low |
| Phase 2: Types | 1 hour | Medium |
| Phase 3: Code (API + Lib + UI) | 8-12 hours | Medium-High |
| Phase 4: Database | 30 mins | High |
| Testing & Verification | 4-6 hours | N/A |
| **Total** | **2-3 days** | **Variable** |

---

**Last Updated:** 2025-11-13
**Status:** Planning Phase
**Next Step:** Begin Phase 1 (Documentation Updates)
