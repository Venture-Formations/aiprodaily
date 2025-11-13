# Campaign → Issue Code Update Guide

**Database Migration:** ✅ COMPLETE
**Code Updates:** 🔄 IN PROGRESS

---

## Quick Reference: What Changed in Database

### Tables Renamed
```
newsletter_campaigns          → publication_issues
campaign_advertisements       → issue_advertisements
campaign_ai_app_selections    → issue_ai_app_selections
campaign_breaking_news        → issue_breaking_news
campaign_events               → issue_events
campaign_prompt_selections    → issue_prompt_selections
```

### Columns Renamed
```
campaign_id                   → issue_id (18 tables)
campaign_date                 → issue_date (3 tables)
campaign_status               → issue_status (1 table)
mailerlite_campaign_id        → mailerlite_issue_id (1 table)
```

---

## Step 1: Update Type Definitions

### File: `src/types/database.ts`

**Search & Replace Patterns:**

```typescript
// 1. Table interface names
NewsletterCampaign            → PublicationIssue
CampaignAIAppSelection        → IssueAIAppSelection
CampaignPromptSelection       → IssuePromptSelection
CampaignAdvertisement         → IssueAdvertisement
CampaignEvent                 → IssueEvent
CampaignBreakingNews          → IssueBreakingNews

// 2. Status enum
CampaignStatus                → IssueStatus

// 3. Column properties in interfaces
campaign_id: string           → issue_id: string
campaign_date: string         → issue_date: string
campaign_status:              → issue_status:
mailerlite_campaign_id:       → mailerlite_issue_id:

// 4. Comment updates
"Campaign" references         → "Issue" references
```

**After updates, add deprecated aliases for transition:**

```typescript
/** @deprecated Use PublicationIssue instead */
export type NewsletterCampaign = PublicationIssue;

/** @deprecated Use IssueStatus instead */
export type CampaignStatus = IssueStatus;

/** @deprecated Use issue_id instead */
// Remove these aliases after full migration
```

---

## Step 2: Update Database Queries

### Pattern 1: Table References

**Search for:**
```typescript
.from('newsletter_campaigns')
.from("newsletter_campaigns")
```

**Replace with:**
```typescript
.from('publication_issues')
.from("publication_issues")
```

**Affected tables (also update these):**
```typescript
.from('campaign_advertisements')      → .from('issue_advertisements')
.from('campaign_ai_app_selections')   → .from('issue_ai_app_selections')
.from('campaign_breaking_news')       → .from('issue_breaking_news')
.from('campaign_events')              → .from('issue_events')
.from('campaign_prompt_selections')   → .from('issue_prompt_selections')
```

### Pattern 2: Column References

**In SELECT, WHERE, INSERT, UPDATE statements:**

```typescript
// Old
.select('campaign_id')
.where('campaign_id', campaignId)
.insert({ campaign_id: id })
.order('campaign_date', { ascending: false })

// New
.select('issue_id')
.where('issue_id', issueId)
.insert({ issue_id: id })
.order('issue_date', { ascending: false })
```

### Pattern 3: Column Destructuring

```typescript
// Old
const { campaign_id, campaign_date, campaign_status } = data;

// New
const { issue_id, issue_date, issue_status } = data;
```

---

## Step 3: Update Variable Names

### Pattern: Function Parameters

```typescript
// Old
function getCampaign(campaignId: string)
function updateCampaign(campaignId: string, data: any)
async function deleteCampaign(campaignId: string)

// New
function getIssue(issueId: string)
function updateIssue(issueId: string, data: any)
async function deleteIssue(issueId: string)
```

### Pattern: Local Variables

```typescript
// Old
const campaign = await getCampaign(id);
const campaignId = campaign.id;
const campaigns = await listCampaigns();
const campaignDate = campaign.date;

// New
const issue = await getIssue(id);
const issueId = issue.id;
const issues = await listIssues();
const issueDate = issue.date;
```

### Pattern: Object Properties

```typescript
// Old
const data = {
  campaignId: id,
  campaignDate: date,
  campaignStatus: 'draft'
}

// New
const data = {
  issueId: id,
  issueDate: date,
  issueStatus: 'draft'
}
```

---

## Step 4: Update URL Routes & Paths

### API Routes (Rename Folders)

```bash
src/app/api/campaigns/                    → src/app/api/issues/
src/app/api/campaigns/[id]/              → src/app/api/issues/[id]/
src/app/api/workflows/create-campaign/   → src/app/api/workflows/create-issue/
src/app/api/cron/create-campaign/        → src/app/api/cron/create-issue/
src/app/api/debug/(campaign)/            → src/app/api/debug/(issue)/
```

### Frontend Routes (Rename Folders)

```bash
src/app/dashboard/[slug]/campaigns/          → src/app/dashboard/[slug]/issues/
src/app/dashboard/[slug]/campaigns/[id]/     → src/app/dashboard/[slug]/issues/[id]/
src/app/dashboard/[slug]/campaigns/new/      → src/app/dashboard/[slug]/issues/new/
```

### Dynamic Route Parameters

```typescript
// Old
params: { id: string }  // in campaigns/[id]

// New
params: { id: string }  // in issues/[id] (no change to param name)
```

### API Endpoint Paths in Code

```typescript
// Old
fetch('/api/campaigns')
fetch(`/api/campaigns/${id}`)
fetch('/api/workflows/create-campaign')

// New
fetch('/api/issues')
fetch(`/api/issues/${id}`)
fetch('/api/workflows/create-issue')
```

---

## Step 5: Update Component Names

### Component File Renames

```bash
src/components/DeleteCampaignModal.tsx    → src/components/DeleteIssueModal.tsx
```

### Component Name Updates

```tsx
// Old
export function DeleteCampaignModal({ campaignId, onDelete }) {
  const deleteCampaign = async () => {
    await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
  };
}

// New
export function DeleteIssueModal({ issueId, onDelete }) {
  const deleteIssue = async () => {
    await fetch(`/api/issues/${issueId}`, { method: 'DELETE' });
  };
}
```

### Component Import Updates

```tsx
// Old
import { DeleteCampaignModal } from '@/components/DeleteCampaignModal';

// New
import { DeleteIssueModal } from '@/components/DeleteIssueModal';
```

---

## Step 6: Update UI Text & Labels

### User-Facing Text

```tsx
// Old
<h1>Campaign Dashboard</h1>
<button>Create New Campaign</button>
<span>Campaign Status: {status}</span>
"Delete this campaign?"

// New
<h1>Issue Dashboard</h1>
<button>Create New Issue</button>
<span>Issue Status: {status}</span>
"Delete this issue?"
```

### Status Badge Text

```tsx
// Old
{status === 'draft' && 'Campaign Draft'}
{status === 'sent' && 'Campaign Sent'}

// New
{status === 'draft' && 'Issue Draft'}
{status === 'sent' && 'Issue Sent'}
```

---

## Step 7: Update Function Names

### Core CRUD Functions

```typescript
// Old
export async function createCampaign(data: CreateCampaignInput)
export async function getCampaignById(id: string)
export async function updateCampaign(id: string, data: UpdateCampaignInput)
export async function deleteCampaign(id: string)
export async function listCampaigns(filters?: CampaignFilters)
export async function getCampaignByDate(date: string)

// New
export async function createIssue(data: CreateIssueInput)
export async function getIssueById(id: string)
export async function updateIssue(id: string, data: UpdateIssueInput)
export async function deleteIssue(id: string)
export async function listIssues(filters?: IssueFilters)
export async function getIssueByDate(date: string)
```

### Service/Library Functions

```typescript
// Old (in src/lib/workflows/create-campaign-workflow.ts)
export async function createCampaignWorkflow()

// New (in src/lib/workflows/create-issue-workflow.ts)
export async function createIssueWorkflow()
```

---

## Step 8: Update Constants

```typescript
// Old
const CAMPAIGN_STATUSES = ['draft', 'in_review', 'sent'] as const;
const DEFAULT_CAMPAIGN_STATUS = 'draft';
const MAX_CAMPAIGNS_PER_PAGE = 20;

// New
const ISSUE_STATUSES = ['draft', 'in_review', 'sent'] as const;
const DEFAULT_ISSUE_STATUS = 'draft';
const MAX_ISSUES_PER_PAGE = 20;
```

---

## Step 9: Update Comments & Documentation

```typescript
// Old
/**
 * Creates a new campaign for the specified date
 * @param campaignData - The campaign data to create
 * @returns The created campaign
 */

// New
/**
 * Creates a new issue for the specified date
 * @param issueData - The issue data to create
 * @returns The created issue
 */
```

---

## Step 10: Update Logging & Error Messages

```typescript
// Old
console.log('[Campaign] Creating campaign:', data);
throw new Error(`Campaign not found: ${id}`);
logger.info('Campaign created successfully', { campaignId });

// New
console.log('[Issue] Creating issue:', data);
throw new Error(`Issue not found: ${id}`);
logger.info('Issue created successfully', { issueId });
```

---

## Automated Search Commands

### Find all campaign references in TypeScript files
```bash
grep -r "campaign" --include="*.ts" --include="*.tsx" src/ | grep -v node_modules
```

### Find table references
```bash
grep -r "\.from.*campaign" --include="*.ts" src/
```

### Find variable declarations
```bash
grep -r "const.*campaign\|let.*campaign\|var.*campaign" --include="*.ts" --include="*.tsx" src/
```

### Find function names
```bash
grep -r "function.*[Cc]ampaign\|async.*[Cc]ampaign" --include="*.ts" src/
```

---

## Testing Checklist

After making code changes:

- [ ] Run `npm run type-check` - Must pass with no errors
- [ ] Run `npm run lint` - Should have no new warnings
- [ ] Test API endpoints:
  - [ ] GET /api/issues (list)
  - [ ] POST /api/issues (create)
  - [ ] GET /api/issues/[id] (get single)
  - [ ] PUT /api/issues/[id] (update)
  - [ ] DELETE /api/issues/[id] (delete)
- [ ] Test workflows:
  - [ ] POST /api/workflows/create-issue
  - [ ] Cron job: /api/cron/create-issue
- [ ] Test frontend routes:
  - [ ] /dashboard/[slug]/issues (list page)
  - [ ] /dashboard/[slug]/issues/[id] (detail page)
  - [ ] /dashboard/[slug]/issues/new (create page)
- [ ] Test UI components:
  - [ ] DeleteIssueModal renders
  - [ ] Status badges show correct text
  - [ ] Navigation works
- [ ] Run end-to-end workflow:
  - [ ] Create new issue
  - [ ] RSS processing creates articles
  - [ ] Issue can be reviewed
  - [ ] Issue can be sent

---

## Priority Order for Updates

### Phase 1: Critical (Must update immediately)
1. ✅ Database migration (DONE)
2. `src/types/database.ts` - Type definitions
3. All `.from()` database queries
4. API route handlers in `src/app/api/`

### Phase 2: High Priority (Update within 24 hours)
5. Core library files in `src/lib/`
6. Workflow files
7. Service integrations (MailerLite, etc.)

### Phase 3: Medium Priority (Update within week)
8. Frontend pages and components
9. URL route renames
10. UI text and labels

### Phase 4: Low Priority (Clean up)
11. Comments and documentation
12. Debug routes
13. Test files
14. Remove deprecated type aliases

---

## Files That Must Be Updated

### Critical Files (Order matters)
1. `src/types/database.ts` - Type definitions FIRST
2. `src/lib/workflows/create-campaign-workflow.ts`
3. `src/lib/workflows/process-rss-workflow.ts`
4. `src/lib/rss-processor.ts`
5. `src/lib/newsletter-archiver.ts`
6. `src/lib/mailerlite.ts`
7. `src/app/api/campaigns/route.ts` (after renaming folder)
8. `src/app/api/cron/create-campaign/route.ts` (after renaming)

See `CAMPAIGN_TO_ISSUE_FILES_MANIFEST.md` for complete list of 294 files.

---

## Common Pitfalls to Avoid

1. **Mixed terminology** - Don't use both "campaign" and "issue" in same file
2. **Missed column references** - Search for `campaign_id`, `campaign_date`, etc.
3. **Hardcoded table names** - Search for string literals with table names
4. **URL redirects** - Add redirects in `next.config.js` for old routes
5. **External integrations** - Check if MailerLite API uses "campaign" terminology
6. **Cached imports** - Restart dev server after renaming files
7. **Database column names in raw SQL** - If using raw SQL, update column names

---

## Need Help?

If you encounter issues:
1. Check the error message for specific file/line
2. Search for the old terminology in that file
3. Use the patterns above to update
4. Run type-check after each major change
5. Test the specific feature that's failing

**Rollback available:** Run `CAMPAIGN_TO_ISSUE_MIGRATION_ACTUAL_ROLLBACK.sql` if critical issues arise.

---

**Last Updated:** 2025-11-13
**Status:** Database ✅ | Code 🔄 | Testing ⏳
