# AI Pros Newsletter Platform - Development Context

**Last Updated:** 2025-01-22
**Project:** Multi-tenant Newsletter Automation Platform
**Stack:** Next.js 15 + Supabase + OpenAI + MailerLite

---

## 🎯 Critical Reading Order

**ALWAYS read in this order before ANY task:**

1. **This file (CLAUDE.md)** - Complete context (you are here)
2. **Task-specific documentation** - See Documentation Map below

**Skip unnecessary docs** - Only read what's relevant to your task.

---

## 📚 Documentation Map (Available References)

### Core Stack (Read Based on Task)

#### Next.js (App Router, API Routes, Cron Jobs)
- **Primary:** `docs/nextjs.md` - Core Next.js patterns and APIs
- **Deep dive:** `docs/nextjs-full.md` - Comprehensive Next.js documentation
- **When to use:**
  - Creating/modifying API routes (`app/api/*`)
  - Working with cron jobs
  - Server Components vs Client Components
  - Middleware and routing

#### Supabase (Database, Auth, Storage)
- **Index:** `docs/supabase-index.md` - Overview and getting started
- **Primary:** `docs/supabase-guides.md` - Usage patterns and best practices
- **JavaScript SDK:** `docs/supabase-js.md` - Full JavaScript client reference
- **CLI:** `docs/supabase-cli.md` - Command-line tools (migrations, etc.)
- **Python SDK:** `docs/supabase-python.md` - Python client (if needed)
- **When to use:**
  - Database queries and mutations
  - Row Level Security (RLS) policies
  - Real-time subscriptions
  - File storage operations

#### OpenAI (Content Generation, Scoring)
- **Index:** `docs/openai-index.md` - API overview
- **Primary:** `docs/openai-guides.md` - Usage guides and best practices
- **API Reference:** `docs/openai-api.md` - Complete API documentation
- **Models & Pricing:** `docs/openai-models.md` - Model comparison and costs
- **Deep dive:** `docs/openai-full.md` - Comprehensive documentation
- **When to use:**
  - Article generation from RSS content
  - Post scoring and evaluation
  - Subject line generation
  - Any AI/LLM integration

#### Vercel (Deployment, Cron, Serverless)
- **Primary:** `docs/vercel-api.md` - Vercel platform and deployment API
- **When to use:**
  - Configuring cron jobs (vercel.json)
  - Environment variables
  - Function timeouts and limits
  - Deployment configuration

#### Vercel AI SDK (Streaming, AI Integration)
- **Primary:** `docs/vercel-ai-sdk.md` - AI SDK patterns and utilities
- **When to use:**
  - Streaming AI responses
  - AI SDK utilities (streamText, etc.)
  - Client-side AI integration
  - **Note:** Currently not heavily used in this project

### Optional/Reference Documentation

#### Anthropic (Claude-specific)
- **Full docs:** `docs/anthropic.md` - Claude API reference
- **When to use:**
  - If you decide to use Claude API instead of OpenAI
  - Understanding Claude-specific features
  - **Note:** Not currently used in project

#### Perplexity (Alternative AI Search)
- **Primary:** `docs/perplexity.md` - Perplexity API overview
- **Deep dive:** `docs/perplexity-full.md` - Full documentation
- **When to use:**
  - If implementing AI-powered search features
  - Alternative to OpenAI for certain tasks
  - **Note:** Not currently used in project

---

## 🧭 Quick Navigation Guide

**Based on your task, read these docs:**

### Task: Creating/Modifying API Routes
```
Read: 
1. CLAUDE.md (this file) - Critical rules
2. docs/nextjs.md - API route patterns
3. docs/vercel-api.md - If working with cron/timeouts
```

### Task: Database Query/Schema Changes
```
Read:
1. CLAUDE.md (this file) - Critical rules (multi-tenant!)
2. docs/supabase-guides.md - Query patterns
3. docs/supabase-js.md - Specific SDK methods
```

### Task: RSS Processing/AI Integration
```
Read:
1. CLAUDE.md (this file) - Critical rules + RSS workflow
2. docs/openai-guides.md - AI best practices
3. docs/openai-api.md - Specific API methods
```

### Task: Cron Job Modification
```
Read:
1. CLAUDE.md (this file) - Critical rules
2. docs/nextjs.md - Cron route patterns
3. docs/vercel-api.md - Cron configuration
```

### Task: Email Campaign Features
```
Read:
1. CLAUDE.md (this file) - MailerLite patterns included
2. docs/nextjs.md - API route patterns (if creating endpoints)
```

### Task: Bug Fix
```
Read:
1. CLAUDE.md (this file) - See troubleshooting section
2. [Relevant doc based on bug location]
```

**Rule of thumb:** Read CLAUDE.md first (always), then 1-2 specific docs (rarely need more).

---

## ⚠️ CRITICAL DEVELOPMENT RULES

### 1. Confidence and Clarification Policy

**When confidence is below 80%, STOP and ask for clarification.**

❌ **NEVER** proceed with assumptions
✅ **ALWAYS** ask using multiple choice format with pros/cons

**Template:**
```
I'm not certain about [aspect]. Here are the options:

A) [Approach 1]
   Pros: [Benefits]
   Cons: [Drawbacks]
   Impact: [Performance/Database/Architecture]

B) [Approach 2]
   Pros: [Benefits]
   Cons: [Drawbacks]
   Impact: [Performance/Database/Architecture]

Which approach fits better with the project goals?
```

**Ask when uncertain about:**
- Requirements or expected behavior
- Implementation approach or architecture
- Potential impacts on existing features
- Performance implications
- Security considerations

---

### 2. Date/Time Handling Policy

**ALL date operations MUST use local (non-UTC) comparisons.**

❌ **FORBIDDEN:**
```typescript
date.toISOString()        // Causes timezone shifts
date.toUTCString()        // Breaks date comparisons
new Date().toISOString()  // Wrong for filtering
```

✅ **REQUIRED:**
```typescript
// Extract date string directly (NO UTC conversion)
const dateStr = date.split('T')[0];  // "2025-01-22"

// Compare dates as strings
const today = new Date().toISOString().split('T')[0];
if (dateStr === today) { 
  // Correct: Local date comparison
}

// Filter by date in queries
const { data } = await supabase
  .from('campaigns')
  .select('*')
  .gte('date', '2025-01-22')  // String comparison
  .lte('date', '2025-01-23');

// Sort dates
campaigns.sort((a, b) => a.date.localeCompare(b.date));
```

**Why:** UTC conversion shifts dates forward/backward by timezone, breaking filters. Users expect Central Time. Example: At 11 PM CST, `toISOString()` gives next day's date in UTC.

---

### 3. Performance Rules (Vercel Limits)

**Hard Limits (will fail if exceeded):**
- Timeout: 600 seconds (10 minutes)
- Log Size: 10MB maximum
- Memory: 1024MB default
- Response: 4.5MB maximum

#### Minimal Logging (Prevent 10MB Overflow)

```typescript
// ✅ GOOD: Essential milestones with prefixes
console.log('[RSS] Step 1: Archived 120 posts, fetched 45 new');
console.log('[CRON] Job complete: 3 campaigns processed');
console.error('[RSS] ERROR:', error.message);

// ❌ BAD: Excessive detail
console.log('Starting...');
console.log('Processing item 1...');
console.log('Processing item 2...');
console.log('Item 1 complete');
// ... 100+ more logs (FORBIDDEN)
```

**Log Prefixes:**
- `[RSS]` - RSS processing
- `[CRON]` - Cron jobs
- `[DB]` - Database operations
- `[AI]` - OpenAI operations
- `[EMAIL]` - MailerLite operations

#### Batch Processing (Prevent Rate Limits & Timeouts)

```typescript
// AI API calls - REQUIRED pattern
const BATCH_SIZE = 3;
const BATCH_DELAY = 2000; // milliseconds

const batches = chunkArray(posts, BATCH_SIZE);
for (const batch of batches) {
  await Promise.all(batch.map(post => scorePost(post)));
  await sleep(BATCH_DELAY);
}

// Helper functions (add if not exists)
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
```

#### Retry Logic Pattern

```typescript
// REQUIRED: Retry once on transient failures
async function executeStepWithRetry(
  stepFn: () => Promise<void>,
  stepName: string
): Promise<void> {
  try {
    await stepFn();
  } catch (error) {
    console.error(`[RSS] ${stepName} failed, retrying...`);
    try {
      await stepFn(); // One retry
    } catch (retryError) {
      console.error(`[RSS] ${stepName} retry failed`);
      throw retryError;
    }
  }
}
```

---

## 🏆 Rule Precedence (When Rules Conflict)

**Priority Order:**

1. **Security** - Never compromise
   - Never log API keys (even debugging)
   - Always validate input (even if adds latency)
   - Always filter by newsletter_id (even if slower)

2. **Data Integrity** - Never compromise
   - Always check for errors before proceeding
   - Never skip validation to save tokens
   - Multi-tenant isolation required

3. **Performance Limits** - Hard limits (will hard fail)
   - 600 second timeout
   - 10MB log limit
   - Must use minimal logging if approaching limits

4. **Code Quality** - Best practices (can bend in emergencies)
   - TypeScript types preferred (any acceptable with comment)
   - Try-catch preferred (can omit for simple queries)
   - Comprehensive error handling preferred (minimal acceptable)

**Decision Examples:**
- "Should I log detailed error info if approaching 8MB?" → NO (Priority 3 > 4)
- "Should I skip newsletter_id filter for speed?" → NO (Priority 2 > 3)
- "Should I use 'any' type to save time?" → MAYBE (Priority 4, add comment)

---

## 🏗️ Project Architecture

### Multi-Tenant System

```
Newsletter Slug → Database Isolation
    ↓
"accounting" → AI Accounting Daily → newsletter_id = 'accounting'
```

**CRITICAL RULE:** Every database query MUST include:
```typescript
.eq('newsletter_id', newsletterId)
```

**Example:**
```typescript
// ✅ CORRECT
const { data } = await supabase
  .from('articles')
  .select('*')
  .eq('campaign_id', campaignId)
  .eq('newsletter_id', 'accounting');  // REQUIRED

// ❌ WRONG - Data leakage!
const { data } = await supabase
  .from('articles')
  .select('*')
  .eq('campaign_id', campaignId);
```

---

### Database Schema (Key Tables)

**Campaign Flow:**
```
newsletter_campaigns (status: draft → processing → in_review → ready_to_send → sent)
  ├── articles (primary section, scored & ranked)
  ├── secondary_articles (secondary section)
  └── rss_posts (raw feed data)
      └── post_ratings (AI evaluation scores)
```

**Archive:** `archived_articles`, `archived_rss_posts`
**Config:** `app_settings` (key-value pairs scoped by newsletter_id)
**Sources:** `rss_feeds` (active/inactive, section assignment)

---

## 🔄 RSS Processing Workflow (4 Combined Steps)

**Pattern:** Each step retries once on failure. Campaign marked as `failed` if step fails twice.

**Step 1:** Archive old data + Fetch RSS → `rss_posts`
**Step 2:** Extract full text + Score posts → `post_ratings`  
**Step 3:** Generate articles → `articles` + `secondary_articles`
**Step 4:** Finalize → Status: `in_review`, send notifications

**Implementation Pattern:**
```typescript
// Location: src/app/api/rss/combined-steps/step[1-4]-*.ts
export async function executeStep(campaignId: string): Promise<void> {
  try {
    // Step logic here
    console.log(`[RSS] Step N complete: X items processed`);
  } catch (error) {
    console.error('[RSS] Step N failed:', error.message);
    throw error;
  }
}
```

**Process endpoint:** `src/app/api/rss/process/route.ts`
- Calls steps 1-4 sequentially with retry logic
- Marks campaign as `failed` if any step fails twice
- Timeout: 600 seconds (configured in vercel.json)

---

## 🤖 AI Integration Patterns

### 🚨 CRITICAL: How AI Prompts Work

**ALL AI prompts are stored as complete JSON API requests in the `app_settings` table.**

- ✅ **Prompts contain EVERYTHING**: model, messages, temperature, max_output_tokens, response_format, etc.
- ✅ **NO parameters should be hardcoded** in application code
- ✅ **Use placeholders** in prompts: `{{title}}`, `{{content}}`, `{{description}}`, `{{url}}`
- ✅ **Prompts are sent EXACTLY as stored** (only placeholders are replaced)

**Database Structure:**
```sql
app_settings (
  key TEXT,               -- e.g. 'ai_prompt_primary_article_title'
  value JSONB,            -- Complete JSON API request
  ai_provider TEXT        -- 'openai' or 'claude'
)
```

### Standard Pattern: Use callAIWithPrompt()

**✅ CORRECT - Use this pattern for ALL AI calls:**

```typescript
import { callAIWithPrompt } from '@/lib/openai'

// Example: Generate article title
const result = await callAIWithPrompt(
  'ai_prompt_primary_article_title',  // Key in app_settings
  {
    title: post.title,
    description: post.description,
    content: post.full_article_text
  }
)

// result = { headline: "Your Generated Title" }
```

**How it works:**
1. Loads complete JSON from database (model, messages, all parameters)
2. Replaces placeholders (`{{title}}` → actual title)
3. Sends to AI API exactly as-is
4. Returns parsed JSON response

### Example Prompt in Database

**Key:** `ai_prompt_primary_article_title`

**Value (JSONB):**
```json
{
  "model": "gpt-4o",
  "temperature": 0.7,
  "max_output_tokens": 500,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "ArticleTitle",
      "schema": {
        "type": "object",
        "properties": {
          "headline": { "type": "string" }
        },
        "required": ["headline"],
        "additionalProperties": false
      },
      "strict": true
    }
  },
  "messages": [
    {
      "role": "system",
      "content": "You are a headline writer for a newsletter..."
    },
    {
      "role": "user",
      "content": "Title: {{title}}\nContent: {{content}}\n\nWrite a headline."
    }
  ]
}
```

**AI Provider:** `openai`

### Post Scoring with Batching

```typescript
import { callAIWithPrompt } from '@/lib/openai'

// REQUIRED: Batch of 3, 2s delay
const BATCH_SIZE = 3
const BATCH_DELAY = 2000

const batches = chunkArray(posts, BATCH_SIZE)
for (const batch of batches) {
  await Promise.all(batch.map(post => scorePost(post)))
  await sleep(BATCH_DELAY)
}

async function scorePost(post: RSSPost): Promise<number> {
  // Prompt is loaded from database with all parameters
  const result = await callAIWithPrompt(
    'ai_prompt_post_scorer',
    {
      title: post.title,
      description: post.description || '',
      content: post.full_article_text || ''
    }
  )

  // result = { score: 85, reasoning: "..." }
  console.log(`[AI] Post scored: ${result.score}`)
  return result.score
}
```

### Error Handling

```typescript
try {
  const result = await callAIWithPrompt('ai_prompt_key', placeholders)

  // Process result
  console.log('[AI] Success:', result)

} catch (error: any) {
  if (error.status === 429) {
    // Rate limit - wait and retry
    console.log('[AI] Rate limit, waiting 5s...')
    await sleep(5000)
    return callAIWithPrompt('ai_prompt_key', placeholders) // Retry once
  }

  console.error('[AI] Error:', error.message)
  throw error
}
```

### 🚫 DEPRECATED Patterns (Do NOT use)

```typescript
// ❌ WRONG: Hardcoding parameters
const response = await openai.responses.create({
  model: 'gpt-4o',           // ❌ Hardcoded
  temperature: 0.7,           // ❌ Hardcoded
  max_output_tokens: 1000,    // ❌ Hardcoded
  messages: [...]
})

// ❌ WRONG: Building prompts manually
const systemPrompt = await getPrompt('key')
const prompt = `${systemPrompt}\n\n${content}`

// ✅ CORRECT: Use callAIWithPrompt
const result = await callAIWithPrompt('ai_prompt_key', { content })
```

---

## 📚 Documentation Patterns

### Next.js Patterns

**API Route Handler:**
```typescript
// app/api/[feature]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate
    if (!body.campaignId) {
      return NextResponse.json(
        { error: 'Missing campaignId' },
        { status: 400 }
      );
    }
    
    // Process
    const result = await processData(body);
    
    return NextResponse.json({ data: result });
    
  } catch (error: any) {
    console.error('[API] Error:', error.message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const maxDuration = 600; // 10 minutes
```

**Cron Job Route:**
```typescript
// app/api/cron/[job]/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  // Auth check
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    console.log('[CRON] Starting job...');
    await processJob();
    console.log('[CRON] Job complete');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[CRON] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const maxDuration = 600;
```

---

### Supabase Patterns

**Server-side Client (bypasses RLS):**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.DATABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

**Query Pattern (ALWAYS check errors):**
```typescript
const { data, error } = await supabase
  .from('newsletter_campaigns')
  .select('id, status, date')  // Only needed fields
  .eq('newsletter_id', 'accounting')  // REQUIRED
  .eq('id', campaignId)
  .single();

if (error) {
  console.error('[DB] Query failed:', error.message);
  throw new Error('Database error');
}

if (!data) {
  console.log('[DB] No campaign found');
  return null;
}

return data;
```

**Batch Operations:**
```typescript
// Multiple inserts - use upsert
await supabase
  .from('articles')
  .upsert(articlesArray);  // One query, not multiple
```

---

### MailerLite Integration

**Create Campaign:**
```typescript
const MAILERLITE_API = 'https://connect.mailerlite.com/api';

async function createCampaign(subject: string, content: string): Promise<string> {
  const response = await fetch(`${MAILERLITE_API}/campaigns`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: subject,
      type: 'regular',
      emails: [{
        subject,
        from_name: 'AI Accounting Daily',
        from: 'noreply@aiaccountingdaily.com',
        content,
      }],
    }),
  });
  
  if (!response.ok) {
    throw new Error(`MailerLite error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data.id;
}
```

---

## 📅 Automation & Scheduling

### Cron Schedule (Central Time)

**Configured in:** `vercel.json` + `app_settings` table

- **10:00 AM:** RSS processing → status: `processing`
- **12:00 PM:** Article generation → status: `in_review`
- **2:00 PM:** Review campaign → MailerLite test send
- **Next day:** Final send → status: `sent`

### Vercel Cron Configuration

```json
{
  "crons": [
    {
      "path": "/api/cron/process-rss",
      "schedule": "0 10 * * *"
    }
  ]
}
```

---

## 🐛 Common Issues (Quick Reference)

**Dates shifting:** Used `.toISOString()` → Use `.split('T')[0]`
**Function timeout:** Too slow → Batch AI calls (3 at a time, 2s delay)
**Log overflow:** Too verbose → Minimal logging ([PREFIX] format only)
**Rate limits:** Too fast → Use `BATCH_SIZE=3`, `BATCH_DELAY=2000`
**Campaign stuck:** Step failed → Check Vercel logs, manually update status:
```sql
UPDATE newsletter_campaigns SET status = 'draft' WHERE id = 'CAMPAIGN_ID';
```
**Data leakage:** Missing filter → Always `.eq('newsletter_id', newsletterId)`

---

## ✅ Code Quality Standards

### TypeScript

```typescript
// ✅ Explicit types
interface Campaign {
  id: string;
  status: 'draft' | 'processing' | 'in_review' | 'ready_to_send' | 'sent';
  date: string; // YYYY-MM-DD
  newsletter_id: string;
}

async function getCampaign(id: string): Promise<Campaign | null> {
  // Implementation
}

// ❌ NEVER use 'any' (use 'unknown' with type guards if needed)
const data: any = await fetchData(); // FORBIDDEN
```

### Error Handling

```typescript
// ✅ REQUIRED: Try-catch with context
try {
  await processStep(data);
} catch (error: any) {
  console.error('[PROCESS] Failed for ID:', data.id, error.message);
  
  // Retry for transient errors
  if (error.code === 'ETIMEDOUT') {
    await sleep(2000);
    return processStep(data);
  }
  
  throw error; // Re-throw after logging
}

// ❌ FORBIDDEN: Silent failures
try {
  await something();
} catch (error) {
  // No logging, no re-throw
}
```

### Database Queries

```typescript
// ✅ ALWAYS: Check errors, filter by newsletter_id
const { data, error } = await supabase
  .from('articles')
  .select('id, title, content')  // Specify fields
  .eq('campaign_id', campaignId)
  .eq('newsletter_id', newsletterId)  // REQUIRED
  .order('rank', { ascending: true });

if (error) {
  console.error('[DB] Query failed:', error.message);
  throw error;
}

// ❌ FORBIDDEN: No error check, missing newsletter_id
const { data } = await supabase
  .from('articles')
  .select('*')
  .eq('campaign_id', campaignId);
```

### Environment Variables

```typescript
// ✅ CORRECT
const openaiKey = process.env.OPENAI_API_KEY;
if (!openaiKey) {
  throw new Error('OPENAI_API_KEY required');
}

// ❌ FORBIDDEN: Hardcoded or logged
const key = 'sk-proj-abc123...';
console.log('Using key:', process.env.OPENAI_API_KEY);
```

---

## 📋 Effective Prompting Template

```
[Task description]

Context:
- Read CLAUDE.md first
- This is a [type: API route / database query / cron job / UI component]
- Reference docs/[relevant-doc].md for [specific pattern]

Requirements:
1. [Specific, measurable requirement]
2. [Specific, measurable requirement]
3. [Specific, measurable requirement]

Technical:
- Pattern: [from CLAUDE.md or PATTERNS.md if exists]
- Tables: [list if database work]
- Multi-tenant: Filter by newsletter_id='accounting'
- Performance: [if relevant: batching, minimal logging]
- Logging: See Critical Rules > Minimal Logging

Files:
- [full/path/to/file.ts] - [what to change]
```

**Example:**
```
Create email validation function

Context:
- Read CLAUDE.md first
- This is a utility function for server actions
- Reference docs/nextjs.md for server action patterns

Requirements:
1. Validate email format using regex
2. Check if email already exists in database
3. Return { valid: boolean, error?: string }

Technical:
- Pattern: Standard async function with error handling
- Tables: newsletter_campaigns (check for duplicate emails)
- Multi-tenant: Filter by newsletter_id='accounting'
- Performance: Minimal logging

Files:
- lib/validation.ts - Create new function
- app/api/subscribe/route.ts - Use validation
```

---

## 🎯 Pre-Flight Checklist

**Before marking task complete:**

### Critical (Must Check)
- [ ] TypeScript compiles: `npm run type-check`
- [ ] No UTC date methods for comparisons
- [ ] All queries filter by newsletter_id
- [ ] Logging is minimal ([PREFIX] format, no loops)
- [ ] Error handling present (try-catch with logging)

### If Database Work
- [ ] Queries check for errors
- [ ] Only select needed fields (not `SELECT *`)
- [ ] Tested with real campaign data

### If AI Integration
- [ ] Batched (3 at a time)
- [ ] 2 second delays between batches
- [ ] Rate limit error handling

### If Performance Sensitive
- [ ] Function duration reasonable (< 600s)
- [ ] Log size under control (< 1MB estimated)
- [ ] No excessive loops or nested operations

---

## 🔐 Security Checklist

- [ ] No hardcoded API keys or secrets
- [ ] All env vars accessed via `process.env`
- [ ] No sensitive data in logs
- [ ] API routes have auth checks (if not public)
- [ ] Input validation on all user data
- [ ] Multi-tenant isolation (newsletter_id filter)

---

## 📞 When You Need Help

**Use this format when confidence < 80%:**

```
I'm uncertain about [specific aspect]. Here are the approaches:

A) [Option 1: Description]
   Pros: [Benefit 1], [Benefit 2]
   Cons: [Drawback 1], [Drawback 2]
   Impact: [Database/Performance/Architecture]

B) [Option 2: Description]
   Pros: [Benefit 1], [Benefit 2]
   Cons: [Drawback 1], [Drawback 2]
   Impact: [Database/Performance/Architecture]

Which approach fits better with the project goals?

Additional context:
- [Background information]
- [Constraints]
- [Related systems affected]
```

---

## 🍳 Quick Recipes (Copy-Paste)

### Recipe 1: Add Database Query

```typescript
const { data, error } = await supabase
  .from('YOUR_TABLE')
  .select('id, name, created_at')  // Only needed fields
  .eq('newsletter_id', newsletterId)  // REQUIRED
  .order('created_at', { ascending: false });

if (error) {
  console.error('[DB] Query failed:', error.message);
  throw new Error('Database error');
}

if (!data || data.length === 0) {
  return [];
}

return data;
```

### Recipe 2: Add API Route

```typescript
// app/api/YOUR_ROUTE/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.requiredField) {
      return NextResponse.json(
        { error: 'Missing requiredField' },
        { status: 400 }
      );
    }
    
    const result = await yourLogic(body);
    return NextResponse.json({ data: result });
    
  } catch (error: any) {
    console.error('[API] Error:', error.message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const maxDuration = 60;
```

### Recipe 3: Add Batch AI Processing

```typescript
const BATCH_SIZE = 3;
const BATCH_DELAY = 2000;

const batches = chunkArray(items, BATCH_SIZE);
for (const batch of batches) {
  await Promise.all(batch.map(item => processWithAI(item)));
  await sleep(BATCH_DELAY);
}

console.log(`[AI] Processed ${items.length} items in ${batches.length} batches`);
```

### Recipe 4: Add Minimal Logging

```typescript
// ✅ One line summary
console.log('[MODULE] Operation complete: 45 items processed, 3 errors');

// ❌ NOT this
console.log('Starting operation');
for (const item of items) {
  console.log('Processing', item.id);
  // ...
}
console.log('Complete');
```

### Recipe 5: Add Date Comparison

```typescript
// ✅ CORRECT: String comparison, no UTC
const campaignDate = campaign.date.split('T')[0];
const today = new Date().toISOString().split('T')[0];

if (campaignDate === today) {
  // Today's campaign
} else if (campaignDate > today) {
  // Future campaign
}
```

---

## 🎓 Confidence Calibration Guide

### 95% Confidence (Proceed)
- Add console.log to existing function
- Fix typo in UI text
- Update simple configuration value
- Copy existing pattern to new file

### 80% Confidence (Borderline - Consider Asking)
- Add new database column
- Change existing API response structure
- Modify AI prompt significantly
- Optimize performance of existing code

### 60% Confidence (MUST ASK)
- "Optimize RSS processing" (vague - how much? which part?)
- Multiple ways to implement feature
- Performance/quality tradeoffs unclear
- Might break existing functionality

### 40% Confidence (STOP - Need Context)
- "Fix the bug" (what bug? where? expected behavior?)
- "Make it better" (better how? by what metric?)
- Unclear requirements
- Unknown expected behavior

---

**Document Version:** 2.1 (Streamlined)
**Last Updated:** 2025-01-22
**Word Count:** ~5,500 (was 35,000)
**Token Count:** ~7,500 (was 50,000)
