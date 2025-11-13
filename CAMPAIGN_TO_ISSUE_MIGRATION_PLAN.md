# Campaign → Issue Migration Plan

**Status:** Planning Phase
**Created:** 2025-11-13
**Estimated Timeline:** 3-5 days (phased approach)

## Executive Summary

Migrate from "Campaign" terminology to "Issue" terminology across the entire codebase to align with industry-standard newsletter/publication nomenclature. This follows the successful completion of the `newsletter` → `publication` migration.

### Terminology Change

| Old Term | New Term | Reason |
|----------|----------|--------|
| Campaign | Issue | Industry standard for dated newsletter editions |
| newsletter_campaigns (table) | publication_issues | Clearer hierarchy and naming |
| campaign_id | issue_id | Consistency with new naming |
| /campaigns (URLs) | /issues | User-facing clarity |

## Scope Analysis

**Total Files Affected:** 294 files contain "campaign" terminology

### Breakdown by Category:

1. **Database Layer** (26 files)
   - Migration files: `db/migrations/*campaign*.sql`
   - Schema definitions: `src/types/database.ts`
   - Table: `newsletter_campaigns` → `publication_issues`

2. **API Routes** (78 files)
   - `/api/campaigns/*` → `/api/issues/*`
   - `/api/workflows/create-campaign` → `/api/workflows/create-issue`
   - `/api/cron/create-campaign` → `/api/cron/create-issue`

3. **Frontend/UI** (15 files)
   - `src/app/dashboard/[slug]/campaigns/*` → `/issues/*`
   - `src/components/DeleteCampaignModal.tsx` → `DeleteIssueModal.tsx`
   - All UI labels and text

4. **Libraries/Services** (32 files)
   - `src/lib/workflows/create-campaign-workflow.ts`
   - `src/lib/mailerlite.ts` (function names)
   - `src/lib/newsletter-archiver.ts`

5. **Documentation** (75 files)
   - All markdown files in `docs/*`
   - Claude agent prompts in `.claude/*`
   - README files

6. **Scripts/Maintenance** (5 files)
   - `scripts/maintenance/check-campaign-structure.js`
   - Test scripts

7. **Debug/Test Routes** (63 files)
   - `src/app/api/debug/(campaign)/*`
   - All test routes

## Migration Phases

### Phase 1: Low-Risk User-Facing Changes (Day 1-2)
**Goal:** Update UI labels and documentation without breaking functionality

#### 1.1 Documentation Updates
- [ ] Update all markdown files in `docs/`
- [ ] Update Claude skills in `.claude/skills/`
- [ ] Update CLAUDE.md guide
- [ ] Update README.md
- [ ] Create this migration plan document

#### 1.2 UI Labels Only (No Code Changes)
- [ ] Dashboard page titles and headings
- [ ] Button labels ("Create New Campaign" → "Create New Issue")
- [ ] Table column headers
- [ ] Status badge labels
- [ ] Form field labels
- [ ] Breadcrumb navigation
- [ ] Modal dialog titles

**Testing:** Manual UI review only, no functional changes

**Rollback:** Simple - revert text changes

---

### Phase 2: Code-Level Changes (Day 3-4)
**Goal:** Update TypeScript interfaces, function names, and component names

#### 2.1 Type Definitions
- [ ] Update `src/types/database.ts`
  - `Campaign` → `Issue` interface
  - `campaign_id` → `issue_id` in types
  - `newsletter_campaigns` → `publication_issues` in types
  - Keep old types as deprecated aliases temporarily

```typescript
// Deprecated aliases for backwards compatibility (Phase 2)
/** @deprecated Use Issue instead */
export type Campaign = Issue;

/** @deprecated Use issue_id instead */
export type CampaignId = IssueId;
```

#### 2.2 Component Renames
- [ ] `DeleteCampaignModal.tsx` → `DeleteIssueModal.tsx`
- [ ] Update imports across all pages
- [ ] Update component props interfaces

#### 2.3 Function & Variable Names (Code Only)
- [ ] `createCampaign()` → `createIssue()`
- [ ] `getCampaignById()` → `getIssueById()`
- [ ] `updateCampaign()` → `updateIssue()`
- [ ] `deleteCampaign()` → `deleteIssue()`
- [ ] All local variables: `campaign` → `issue`
- [ ] All constants: `CAMPAIGN_*` → `ISSUE_*`

#### 2.4 API Routes (Keep Old Database Names)
Update route handlers while still querying old table names:

- [ ] Rename route folders:
  - `src/app/api/campaigns/` → `src/app/api/issues/`
  - Keep old routes as redirects temporarily
- [ ] Update route handlers internally
- [ ] Keep database queries unchanged (still uses `newsletter_campaigns`)
- [ ] Add API versioning/redirects from old endpoints

**Testing:**
- [ ] `npm run type-check` must pass
- [ ] All unit tests must pass
- [ ] Integration tests for API routes
- [ ] Manual testing of CRUD operations

**Rollback:** Git revert, database unchanged so safe

---

### Phase 3: URL & Route Updates (Day 4-5)
**Goal:** Update user-facing URLs with proper redirects

#### 3.1 Frontend Routes
- [ ] `dashboard/[slug]/campaigns` → `dashboard/[slug]/issues`
- [ ] `dashboard/[slug]/campaigns/[id]` → `dashboard/[slug]/issues/[id]`
- [ ] `dashboard/[slug]/campaigns/new` → `dashboard/[slug]/issues/new`

#### 3.2 API Route Paths
- [ ] `/api/campaigns/*` → `/api/issues/*`
- [ ] `/api/workflows/create-campaign` → `/api/workflows/create-issue`
- [ ] `/api/cron/create-campaign` → `/api/cron/create-issue`

#### 3.3 Redirects (Critical!)
Add to `next.config.js`:

```javascript
async redirects() {
  return [
    {
      source: '/dashboard/:slug/campaigns',
      destination: '/dashboard/:slug/issues',
      permanent: true,
    },
    {
      source: '/dashboard/:slug/campaigns/:id',
      destination: '/dashboard/:slug/issues/:id',
      permanent: true,
    },
    {
      source: '/api/campaigns/:path*',
      destination: '/api/issues/:path*',
      permanent: false, // Use temporary redirect during migration
    },
  ];
}
```

#### 3.4 Update External References
- [ ] Update any bookmarks/documentation shared externally
- [ ] Update Vercel cron job configurations
- [ ] Update any webhooks or external integrations
- [ ] Update MailerLite references if any

**Testing:**
- [ ] Verify old URLs redirect properly
- [ ] Test all navigation flows
- [ ] Check external integrations still work
- [ ] Verify cron jobs trigger correctly

**Rollback:** Update redirects to reverse direction

---

### Phase 4: Database Migration (Day 5 - HIGH RISK)
**Goal:** Rename database tables and columns

#### 4.1 Pre-Migration Checklist
- [ ] **CRITICAL:** Full database backup
- [ ] Export all data from `newsletter_campaigns` table
- [ ] Test migration script on staging database first
- [ ] Verify all foreign key relationships
- [ ] Document rollback procedure
- [ ] Schedule maintenance window (low-traffic period)
- [ ] Notify users of maintenance

#### 4.2 Database Changes

**Tables to Rename:**
- `newsletter_campaigns` → `publication_issues`

**Columns to Rename Across All Tables:**
- `campaign_id` → `issue_id` (in all tables with foreign keys)

**Tables with Foreign Keys:**
- `articles` (campaign_id → issue_id)
- `secondary_articles` (campaign_id → issue_id)
- `ai_apps_selection` (campaign_id → issue_id)
- `advertisements_assignment` (campaign_id → issue_id)
- `archived_newsletters` (campaign_id → issue_id)
- `breaking_news` (campaign_id → issue_id)
- `campaign_analytics` (campaign_id → issue_id)
- `link_tracking` (campaign_id → issue_id)
- `polls` (campaign_id → issue_id)

#### 4.3 Migration Script Execution Order
See `CAMPAIGN_TO_ISSUE_MIGRATION.sql` for detailed script

1. Drop dependent views (if any)
2. Rename foreign key columns (working from child → parent)
3. Rename main table
4. Recreate foreign key constraints
5. Update indexes
6. Verify data integrity

#### 4.4 Code Updates for Database
- [ ] Update all `.from('newsletter_campaigns')` → `.from('publication_issues')`
- [ ] Update all column references `campaign_id` → `issue_id`
- [ ] Remove deprecated type aliases from Phase 2
- [ ] Update all SQL queries in library files
- [ ] Update Supabase type generation

#### 4.5 Post-Migration Verification
- [ ] Run verification queries to ensure data integrity
- [ ] Check all foreign key relationships
- [ ] Verify row counts match pre-migration
- [ ] Test CRUD operations
- [ ] Run full test suite
- [ ] Monitor error logs for 24 hours

**Testing:**
- [ ] Full regression testing
- [ ] End-to-end workflow testing (RSS → Issue creation → Send)
- [ ] Test all cron jobs
- [ ] Verify MailerLite integration
- [ ] Check all admin dashboard functions

**Rollback Plan:**
- Database rollback script prepared (reverse all renames)
- Restore from backup if data integrity issues
- Revert code changes via git
- Estimated rollback time: 15-30 minutes

---

## Risk Assessment

| Phase | Risk Level | Impact if Fails | Mitigation |
|-------|-----------|-----------------|------------|
| Phase 1 | 🟢 Low | UI text only | Simple text revert |
| Phase 2 | 🟡 Medium | Type errors, broken builds | Full test suite, staging deploy |
| Phase 3 | 🟡 Medium | Broken links, 404s | Redirects + testing |
| Phase 4 | 🔴 High | Data loss, downtime | Full backup, staging test, rollback script |

## Files Requiring Updates

### Critical Files (Must Update)

#### Database Schema
- `src/types/database.ts` - Main type definitions
- `db/migrations/*.sql` - All migration files

#### Core API Routes
- `src/app/api/campaigns/route.ts`
- `src/app/api/campaigns/[id]/route.ts`
- `src/app/api/campaigns/[id]/*` (15 routes)
- `src/app/api/campaigns/create-with-workflow/route.ts`
- `src/app/api/workflows/create-campaign/route.ts`

#### Cron Jobs
- `src/app/api/cron/create-campaign/route.ts`
- `src/app/api/cron/send-review/route.ts`
- `src/app/api/cron/send-final/route.ts`
- `src/app/api/cron/monitor-workflows/route.ts`

#### Core Libraries
- `src/lib/workflows/create-campaign-workflow.ts`
- `src/lib/mailerlite.ts` - createCampaign function
- `src/lib/slack.ts` - notification messages
- `src/lib/newsletter-archiver.ts`
- `src/lib/article-archive.ts`

#### Frontend Pages
- `src/app/dashboard/[slug]/campaigns/page.tsx`
- `src/app/dashboard/[slug]/campaigns/[id]/page.tsx`
- `src/app/dashboard/[slug]/campaigns/new/page.tsx`
- `src/app/dashboard/[slug]/page.tsx` - Dashboard home

#### Components
- `src/components/DeleteCampaignModal.tsx`
- `src/components/ui/StatusBadge.tsx`

### Debug/Test Files (Lower Priority)
- `src/app/api/debug/(campaign)/*` (13 files)
- `src/app/api/debug/(tests)/*campaign*` (8 files)
- `scripts/maintenance/check-campaign-structure.js`

### Documentation Files (Phase 1)
- `CLAUDE.md`
- `README.md`
- All files in `docs/` (75 files)
- `.claude/skills/newsletter-campaign-workflow/SKILL.md`
- `.claude/agents/*` (13 agent files)

## Dependencies & Considerations

### External Services
- **MailerLite API:** May reference "campaigns" - check API docs
- **Vercel Cron Jobs:** Update cron configuration in `vercel.json`
- **Slack Notifications:** Update message templates
- **URL Tracking:** May have campaign_id in tracked URLs

### Third-Party Packages
- Check if any packages expect "campaign" terminology
- Review workflow engine for hardcoded references

### Data Integrity
- Ensure campaign_date → issue_date makes sense
- Verify status field values remain valid
- Check scheduled_send_time logic

## Testing Strategy

### Phase 1 Testing
- Manual UI review
- Screenshot comparison
- Documentation accuracy check

### Phase 2 Testing
```bash
npm run type-check
npm run lint
npm run test (if tests exist)
```

### Phase 3 Testing
- Test all URL redirects
- Verify API endpoint backwards compatibility
- Check external webhook delivery

### Phase 4 Testing (Database)
- Pre-migration row counts
- Post-migration row counts
- Foreign key integrity
- Sample CRUD operations
- Full workflow test (RSS → Issue → Send)

### End-to-End Testing
1. Create new publication
2. Configure RSS feeds
3. Trigger workflow to create issue
4. Edit issue content
5. Send review email
6. Send final email
7. Verify analytics tracking
8. Check archived issue

## Rollback Procedures

### Phase 1 Rollback
```bash
git revert <commit-hash>
git push
```

### Phase 2 Rollback
```bash
git revert <commit-hash>
npm run type-check
git push
```

### Phase 3 Rollback
1. Update redirects in `next.config.js` to reverse direction
2. Deploy
3. Or full git revert if needed

### Phase 4 Rollback (Database)
**CRITICAL - Test this procedure before Phase 4!**

```sql
-- See CAMPAIGN_TO_ISSUE_MIGRATION_ROLLBACK.sql
-- Reverse all table and column renames
-- Restore from backup if data corruption
```

## Success Criteria

- [ ] Zero data loss
- [ ] All tests passing
- [ ] No increase in error rates
- [ ] All URLs working (old + new)
- [ ] External integrations functioning
- [ ] Documentation updated
- [ ] Team trained on new terminology
- [ ] User feedback positive

## Communication Plan

### Internal Team
- [ ] Review migration plan
- [ ] Schedule phases
- [ ] Assign responsibilities
- [ ] Set up monitoring

### External Users (if applicable)
- [ ] Announce terminology change
- [ ] Update help documentation
- [ ] Send migration notice before Phase 4
- [ ] Provide support during transition

## Monitoring Post-Migration

### First 24 Hours
- Watch error logs closely
- Monitor API response times
- Check cron job execution
- Verify email sends working
- Track user-reported issues

### First Week
- Review analytics for anomalies
- Check data consistency
- Monitor foreign key violations
- Validate backup/restore procedures

### Key Metrics to Monitor
- API error rate
- Database query performance
- Workflow success rate
- Email delivery rate
- User satisfaction

## Next Steps

1. **Review this plan** with team
2. **Schedule phases** based on traffic patterns
3. **Set up staging environment** for testing
4. **Create SQL scripts** (Phase 4)
5. **Begin Phase 1** (documentation updates)

## Questions to Resolve

- [ ] Does MailerLite API use "campaign" terminology that we can't change?
- [ ] Are there any external webhooks that reference campaign_id?
- [ ] Do we need to maintain API backwards compatibility long-term?
- [ ] What is the maintenance window for Phase 4?
- [ ] Who has database admin access for Phase 4?

---

## Appendix A: Search Results Summary

**Total files with "campaign":** 294
**Files with database references:** 227
**Files with function/component names:** 48

Key patterns found:
- `newsletter_campaigns` table references
- `campaign_id` foreign keys
- `getCampaign*()` functions
- `Campaign*` React components
- `/campaigns` URL paths
- Campaign-related cron jobs
