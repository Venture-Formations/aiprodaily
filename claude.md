# AI Pros Newsletter Platform - Development Context

**Last Updated:** 2025-01-07
**Project:** Multi-tenant Newsletter Automation Platform
**Stack:** Next.js 15 + Supabase + OpenAI/Claude + Vercel Workflows

---

## 🎯 Quick Start

**Before any task, read:**
1. This file (CLAUDE.md) - Core rules and patterns
2. Task-specific docs (see [Documentation Map](#documentation-map))

**Key References:**
- `MULTI_CRITERIA_SCORING_GUIDE.md` - Post scoring system details
- `docs/AI_PROMPT_SYSTEM_GUIDE.md` - AI prompt management
- `docs/OPENAI_RESPONSES_API_GUIDE.md` - OpenAI Responses API usage

---

## ⚠️ CRITICAL RULES

### 1. Multi-Tenant Isolation

**ALWAYS filter by `newsletter_id` in database queries:**

```typescript
// ✅ CORRECT
const { data } = await supabaseAdmin
  .from('articles')
  .select('*')
  .eq('campaign_id', campaignId)
  .eq('newsletter_id', newsletterId)  // REQUIRED

// ❌ WRONG - Data leakage!
const { data } = await supabaseAdmin
  .from('articles')
  .select('*')
  .eq('campaign_id', campaignId)
```

### 2. Date/Time Handling

**NEVER use UTC conversions for date comparisons:**

```typescript
// ✅ CORRECT: Local date comparison
const dateStr = date.split('T')[0]  // "2025-01-07"
const today = new Date().toISOString().split('T')[0]
if (dateStr === today) { /* ... */ }

// ❌ FORBIDDEN: UTC conversion shifts dates
date.toISOString()  // Wrong timezone!
date.toUTCString()  // Breaks comparisons!
```

**Why:** UTC conversion shifts dates by timezone. Users expect Central Time.

### 3. Performance & Limits

**Hard Limits (Vercel):**
- Workflow step timeout: **800 seconds** (13 minutes per step)
- API route timeout: **600 seconds** (10 minutes max)
- Log size: **10MB maximum**
- Memory: **1024MB default**

**Minimal Logging Pattern:**

```typescript
// ✅ GOOD: One-line summaries with prefixes
console.log('[RSS] Step 1/10: Setup complete, 24 posts assigned')
console.log('[AI] Batch 1/4: Scored 3 posts, avg: 7.2')
console.error('[DB] Query failed:', error.message)

// ❌ BAD: Excessive detail (forbidden)
console.log('Processing item 1...')
console.log('Processing item 2...')
// ... (causes 10MB overflow)
```

**Log Prefixes:**
- `[Workflow]` - Vercel Workflow orchestration
- `[RSS]` - RSS processing
- `[AI]` - OpenAI/Claude API calls
- `[DB]` - Database operations
- `[CRON]` - Cron job execution

### 4. Error Handling

**Pattern: Try-catch with retry logic (all workflow steps):**

```typescript
let retryCount = 0
const maxRetries = 2

while (retryCount <= maxRetries) {
  try {
    await processStep()
    return  // Success
  } catch (error) {
    retryCount++
    if (retryCount > maxRetries) {
      console.error('[Step] Failed after retries')
      throw error
    }
    console.log(`[Step] Retrying (${retryCount}/${maxRetries})...`)
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}
```

### 5. Confidence & Clarification

**When confidence < 80%, STOP and ask:**

```
I'm uncertain about [aspect]. Here are the options:

A) [Approach 1]
   Pros: [Benefits]
   Cons: [Drawbacks]
   Impact: [Implications]

B) [Approach 2]
   Pros: [Benefits]
   Cons: [Drawbacks]
   Impact: [Implications]

Which approach fits better?
```

---

## 🏗️ System Architecture

### Multi-Tenant Structure

```
Newsletter (slug: "accounting")
  → newsletter_id
    → Campaigns (daily)
      → RSS Posts (scored)
        → Articles (generated)
          → Email (sent)
```

**All tables scoped by `newsletter_id`.**

### Database Schema (Key Tables)

```
newsletters
  ├── newsletter_campaigns (status: draft → processing → ready → sent)
  │   ├── articles (primary section, 6 generated, 3 active)
  │   ├── secondary_articles (secondary section, 6 generated, 3 active)
  │   └── rss_posts (assigned posts)
  │       └── post_ratings (multi-criteria scores)
  │
  ├── rss_feeds (active/inactive, section assignment)
  ├── app_settings (key-value config, scoped by newsletter_id)
  └── archived_articles, archived_rss_posts (historical data)
```

---

## 🔄 RSS Processing Workflow

**Location:** `src/lib/workflows/process-rss-workflow.ts`

**Architecture:** Vercel Workflows - 10 discrete steps, each with 800s timeout + retry logic

### Workflow Steps

**Step 1: Setup** (800s timeout)
- Create campaign for tomorrow's date
- Select AI apps/prompts for campaign
- Assign top 12 primary + 12 secondary posts (by score)
- Run deduplication (groups duplicate stories)

**Step 2: Generate Primary Titles** (800s timeout)
- Generate 6 primary article headlines (fast, batched)

**Steps 3-4: Generate Primary Bodies** (800s each)
- Batch 1: Generate 3 primary article bodies
- Batch 2: Generate 3 more primary article bodies

**Step 5: Fact-Check Primary** (800s timeout)
- Fact-check all 6 primary articles
- Store fact_check_score (0-10) and reasoning

**Step 6: Generate Secondary Titles** (800s timeout)
- Generate 6 secondary article headlines

**Steps 7-8: Generate Secondary Bodies** (800s each)
- Batch 1: Generate 3 secondary article bodies
- Batch 2: Generate 3 more secondary article bodies

**Step 9: Fact-Check Secondary** (800s timeout)
- Fact-check all 6 secondary articles

**Step 10: Finalize** (800s timeout)
- Auto-select top 3 articles per section (by fact-check score)
- Generate welcome section
- Generate subject line
- Set status to `draft`
- Unassign unused posts (Stage 1 cleanup)

### Triggering the Workflow

**Cron:** `/api/cron/trigger-workflow` (runs every 5 minutes)
- Checks if workflow should run based on schedule
- Calls `/api/workflows/process-rss` (Vercel Workflow endpoint)

**Manual:** Dashboard button → calls `/api/workflows/process-rss` directly

---

## 🤖 AI Integration

### Standard Pattern: `callAIWithPrompt()`

**Location:** `src/lib/openai.ts`

**How it works:**
1. Loads **complete JSON prompt** from `app_settings` table
2. Replaces placeholders (e.g., `{{title}}`, `{{content}}`)
3. Calls AI API (OpenAI or Claude)
4. Returns parsed JSON response

**Usage:**

```typescript
import { callAIWithPrompt } from '@/lib/openai'

const result = await callAIWithPrompt(
  'ai_prompt_primary_article_title',  // Key in app_settings
  newsletterId,
  {
    title: post.title,
    description: post.description,
    content: post.full_article_text
  }
)

// result = { headline: "Your Generated Title" }
```

### Prompt Storage (app_settings)

**Format:** Complete JSON API request

```sql
INSERT INTO app_settings (key, value, newsletter_id, ai_provider)
VALUES (
  'ai_prompt_primary_article_title',
  '{
    "model": "gpt-4o",
    "temperature": 0.7,
    "max_output_tokens": 500,
    "response_format": { "type": "json_schema", "json_schema": {...} },
    "messages": [
      {"role": "system", "content": "You are a headline writer..."},
      {"role": "user", "content": "Title: {{title}}\n\nWrite a headline."}
    ]
  }',
  'newsletter-uuid',
  'openai'
);
```

**All parameters** (model, temperature, messages, response_format) are **stored in database**, not hardcoded.

### Multi-Criteria Post Scoring

**See:** `MULTI_CRITERIA_SCORING_GUIDE.md` for full details

**Overview:**
- System evaluates posts using **1-5 customizable criteria**
- Each criterion gets **separate AI call** with dedicated prompt
- Scores: 0-10 per criterion, weighted sum for `total_score`
- Stored in `post_ratings` table

**Example:**

```
Criterion 1: Interest Level (weight 1.5) → score 8 → weighted 12.0
Criterion 2: Relevance (weight 1.5)     → score 7 → weighted 10.5
Criterion 3: Impact (weight 1.0)        → score 6 → weighted 6.0
Total Score: 28.5
```

**Configuration (app_settings):**
- `criteria_enabled_count` - How many criteria (1-5)
- `criteria_1_name`, `criteria_1_weight` - Name and importance
- `ai_prompt_criteria_1` - Plain text prompt (not JSON)
- Repeat for criteria 2-5

**Key Functions:**
- `RSSProcessor.evaluatePost()` - Orchestrates multi-criteria scoring
- `RSSProcessor.scorePostsForSection()` - Batch processing wrapper

---

## 📅 Automation & Cron Jobs

**Configuration:** `vercel.json`

**Key Cron Jobs:**

| Cron | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/trigger-workflow` | Every 5 min | Trigger RSS workflow if scheduled |
| `/api/cron/ingest-rss` | Every 15 min | Fetch & score new RSS posts |
| `/api/cron/send-review` | Every 5 min | Send review emails (status: ready) |
| `/api/cron/send-final` | Every 5 min | Send final campaigns (status: approved) |
| `/api/cron/monitor-workflows` | Every 5 min | Check for failed/stuck workflows |

**Workflow Execution:**
- Workflow runs via Vercel Workflows API
- Each step isolated with 800s timeout
- Automatic retry on transient failures
- Status stored in campaign record

---

## 📚 Documentation Map

### Essential Reading

| Task | Read First |
|------|-----------|
| **RSS Workflow** | This file → `src/lib/workflows/process-rss-workflow.ts` |
| **Post Scoring** | `MULTI_CRITERIA_SCORING_GUIDE.md` |
| **AI Prompts** | `docs/AI_PROMPT_SYSTEM_GUIDE.md` |
| **OpenAI API** | `docs/OPENAI_RESPONSES_API_GUIDE.md` |
| **Database** | This file (Schema section) |
| **Cron Jobs** | This file + `vercel.json` |

### External API Docs

| Stack | Docs |
|-------|------|
| **Next.js** | `docs/nextjs.md` (patterns), `docs/nextjs-full.md` (reference) |
| **Supabase** | `docs/supabase-guides.md` (usage), `docs/supabase-js.md` (API) |
| **OpenAI** | `docs/openai-guides.md` (patterns), `docs/openai-api.md` (reference) |
| **Vercel** | `docs/vercel-api.md` (deployment, cron) |

---

## 🔧 Common Patterns

### API Route Template

```typescript
// app/api/[feature]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.campaignId) {
      return NextResponse.json(
        { error: 'Missing campaignId' },
        { status: 400 }
      )
    }

    const result = await processData(body)
    return NextResponse.json({ data: result })

  } catch (error: any) {
    console.error('[API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const maxDuration = 600  // 10 minutes
```

### Database Query Template

```typescript
const { data, error } = await supabaseAdmin
  .from('newsletter_campaigns')
  .select('id, status, date')
  .eq('newsletter_id', newsletterId)  // REQUIRED
  .eq('id', campaignId)
  .single()

if (error) {
  console.error('[DB] Query failed:', error.message)
  throw new Error('Database error')
}

if (!data) {
  console.log('[DB] No campaign found')
  return null
}

return data
```

### AI Call with Batching

```typescript
const BATCH_SIZE = 3
const BATCH_DELAY = 2000  // 2 seconds

const batches = chunkArray(posts, BATCH_SIZE)
for (const batch of batches) {
  await Promise.all(batch.map(post => processWithAI(post)))
  await sleep(BATCH_DELAY)
}

console.log(`[AI] Processed ${posts.length} items in ${batches.length} batches`)

// Helper functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
```

---

## 🐛 Troubleshooting

### Campaign Stuck in "processing"

```sql
-- Check workflow status
SELECT id, status, date, created_at, updated_at
FROM newsletter_campaigns
WHERE status = 'processing'
ORDER BY created_at DESC;

-- Reset to draft (if needed)
UPDATE newsletter_campaigns
SET status = 'draft'
WHERE id = 'CAMPAIGN_ID';
```

### Posts Not Scoring

1. Check RSS ingestion: `/api/cron/ingest-rss` logs
2. Verify criteria config: `SELECT * FROM app_settings WHERE key LIKE 'criteria_%'`
3. Check prompts exist: `SELECT * FROM app_settings WHERE key LIKE 'ai_prompt_criteria_%'`
4. Verify feeds active: `SELECT * FROM rss_feeds WHERE active = true`

### Workflow Failures

1. Check Vercel logs: `vercel logs --since 1h`
2. Check workflow monitor cron: `/api/cron/monitor-workflows`
3. Look for timeout errors (step > 800s)
4. Check retry count in logs

### Date Issues

- Symptom: Wrong campaign date, empty campaigns
- Fix: Verify no `toISOString()` or `toUTCString()` in date logic
- Use: `date.split('T')[0]` for comparisons

---

## ✅ Pre-Flight Checklist

**Before marking task complete:**

### Critical (Must Check)
- [ ] TypeScript compiles: `npm run type-check`
- [ ] All queries filter by `newsletter_id`
- [ ] No UTC date conversions for comparisons
- [ ] Logging is minimal (one-line summaries)
- [ ] Error handling present (try-catch with logging)

### If Database Work
- [ ] Queries check for errors
- [ ] Only select needed fields (not `SELECT *`)
- [ ] Tested with actual data

### If AI Integration
- [ ] Uses `callAIWithPrompt()` (not hardcoded prompts)
- [ ] Placeholders replaced correctly
- [ ] Error handling for rate limits

### If Workflow Changes
- [ ] Each step has retry logic
- [ ] Timeout < 800 seconds per step
- [ ] Proper logging with step numbers

---

## 🔐 Security

**Never:**
- Log API keys (even in debugging)
- Skip `newsletter_id` filter (data leakage risk)
- Allow user input without validation
- Expose internal IDs in public APIs

**Always:**
- Use `supabaseAdmin` for server-side queries
- Validate input in API routes
- Check auth for protected endpoints
- Filter by `newsletter_id` for multi-tenant

---

## 🍳 Quick Recipes

### Add New AI Prompt

```sql
-- 1. Add to database
INSERT INTO app_settings (key, value, description, newsletter_id, ai_provider)
VALUES (
  'ai_prompt_new_feature',
  '{"model": "gpt-4o", "messages": [...]}',
  'Content Generation - Feature Name: Description',
  'newsletter-uuid',
  'openai'
);

-- 2. Use in code
const result = await callAIWithPrompt(
  'ai_prompt_new_feature',
  newsletterId,
  { placeholder: value }
)
```

### Add New Workflow Step

```typescript
async function newStep(campaignId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step X/10] Starting...')
      // Your logic here
      console.log('[Workflow Step X/10] ✓ Complete')
      return
    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step X/10] Failed after retries`)
        throw error
      }
      console.log(`[Workflow Step X/10] Retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}
```

### Debug Campaign

```typescript
// Check campaign data
const { data: campaign } = await supabaseAdmin
  .from('newsletter_campaigns')
  .select(`
    id, status, date,
    articles(id, headline, fact_check_score),
    secondary_articles(id, headline, fact_check_score)
  `)
  .eq('id', campaignId)
  .single()

console.log('Campaign:', campaign)
console.log('Primary articles:', campaign.articles?.length)
console.log('Secondary articles:', campaign.secondary_articles?.length)
```

---

## 📝 Summary

**Key Principles:**

1. **Multi-tenant:** Always filter by `newsletter_id`
2. **Date handling:** Never use UTC for comparisons
3. **Performance:** 800s step timeout, minimal logging
4. **AI integration:** Use `callAIWithPrompt()` with database prompts
5. **Error handling:** Retry logic on all workflow steps
6. **Clarity:** Ask when confidence < 80%

**Core Workflow:**

```
RSS Ingest (every 15 min)
  → Score posts (multi-criteria)
    → Workflow trigger (checks schedule)
      → 10-step generation workflow
        → Campaign ready (status: draft)
          → Review & send
```

**When in doubt:**
- Check this file first
- Read task-specific docs
- Review actual implementation
- Ask for clarification

---

**Document Version:** 2.0 (Condensed & Current)
**Last Updated:** 2025-01-07
**Word Count:** ~2,800 (was ~5,500)
