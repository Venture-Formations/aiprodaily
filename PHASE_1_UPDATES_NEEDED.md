# Phase 1: Critical Updates Status

**Status:** Database migration complete, openai.ts updated ✅
**Remaining:** RSSProcessor and method signatures

---

## ✅ COMPLETED

### 1. Database Migration
- `app_settings` now has `newsletter_id` column
- All existing settings assigned to first active newsletter
- Unique constraint on `(newsletter_id, key)`

### 2. OpenAI Integration Updated
**File:** `src/lib/openai.ts`

**Changes:**
```typescript
// BEFORE:
export async function callAIWithPrompt(
  promptKey: string,
  placeholders: Record<string, string> = {},
  fallbackText?: string
): Promise<any>

// AFTER:
export async function callAIWithPrompt(
  promptKey: string,
  newsletterId: string,  // NEW PARAMETER
  placeholders: Record<string, string> = {},
  fallbackText?: string
): Promise<any>
```

- `getPromptJSON()` now filters by `newsletter_id`
- `callAIWithPrompt()` requires `newsletter_id` as second parameter

---

## ⚠️ BREAKING CHANGES

All code that calls `callAIWithPrompt()` now needs to pass `newsletter_id`.

**Affected Files:**
1. `src/lib/rss-processor.ts` (2 calls)
2. `src/app/api/debug/test-ai-criteria/route.ts` (1 call)

---

## 🔧 SOLUTION APPROACH

### Step 1: Add Helper Method to RSSProcessor

Add this helper to get newsletter_id from campaign_id:

```typescript
// Add to RSSProcessor class
private async getNewsletterIdFromCampaign(campaignId: string): Promise<string> {
  const { data: campaign, error } = await supabaseAdmin
    .from('newsletter_campaigns')
    .select('newsletter_id')
    .eq('id', campaignId)
    .single()

  if (error || !campaign || !campaign.newsletter_id) {
    throw new Error(`Failed to get newsletter_id for campaign ${campaignId}`)
  }

  return campaign.newsletter_id
}
```

### Step 2: Update Method Signatures

**Methods that need `newsletter_id` parameter:**

```typescript
// evaluatePost - called by scorePostsForSection
private async evaluatePost(
  post: RssPost,
  newsletterId: string  // ADD THIS
): Promise<ContentEvaluation>

// factCheckContent - called during article generation
private async factCheckContent(
  newsletterContent: string,
  originalContent: string,
  newsletterId: string  // ADD THIS
): Promise<FactCheckResult>
```

### Step 3: Update Method Bodies

**evaluatePost (line 1352-1450):**
```typescript
// Line 1354-1357: Add newsletter_id filter
const { data: criteriaConfig, error: configError } = await supabaseAdmin
  .from('app_settings')
  .select('key, value')
  .eq('newsletter_id', newsletterId)  // ADD THIS
  .or('key.eq.criteria_enabled_count,key.like.criteria_%_name,key.like.criteria_%_weight')

// Line 1399: Add newsletter_id parameter
result = await callAIWithPrompt(
  promptKey,
  newsletterId,  // ADD THIS
  {
    title: post.title,
    description: post.description || '',
    content: fullText
  }
)
```

**factCheckContent (line 2090-2120):**
```typescript
// Line 2094: Add newsletter_id parameter
result = await callAIWithPrompt(
  'ai_prompt_fact_checker',
  newsletterId,  // ADD THIS
  {
    newsletter_content: newsletterContent,
    original_content: originalContent
  }
)
```

### Step 4: Update Callers

**scorePostsForSection (line 56-150):**
```typescript
async scorePostsForSection(campaignId: string, section: 'primary' | 'secondary' = 'primary') {
  // ADD: Get newsletter_id at the start
  const newsletterId = await this.getNewsletterIdFromCampaign(campaignId)

  // ... existing code ...

  // Line 100: Pass newsletterId
  const evaluation = await this.evaluatePost(post, newsletterId)

  // ... rest of method ...
}
```

**Other methods that call evaluatePost:**
- Line 387: `scoreAndStorePost()` - needs campaign/newsletter context
- Line 1282: Another scorer - needs campaign/newsletter context

---

## 📋 DETAILED TASK LIST

### RSSProcessor Updates

- [ ] Add `getNewsletterIdFromCampaign()` helper method
- [ ] Update `evaluatePost()` signature to accept `newsletterId`
- [ ] Update `evaluatePost()` app_settings query (line 1354-1357)
- [ ] Update `evaluatePost()` callAIWithPrompt call (line 1399)
- [ ] Update `factCheckContent()` signature to accept `newsletterId`
- [ ] Update `factCheckContent()` callAIWithPrompt call (line 2094)
- [ ] Update `scorePostsForSection()` to get and pass newsletterId
- [ ] Update `scoreAndStorePost()` to get and pass newsletterId
- [ ] Find all other app_settings queries in rss-processor.ts and add newsletter_id filters

### Find All app_settings Queries in RSSProcessor

```bash
grep -n "\.from('app_settings')" src/lib/rss-processor.ts
```

**Known locations:**
- Line 1356: evaluatePost criteria config (needs newsletter_id) ✅ Documented
- Other locations: TBD (need to grep)

---

## 🎯 RECOMMENDED APPROACH

Given the complexity, I recommend:

1. **Quick Fix (15 minutes):**
   - Add the helper method
   - Update evaluatePost and factCheckContent signatures
   - Update the 2 callAIWithPrompt calls
   - Update scorePostsForSection to get newsletter_id
   - This gets the workflow working again

2. **Complete Fix (1-2 hours):**
   - Grep all app_settings queries in rss-processor.ts
   - Update each one to filter by newsletter_id
   - Test thoroughly with multiple newsletters

---

## 🚨 CURRENT STATUS

**What Works:**
- ✅ Database is multi-tenant ready
- ✅ Cron trigger loops through newsletters
- ✅ Campaigns assigned to newsletter_id
- ✅ OpenAI helper ready for newsletter_id

**What's Broken:**
- ❌ Content scoring (evaluatePost)
- ❌ Article generation (uses AI)
- ❌ Any AI call in rss-processor
- ❌ Settings queries without newsletter_id filter

**Impact:**
- Workflow will start but fail during AI content generation
- Need to complete Phase 1 updates before testing end-to-end

---

## 💡 NEXT STEPS

**Option A: I continue now (Recommended)**
- I can complete the RSSProcessor updates in ~10-15 minutes
- Get you to a working state for testing
- This is the critical path to multi-tenant functionality

**Option B: You handle it**
- Use this document as a guide
- Pattern is clear and repetitive
- Good learning opportunity for codebase

**Option C: Pause and test core workflow**
- Test that cron triggers correctly
- Test that campaigns are created with newsletter_id
- Complete AI integration later

Which option would you prefer?
