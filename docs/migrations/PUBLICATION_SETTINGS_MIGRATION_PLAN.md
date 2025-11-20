# Publication Settings Migration Plan

**Date:** 2025-11-17
**Status:** Planning
**Objective:** Migrate from global `app_settings` to publication-specific `publication_settings`

## Executive Summary

The `newsletter_settings` table already exists with proper multi-tenant support (keyed by `publication_id`). We will:

1. Rename `newsletter_settings` → `publication_settings` for clarity
2. Move all publication-specific settings to `publication_settings`
3. Update all code references to query by `publication_id`
4. Implement fallback to `app_settings` with logging to identify missing migrations
5. Keep `app_settings` temporarily for backward compatibility

## Current State

- **Global table:** `app_settings` (key-value, no publication isolation)
- **Existing but unused:** `newsletter_settings` (key-value with `publication_id`) → rename to `publication_settings`
- **Problem:** All queries fetch from `app_settings` without multi-tenant filtering

## Settings Classification

### Publication-Specific Settings (Move to publication_settings)

**Visual/Branding:**
- `primary_color`
- `secondary_color`
- `heading_font`
- `body_font`
- `logo_url`
- `header_image_url`
- `website_header_url`
- `website_url`
- `newsletter_name`
- `business_name`

**Email Configuration:**
- `email_senderName`
- `email_fromEmail`
- `email_reviewGroupId`
- `subject_line_emoji`
- `mailerlite_group_id`

**Article Processing:**
- `primary_article_lookback_hours`
- `secondary_article_lookback_hours`
- `max_top_articles`
- `max_bottom_articles`
- `max_secondary_articles`
- `excluded_rss_sources`
- `dedup_historical_lookback_days`
- `dedup_strictness_threshold`
- `primary_criteria_enabled_count`
- `secondary_criteria_enabled_count`

**Ad Management:**
- `next_ad_position`

**Slack/Notifications:**
- `slack_webhook_url`
- `slack_low_article_count_enabled`
- `slack_rss_processing_updates_enabled`

**Contact/Public:**
- `contact_email`
- `public_event_paid_placement_price`
- `public_event_featured_price`

**AI Prompts:**
- `ai_prompt_content_evaluator`
- `ai_prompt_newsletter_writer`
- `ai_prompt_event_summary`
- `ai_prompt_topic_deduper`
- `ai_prompt_fact_checker`
- `ai_prompt_breaking_news_scorer`
- `ai_prompt_welcome_section`
- `ai_prompt_criteria_1` through `ai_prompt_criteria_5`
- `ai_prompt_article_writer`
- `ai_prompt_primary_article_title`
- `ai_prompt_primary_article_body`
- `ai_prompt_secondary_article_title`
- `ai_prompt_secondary_article_body`
- `ai_prompt_subject_line`

### Potentially Global Settings (Keep in app_settings)

- None identified - all settings are publication-specific

---

## Files Requiring Updates

### CRITICAL - Core Library Files (High Impact)

#### 1. `src/lib/newsletter-templates.ts`
**References:** Lines 177, 294, 664, 1151
**Functions to update:**
- `generateNewsletterHeader()` - fetches header_image_url, primary_color, newsletter_name, website_url
- `fetchBusinessSettings()` - fetches primary_color, secondary_color, heading_font, body_font, website_url
- `generateAdvertorialSection()` - fetches next_ad_position
- `generateNewsletterFooter()` - fetches footer settings

**Changes:**
- All functions need `publication_id` parameter
- Change `.from('app_settings')` to `.from('newsletter_settings')`
- Add `.eq('newsletter_id', publicationId)` filter

#### 2. `src/lib/openai.ts`
**References:** Lines 17, 40, 1064-1641 (many prompt fetches)
**Functions to update:**
- All AI prompt loading functions (17+ functions)
- `callAIWithPrompt()` - fetches AI prompts

**Changes:**
- Each function needs `publication_id` parameter
- Change from global prompt fetch to publication-specific
- Pattern: `.from('newsletter_settings').eq('newsletter_id', publicationId).eq('key', 'ai_prompt_*')`

#### 3. `src/lib/mailerlite.ts`
**References:** Lines 49, 511, 555, 611
**Functions to update:**
- `sendEmail()` - fetches email_senderName, email_fromEmail, subject_line_emoji
- Email configuration functions

**Changes:**
- Add `publication_id` to method signatures
- Update queries to use `newsletter_settings`

#### 4. `src/lib/rss-processor.ts`
**References:** Lines 600, 944, 1412, 1689, 1849, 2119, 2129, 2231, 2241
**Functions to update:**
- Article lookback settings
- Deduplication settings
- Max article counts
- Excluded RSS sources

**Changes:**
- All processing functions need `publication_id`
- Heavy refactor as processor is core workflow engine

#### 5. `src/lib/ad-scheduler.ts`
**References:** Lines 29, 187
**Functions to update:**
- `getNextAdPosition()`
- Ad selection logic

**Changes:**
- Add `publication_id` parameter
- Query `newsletter_settings` for next_ad_position

#### 6. `src/lib/app-selector.ts`
**References:** Line 20
**Changes:**
- Update to use publication-specific settings

#### 7. `src/lib/schedule-checker.ts`
**References:** Lines 16, 89
**Functions to update:**
- Schedule checking logic

**Changes:**
- Add `publication_id` parameter

#### 8. `src/lib/slack.ts`
**References:** Lines 14, 29
**Functions to update:**
- `sendSlackNotification()`
- Webhook URL fetching

**Changes:**
- Add `publication_id` parameter

---

### API Routes (Dashboard/Admin)

#### Settings Routes (All need publication_id from route params)

1. **`src/app/api/settings/business/route.ts`** - Lines 40, 86, 94, 100
2. **`src/app/api/settings/ai-prompts/route.ts`** - Lines 15, 26, 168, 217, 249, 274, 311
3. **`src/app/api/settings/email/route.ts`** - Lines 29, 162, 205, 251, 319, 379
4. **`src/app/api/settings/criteria/route.ts`** - Lines 42, 49, 60, 163, 173, 184, 221, 231, 242
5. **`src/app/api/settings/criteria-weights/route.ts`** - Lines 62, 71, 83
6. **`src/app/api/settings/slack/route.ts`** - Lines 29, 117, 126, 142
7. **`src/app/api/settings/ai-apps/route.ts`** - Lines 10, 58
8. **`src/app/api/settings/header-image/route.ts`** - Line 7
9. **`src/app/api/settings/footer/route.ts`** - Line 7
10. **`src/app/api/settings/public-events/route.ts`** - Lines 13, 93

**Pattern for all:**
- Extract `publication_id` from request (query param or body)
- Add `.eq('publication_id', publicationId)` to queries

#### Cron/Workflow Routes

11. **`src/app/api/cron/send-final/route.ts`** - Lines 300, 556
12. **`src/app/api/cron/send-newsletter/route.ts`** - Line 99
13. **`src/app/api/cron/trigger-workflow/route.ts`**
14. **`src/app/api/campaigns/create-with-workflow/route.ts`** - Line 135

**Pattern:**
- Get `publication_id` from campaign/issue being processed
- Pass to all helper functions

#### Other API Routes

15. **`src/app/api/subscribe/route.ts`** - Line 24 (mailerlite_group_id)
16. **`src/app/api/rss-sources/route.ts`** - Lines 29, 92, 120 (excluded_rss_sources)
17. **`src/app/api/ads/route.ts`** - Line 101 (next_ad_position)
18. **`src/app/api/ads/reset-position/route.ts`** - Line 23
19. **`src/app/api/contact/route.ts`** - Line 38 (contact_email)
20. **`src/app/api/public/business-settings/route.ts`** - Line 19
21. **`src/app/api/databases/articles/route.ts`** - Line 41
22. **`src/app/api/ai/load-live-prompt/route.ts`** - Line 55
23. **`src/app/api/backfill/criteria-*.ts`** - Multiple files

---

### Website/Public Routes

24. **`src/app/website/page.tsx`** - Line 13
25. **`src/app/website/newsletters/page.tsx`** - Line 12
26. **`src/app/website/newsletter/[date]/page.tsx`** - Line 54
27. **`src/app/website/contactus/page.tsx`** - Line 12
28. **`src/app/website/icon.tsx`** - Line 15

**Pattern (Domain-Based Routing):**
1. Extract domain from request headers (`request.headers.get('host')`)
2. Look up `publications` table: `WHERE website_domain = domain`
3. Get `publication_id` from matched publication
4. Fetch settings from `publication_settings` using that ID
5. Helper function: `getPublicationByDomain(domain) -> publication_id`

---

### Workflow Files

29. **`src/lib/workflows/process-rss-workflow.ts`** - Line 143
30. **`src/lib/workflows/reprocess-articles-workflow.ts`** - Line 136

**Pattern:**
- Already have campaign context with publication_id
- Update helper calls to include publication_id

---

### Debug/Test Routes (Lower Priority)

~40+ debug routes in `src/app/api/debug/` directories
- Can be updated incrementally
- Many are one-time maintenance scripts
- Lower priority but should be updated for consistency

---

## Implementation Strategy (Minimal Downtime)

### Phase 0: Pre-Migration Setup (1 hour)
1. Rename `newsletter_settings` table to `publication_settings`
2. Rename column `newsletter_id` to `publication_id`
3. Update TypeScript interface from `NewsletterSetting` to `PublicationSetting`

```sql
-- Rename table and column
ALTER TABLE newsletter_settings RENAME TO publication_settings;
ALTER TABLE publication_settings RENAME COLUMN newsletter_id TO publication_id;
```

### Phase 1: Database Migration (1-2 hours)
1. Copy all `app_settings` data to `publication_settings` for existing publication(s)
2. Verify data integrity
3. **Keep `app_settings` intact** - used as fallback

### Phase 2: Create Helper Module with Fallback Logging (3-4 hours)
1. Create `src/lib/publication-settings.ts` with typed helper functions
2. **Implement fallback with logging:**
```typescript
async function getPublicationSetting(pubId: string, key: string): Promise<string | null> {
  // Try publication_settings first
  const { data } = await supabaseAdmin
    .from('publication_settings')
    .select('value')
    .eq('publication_id', pubId)
    .eq('key', key)
    .single()

  if (data?.value) {
    return data.value
  }

  // Fallback to app_settings with WARNING log
  const { data: fallback } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single()

  if (fallback?.value) {
    console.warn(`[SETTINGS FALLBACK] Using app_settings for key="${key}" (publication=${pubId}). Migrate this setting!`)
    return fallback.value
  }

  return null
}
```

3. Domain-based publication lookup:
```typescript
async function getPublicationByDomain(domain: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('publications')
    .select('id')
    .eq('website_domain', domain)
    .single()

  return data?.id || null
}
```

4. Helper functions:
   - `getPublicationSetting(pubId, key)` - single setting with fallback + logging
   - `getPublicationSettings(pubId, keys[])` - multiple settings
   - `updatePublicationSetting(pubId, key, value)` - update setting
   - `getBusinessSettings(pubId)` - colors, fonts, URLs
   - `getEmailSettings(pubId)` - MailerLite config
   - `getAIPrompt(pubId, promptKey)` - AI prompt with fallback

### Phase 3: Update Core Libraries (8-12 hours)
**Minimal downtime approach:** Update one library at a time, deploy, verify

1. `src/lib/newsletter-templates.ts` - Add publication_id to all functions
2. `src/lib/openai.ts` - Update all prompt fetching
3. `src/lib/mailerlite.ts` - Publication-specific email settings
4. `src/lib/rss-processor.ts` - Heavy refactor, publication-aware processing
5. `src/lib/ad-scheduler.ts` - Publication-specific ad rotation
6. `src/lib/slack.ts` - Publication-specific webhooks

**Each library update:**
- Import helper module
- Add `publication_id` parameter
- Replace direct `app_settings` queries with helper calls
- Deploy and verify fallback logs
- Ensure settings exist in `publication_settings` before removing fallback

### Phase 4: Update API Routes (6-8 hours)
1. Settings routes - Add publication_id to all endpoints
2. Cron routes - Extract publication_id from campaign context
3. Public website routes - Use domain-based lookup

### Phase 5: Update Workflows (2-3 hours)
1. Ensure publication_id flows through all workflow steps
2. Update process-rss-workflow.ts
3. Update reprocess-articles-workflow.ts

### Phase 6: Testing & Monitoring (4-6 hours)
1. Test each publication gets its own settings
2. **Monitor logs for "SETTINGS FALLBACK" warnings**
3. Fix any missing migrations identified by fallback logs
4. Verify no cross-contamination between publications
5. End-to-end workflow testing

### Phase 7: Cleanup (After 2 weeks of stability)
1. Remove fallback logic once no more warnings appear
2. Consider deprecating `app_settings` table
3. Update documentation

---

## Migration Script Template

```sql
-- Phase 0: Rename table and column
ALTER TABLE newsletter_settings RENAME TO publication_settings;
ALTER TABLE publication_settings RENAME COLUMN newsletter_id TO publication_id;

-- Update unique constraint if needed
ALTER TABLE publication_settings DROP CONSTRAINT IF EXISTS newsletter_settings_newsletter_id_key_key;
ALTER TABLE publication_settings ADD CONSTRAINT publication_settings_publication_id_key_key UNIQUE (publication_id, key);

-- Phase 1: Migrate app_settings to publication_settings
-- For single publication (get ID first)

-- 1. Get the current publication ID
SELECT id FROM publications WHERE slug = 'ai-pro-daily';

-- 2. Insert all app_settings for this publication
INSERT INTO publication_settings (publication_id, key, value, description, created_at, updated_at)
SELECT
  'YOUR_PUBLICATION_ID',
  key,
  value,
  description,
  created_at,
  updated_at
FROM app_settings
ON CONFLICT (publication_id, key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();

-- 3. Verify migration
SELECT key, value
FROM publication_settings
WHERE publication_id = 'YOUR_PUBLICATION_ID'
ORDER BY key;

-- 4. Count comparison
SELECT
  (SELECT COUNT(*) FROM app_settings) as app_settings_count,
  (SELECT COUNT(*) FROM publication_settings WHERE publication_id = 'YOUR_PUBLICATION_ID') as publication_settings_count;
```

---

## Risk Assessment

### High Risk
- **RSS Processor refactor** - Core workflow, many integration points
- **OpenAI prompt loading** - 17+ functions to update
- **Breaking existing functionality** - Single-tenant to multi-tenant shift

### Medium Risk
- **API route updates** - Many files but similar patterns
- **Helper function signatures** - Cascading changes to callers

### Low Risk
- **Database migration** - Data copy with conflict resolution
- **Debug routes** - Can be updated incrementally

---

## Rollback Plan

1. Keep `app_settings` table intact (don't delete)
2. Implement feature flag for gradual rollout
3. Helper functions can fallback to `app_settings` if `newsletter_settings` empty
4. Version control for easy revert

---

## Success Criteria

1. ✅ All settings queries filter by `publication_id`
2. ✅ Each publication can have different colors, prompts, settings
3. ✅ No hardcoded values or cross-publication leakage
4. ✅ TypeScript compilation passes
5. ✅ All existing functionality works as before
6. ✅ New publications get their own isolated settings

---

## Estimated Total Effort

- **Phase 0 (Table Rename):** 1 hour
- **Phase 1 (Data Migration):** 1-2 hours
- **Phase 2 (Helper Module):** 3-4 hours
- **Phase 3 (Core Libraries):** 8-12 hours
- **Phase 4 (API Routes):** 6-8 hours
- **Phase 5 (Workflows):** 2-3 hours
- **Phase 6 (Testing/Monitoring):** 4-6 hours
- **Buffer/Debugging:** 4-6 hours

**Total: 30-42 hours (5-7 days)**

---

## Decisions Made

1. ✅ **Fallback with logging** - Yes, implement fallback to `app_settings` with warning logs to identify missing migrations
2. ✅ **Domain-based routing** - Public website routes determine publication by `website_domain` column
3. ✅ **Table naming** - Rename `newsletter_settings` → `publication_settings` for clarity
4. ✅ **Minimal downtime** - Phased approach, deploy incrementally, monitor logs

---

## Minimal Downtime Execution Order

### Day 1: Foundation (No Breaking Changes)
1. **Create helper module** - `src/lib/publication-settings.ts`
   - All helper functions with fallback + logging
   - Domain-based publication lookup
   - Deploy: Safe, no code uses it yet

2. **Rename database table** - Run in Supabase
   - `newsletter_settings` → `publication_settings`
   - Column `newsletter_id` → `publication_id`
   - Deploy: Table currently unused, no impact

3. **Migrate data** - Copy `app_settings` to `publication_settings`
   - All keys for your publication
   - Verify counts match
   - Deploy: Data ready for new code

### Day 2-3: Core Libraries (One at a Time)
4. **Update `newsletter-templates.ts`**
   - Use helper module for settings
   - Deploy, monitor logs
   - Fix any fallback warnings

5. **Update `mailerlite.ts`**
   - Use helper module for email settings
   - Deploy, monitor logs

6. **Update `openai.ts`** (Biggest change)
   - Use helper module for AI prompts
   - Deploy, monitor logs
   - Many functions to update

7. **Update `ad-scheduler.ts`**
   - Use helper module
   - Deploy, monitor

8. **Update `slack.ts`**
   - Use helper module
   - Deploy, monitor

### Day 4: RSS Processor (Complex)
9. **Update `rss-processor.ts`**
   - Most critical file
   - Heavy testing required
   - Deploy during low-traffic time

### Day 5: API Routes
10. **Update settings API routes**
    - Add publication_id to endpoints
    - Batch update, single deploy

11. **Update cron/workflow routes**
    - Extract publication_id from campaign
    - Deploy, test full workflow

12. **Update public website routes**
    - Use domain-based lookup
    - Deploy, test public site

### Day 6-7: Testing & Cleanup
13. **Monitor fallback logs**
    - Identify any missing migrations
    - Fix as needed

14. **Full workflow testing**
    - Trigger complete campaign workflow
    - Verify all settings used correctly

15. **Performance check**
    - No slowdowns from extra queries
    - Consider caching if needed

---

## Next Steps

1. ✅ Plan complete and approved
2. Create helper module file structure
3. Write database migration scripts
4. Begin Phase 0 (table rename)
5. Execute Day 1 tasks
6. Monitor and iterate
