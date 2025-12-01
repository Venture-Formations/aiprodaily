# Multi-Tenant Migration Guide

**Date:** 2025-11-05
**Status:** Core Workflow Complete - Additional Work Required
**Goal:** Enable each newsletter to have its own schedule and settings

---

## ✅ COMPLETED WORK

### 1. Database Migration Created
**File:** `db/migrations/add_newsletter_id_to_app_settings.sql`

**What it does:**
- Adds `newsletter_id` column to `app_settings` table
- Assigns all existing settings to the first active newsletter
- Creates unique constraint on `(newsletter_id, key)`
- Creates index for efficient queries

**To run:**
```sql
-- Execute in Supabase SQL Editor
\i db/migrations/add_newsletter_id_to_app_settings.sql
```

**Verify:**
```sql
SELECT
  n.name as newsletter_name,
  COUNT(s.*) as settings_count
FROM publications n
LEFT JOIN app_settings s ON s.newsletter_id = n.id
GROUP BY n.id, n.name
ORDER BY n.name;
```

---

### 2. Core Workflow Updated

#### **ScheduleChecker** (`src/lib/schedule-checker.ts`)
- ✅ All methods now accept `newsletter_id` parameter
- ✅ `getScheduleSettings(newsletterId)` filters by newsletter
- ✅ `shouldRunRSSProcessing(newsletterId)`
- ✅ `shouldRunCampaignCreation(newsletterId)`
- ✅ `shouldRunReviewSend(newsletterId)`
- ✅ `shouldRunEventPopulation(newsletterId)`
- ✅ `shouldRunFinalSend(newsletterId)`
- ✅ `getScheduleDisplay(newsletterId)`

#### **Workflow** (`src/lib/workflows/process-rss-workflow.ts`)
- ✅ Accepts `newsletter_id` in input parameter
- ✅ Campaign creation includes `newsletter_id`
- ✅ Validates newsletter exists before processing

#### **Cron Trigger** (`src/app/api/cron/trigger-workflow/route.ts`)
- ✅ Loops through all active newsletters
- ✅ Checks each newsletter's schedule independently
- ✅ Starts separate workflow for each newsletter

---

### 3. API Routes Updated

#### **Critical Routes (Updated)**
- ✅ `src/app/api/cron/trigger-workflow/route.ts` - Multi-newsletter loop
- ✅ `src/app/api/workflows/process-rss/route.ts` - Requires `newsletter_id` in body
- ✅ `src/app/api/settings/schedule-display/route.ts` - Requires `newsletter_id` query param

#### **Legacy Routes (Backward Compatible)**
These use first active newsletter for backward compatibility:
- ✅ `src/app/api/cron/rss-processing/route.ts`
- ✅ `src/app/api/cron/create-campaign/route.ts`
- ✅ `src/app/api/cron/send-final/route.ts`
- ✅ `src/app/api/cron/send-review/route.ts`
- ✅ `src/app/api/debug/check-campaign-schedule/route.ts`

**Note:** Legacy routes marked with `// TODO: Deprecated in favor of trigger-workflow`

---

## ⚠️ REMAINING WORK

### Phase 1: Critical Settings API (Must Do)
These routes read/write app_settings and MUST be updated before migration:

**Email Settings** (Used in Settings > Email page):
- [ ] `src/app/api/settings/email/route.ts` - GET/POST schedule settings
  - Must add newsletter_id filter to all queries
  - Must accept newsletter_id from query params or context

**AI Prompts** (Used for content generation):
- [ ] `src/lib/openai.ts` - `callAIWithPrompt()` function
  - Must accept newsletter_id parameter
  - Must filter app_settings by newsletter_id when loading prompts
- [ ] `src/app/api/settings/ai-prompts/route.ts` - GET/POST prompt settings
- [ ] `src/lib/prompt-selector.ts` - Prompt selection logic

**Business Settings**:
- [ ] `src/app/api/settings/business/route.ts` - Newsletter name, description, etc.
- [ ] `src/app/api/settings/footer/route.ts` - Email footer content
- [ ] `src/app/api/settings/header-image/route.ts` - Email header image
- [ ] `src/app/api/settings/slack/route.ts` - Slack notifications

### Phase 2: RSSProcessor Updates (Critical for Workflow)
- [ ] `src/lib/rss-processor.ts` - Update all app_settings queries
  - Methods like `generateArticlesForSection()`, `selectTopArticlesForCampaign()`, etc.
  - Must pass newsletter_id to all settings lookups

### Phase 3: Newsletter Templates & Utilities
- [ ] `src/lib/newsletter-templates.ts` - Email template generation
- [ ] `src/lib/mailerlite.ts` - MailerLite integration (if uses settings)
- [ ] `src/lib/slack.ts` - Slack notifications (if uses settings)
- [ ] `src/lib/ad-scheduler.ts` - Ad scheduling logic (if uses settings)

### Phase 4: Remaining API Endpoints (Lower Priority)
- [ ] 60+ debug and utility endpoints in `src/app/api/debug/*`
- [ ] Settings pages: criteria, criteria-weights, ai-apps, public-events
- [ ] Database endpoints: `src/app/api/databases/*`
- [ ] Ad management: `src/app/api/ads/*`
- [ ] Public endpoints: `src/app/api/public/*`

---

## 🚀 MIGRATION PLAN

### Step 1: Run Database Migration
```bash
# In Supabase SQL Editor
\i db/migrations/add_newsletter_id_to_app_settings.sql
```

**Expected Result:**
- All existing settings assigned to first active newsletter
- `newsletter_id` column is NOT NULL
- Unique constraint on (newsletter_id, key)

### Step 2: Update Critical Settings API (Phase 1)
**Priority Order:**
1. `src/lib/openai.ts` - Breaks AI content generation without this
2. `src/app/api/settings/email/route.ts` - UI will break
3. `src/lib/prompt-selector.ts` - Prompt selection breaks
4. Other settings routes as needed

**Pattern to Follow:**
```typescript
// GET endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const newsletter_id = searchParams.get('newsletter_id')

  if (!newsletter_id) {
    return NextResponse.json({ error: 'newsletter_id required' }, { status: 400 })
  }

  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('*')
    .eq('newsletter_id', newsletter_id)  // ADD THIS
    .eq('key', 'some_key')
}

// POST endpoint
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { newsletter_id, ...settings } = body

  if (!newsletter_id) {
    return NextResponse.json({ error: 'newsletter_id required' }, { status: 400 })
  }

  await supabaseAdmin
    .from('app_settings')
    .upsert({
      newsletter_id,  // ADD THIS
      key: 'some_key',
      value: settings.value
    })
}
```

### Step 3: Update RSSProcessor (Phase 2)
**Critical Methods:**
- `generateArticlesForSection()` - Loads AI prompts
- `selectTopArticlesForCampaign()` - Loads criteria settings
- `generateWelcomeSection()` - Loads templates
- Any method that reads from app_settings

**Pattern:**
```typescript
// Before
const { data } = await supabaseAdmin
  .from('app_settings')
  .select('value')
  .eq('key', 'some_setting')
  .single()

// After
const { data } = await supabaseAdmin
  .from('app_settings')
  .select('value')
  .eq('newsletter_id', newsletterId)  // ADD THIS
  .eq('key', 'some_setting')
  .single()
```

### Step 4: Update Frontend
**Settings Pages Must Pass newsletter_id:**
- Settings > Email: Add newsletter_id to query params
- Settings > AI Prompts: Add newsletter_id to requests
- Settings > Business: Add newsletter_id to requests

**Pattern:**
```typescript
// Frontend fetch
const response = await fetch(
  `/api/settings/email?newsletter_id=${newsletterId}`
)
```

### Step 5: Test Each Newsletter
1. Create test campaign for Newsletter A
2. Verify schedule works for Newsletter A
3. Create test campaign for Newsletter B
4. Verify schedule works for Newsletter B
5. Verify newsletters don't interfere with each other

---

## 🔍 HOW TO FIND REMAINING FILES

### Find all app_settings queries:
```bash
grep -r "\.from('app_settings')" src/
```

### Check each file:
1. Does it read/write app_settings?
2. Does it filter by newsletter_id?
3. If NO → Add `.eq('newsletter_id', newsletterId)`

---

## 🐛 COMMON ISSUES

### Issue 1: Settings Not Found
**Symptom:** Empty settings returned
**Cause:** No settings exist for that newsletter yet
**Fix:** Copy settings from existing newsletter or create defaults

```sql
-- Copy settings from newsletter A to newsletter B
INSERT INTO app_settings (newsletter_id, key, value, description)
SELECT 'newsletter_b_id', key, value, description
FROM app_settings
WHERE newsletter_id = 'newsletter_a_id';
```

### Issue 2: Frontend Errors
**Symptom:** Settings page returns 400 "newsletter_id required"
**Cause:** Frontend not passing newsletter_id
**Fix:** Update frontend to include newsletter_id in requests

### Issue 3: Workflow Fails
**Symptom:** Workflow throws "Newsletter not found"
**Cause:** Invalid newsletter_id passed
**Fix:** Verify newsletter exists and is active

---

## 📊 TESTING CHECKLIST

### Before Migration:
- [ ] Backup database
- [ ] Document current newsletter count
- [ ] Export current app_settings as JSON

### After Migration:
- [ ] Verify all settings assigned to a newsletter
- [ ] Test workflow for each newsletter
- [ ] Test Settings > Email page loads
- [ ] Test campaign creation works
- [ ] Test email sending works
- [ ] Verify schedules are independent per newsletter

---

## 🎯 SUCCESS CRITERIA

**Core Workflow Working:**
- ✅ Cron runs every 5 minutes
- ✅ Checks each newsletter's schedule independently
- ✅ Starts separate workflows for each newsletter
- ✅ Campaigns assigned to correct newsletter_id
- ✅ Sending works per newsletter

**Settings Working:**
- [ ] Each newsletter has own schedule
- [ ] Settings page loads per newsletter
- [ ] AI prompts load per newsletter
- [ ] Email templates load per newsletter

**Multi-Tenant Isolation:**
- [ ] Newsletter A settings don't affect Newsletter B
- [ ] Newsletter A campaigns don't affect Newsletter B
- [ ] Schedules run independently

---

## 📝 NOTES

### Why This Architecture?
- Each newsletter needs independent schedule (not 10am for all)
- Each newsletter needs custom AI prompts
- Each newsletter needs custom templates
- Matches CLAUDE.md spec: "app_settings (key-value pairs scoped by newsletter_id)"

### Legacy Routes
- Kept for backward compatibility
- Use first active newsletter as default
- Should be deprecated once all clients use new workflow system

### Performance Impact
- Minimal: One additional filter on indexed column
- Cron loops through newsletters sequentially (acceptable for 5+ newsletters)
- Can optimize later with parallel workflow starts if needed

---

**Next Steps:**
1. Run database migration
2. Update Phase 1 files (openai.ts, email settings)
3. Test with one newsletter
4. Update Phase 2 files (rss-processor)
5. Test with two newsletters
6. Gradually update remaining files

**Questions?** Check CLAUDE.md for multi-tenant patterns and examples.
