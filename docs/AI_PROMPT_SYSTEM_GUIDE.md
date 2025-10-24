# AI Prompt System - Complete Implementation Guide

**Purpose**: Document the editable AI prompt system from AI Pros Newsletter for replication in other projects.

**Last Updated**: 2025-01-24

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Prompt Formats](#prompt-formats)
4. [Backend Implementation](#backend-implementation)
5. [Frontend UI Implementation](#frontend-ui-implementation)
6. [Test System](#test-system)
7. [Migration Scripts](#migration-scripts)
8. [Step-by-Step Setup Guide](#step-by-step-setup-guide)

---

## System Overview

### What This System Does

- **Stores AI prompts in database** (not hardcoded) for easy editing
- **Supports two formats**: Plain text and Structured JSON (with model, temperature, messages)
- **UI for editing prompts** with live preview and testing
- **Test endpoint** to validate prompts before deploying
- **Fallback system** if database prompt fails to load

### Key Benefits

- Non-technical users can adjust prompts via UI
- A/B test different prompts without code deployment
- Centralized prompt management
- Version control through database
- Instant updates without rebuilding

---

## Database Schema

### Table: `app_settings`

```sql
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  newsletter_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_app_settings_key ON app_settings(key);
CREATE INDEX idx_app_settings_newsletter_id ON app_settings(newsletter_id);
```

### Key Naming Convention

```
ai_prompt_{purpose}
```

**Examples:**
- `ai_prompt_content_evaluator` - Post scoring
- `ai_prompt_newsletter_writer` - Article generation
- `ai_prompt_subject_line` - Subject line generation
- `ai_prompt_topic_deduper` - Duplicate detection

### Description Format

```
{Category} - {Name}: {Description}
```

**Example:**
```
Content Generation - Topic Deduplicator: AI prompt for detecting duplicate or similar topics across RSS posts. Groups duplicate stories together and identifies the best primary article to keep.
```

The settings page UI parses this to organize prompts into categories.

---

## Prompt Formats

### Format 1: Plain Text (Simple)

**Use when:** Single prompt, no need for conversation history or fine-tuned parameters.

**Database Storage:**
```sql
INSERT INTO app_settings (key, value, description)
VALUES (
  'ai_prompt_simple_example',
  to_jsonb('You are a helpful assistant that summarizes articles.

Article to summarize:
{{article_text}}

Provide a 2-3 sentence summary.'::text),
  'Content Generation - Simple Summarizer: Creates brief article summaries'
);
```

**Code Usage:**
```typescript
const prompt = await AI_PROMPTS.simpleSummarizer(articleText)
// Returns: String with {{article_text}} replaced
```

---

### Format 2: Structured JSON (Advanced)

**Use when:** Need control over model, temperature, or multi-turn conversations (few-shot examples).

**Database Storage:**
```sql
INSERT INTO app_settings (key, value, description)
VALUES (
  'ai_prompt_structured_example',
  jsonb_build_object(
    'model', 'gpt-4o',
    'temperature', 0.3,
    'top_p', 0.9,
    'presence_penalty', 0.2,
    'frequency_penalty', 0.1,
    'messages', jsonb_build_array(
      jsonb_build_object(
        'role', 'system',
        'content', 'You are an expert at analyzing content for duplicate detection.'
      ),
      jsonb_build_object(
        'role', 'assistant',
        'content', '{"result": "example output format"}'
      ),
      jsonb_build_object(
        'role', 'user',
        'content', 'Analyze these posts:\n\n{{posts}}\n\nReturn JSON with duplicate groups.'
      )
    )
  ),
  'Content Generation - Advanced Analyzer: Detects duplicates with structured output'
);
```

**Code Usage:**
```typescript
const prompt = await AI_PROMPTS.advancedAnalyzer(posts)
// Returns: API response from OpenAI with structured messages
```

**Why Structured Format?**
- Few-shot learning (show examples in conversation)
- Fine-tune model behavior (temperature, penalties)
- Better control over output format
- Conversation context for better results

---

## Backend Implementation

### Step 1: Create Prompt Loader (`src/lib/openai.ts`)

```typescript
import OpenAI from 'openai'
import { supabaseAdmin } from './supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// Helper: Call OpenAI with structured prompt configuration
async function callWithStructuredPrompt(
  config: {
    model?: string
    temperature?: number
    top_p?: number
    presence_penalty?: number
    frequency_penalty?: number
    messages: Array<{ role: string; content: string }>
  },
  placeholders: Record<string, string>
): Promise<string> {
  // Replace placeholders in messages
  const processedMessages = config.messages.map(msg => ({
    ...msg,
    content: Object.entries(placeholders).reduce(
      (content, [key, value]) => content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value),
      msg.content
    )
  }))

  const response = await openai.chat.completions.create({
    model: config.model || 'gpt-4o',
    messages: processedMessages as any,
    temperature: config.temperature ?? 0.7,
    top_p: config.top_p,
    presence_penalty: config.presence_penalty,
    frequency_penalty: config.frequency_penalty,
  })

  return response.choices[0]?.message?.content || ''
}

// Fallback prompts (if database is down)
const FALLBACK_PROMPTS = {
  contentEvaluator: (post: any) => `Rate this post: ${post.title}...`,
  // ... other fallbacks
}

// Main prompt loader object
export const AI_PROMPTS = {
  contentEvaluator: async (post: any) => {
    try {
      // 1. Load from database
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_content_evaluator')
        .single()

      if (error || !data) {
        console.log('[AI] Using fallback for contentEvaluator')
        return FALLBACK_PROMPTS.contentEvaluator(post)
      }

      console.log('[AI] Using database prompt for contentEvaluator')

      // 2. Format data for placeholders
      const postText = `Title: ${post.title}\nDescription: ${post.description}`

      // 3. Check if value is already parsed (Supabase auto-parses JSONB)
      let promptConfig: any
      if (typeof data.value === 'string') {
        try {
          promptConfig = JSON.parse(data.value)
        } catch (jsonError) {
          // Plain text format
          return data.value.replace(/\{\{post\}\}/g, postText)
        }
      } else if (typeof data.value === 'object' && data.value !== null) {
        promptConfig = data.value
      } else {
        return String(data.value).replace(/\{\{post\}\}/g, postText)
      }

      // 4. Check if structured JSON format
      if (promptConfig.messages && Array.isArray(promptConfig.messages)) {
        console.log('[AI] Using structured JSON prompt')
        const placeholders = { post: postText }
        return await callWithStructuredPrompt(promptConfig, placeholders)
      }

      // 5. Plain text fallback
      const promptText = typeof promptConfig === 'string'
        ? promptConfig
        : JSON.stringify(promptConfig)
      return promptText.replace(/\{\{post\}\}/g, postText)

    } catch (error) {
      console.error('[AI] Error loading prompt:', error)
      return FALLBACK_PROMPTS.contentEvaluator(post)
    }
  },

  // Add more prompt loaders following same pattern...
}
```

**Key Pattern Explained:**

1. **Try to load from database** (`.eq('key', 'ai_prompt_...')`)
2. **Format your data** into placeholder strings
3. **Detect format** (string vs object, plain vs structured)
4. **Handle structured prompts** with `callWithStructuredPrompt()`
5. **Fallback gracefully** if anything fails

---

### Step 2: Use Prompts in Your Code

```typescript
import { AI_PROMPTS } from '@/lib/openai'

// Example: Evaluate a post
async function evaluatePost(post: RSSPost) {
  const prompt = await AI_PROMPTS.contentEvaluator(post)
  // `prompt` is either:
  // - String (plain text) to use directly
  // - Already processed by structured handler (string response from OpenAI)

  // For plain text format, you still need to call OpenAI:
  if (typeof prompt === 'string' && !prompt.includes('openai-response-marker')) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    })
    return response.choices[0]?.message?.content || ''
  }

  return prompt // Already processed by structured handler
}
```

**Note**: The structured format calls OpenAI automatically inside `callWithStructuredPrompt()`. Plain text just returns the prompt string for you to call OpenAI yourself.

---

## Frontend UI Implementation

### Settings Page Structure

**Location**: `src/app/dashboard/[slug]/settings/page.tsx`

**Key Components:**

1. **Fetch prompts on load**
2. **Group by category** (parse description)
3. **Edit modal** with JSON/text editor
4. **Save handler**
5. **Test button** with results display

### Step 1: Fetch Prompts

```typescript
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface AIPrompt {
  key: string
  value: any // Can be string or object
  description: string
  category?: string
  name?: string
}

export default function SettingsPage() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPrompts()
  }, [])

  async function loadPrompts() {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value, description')
      .like('key', 'ai_prompt_%')
      .order('key')

    if (error) {
      console.error('Failed to load prompts:', error)
      return
    }

    // Parse descriptions for categorization
    const parsed = data.map(p => {
      const match = p.description?.match(/^(.+?)\s*-\s*(.+?):\s*(.+)$/)
      return {
        ...p,
        category: match?.[1] || 'Uncategorized',
        name: match?.[2] || p.key,
      }
    })

    setPrompts(parsed)
    setLoading(false)
  }

  // Group by category
  const groupedPrompts = prompts.reduce((acc, prompt) => {
    const cat = prompt.category || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(prompt)
    return acc
  }, {} as Record<string, AIPrompt[]>)

  return (
    <div>
      <h1>AI Prompts</h1>
      {Object.entries(groupedPrompts).map(([category, categoryPrompts]) => (
        <div key={category}>
          <h2>{category}</h2>
          {categoryPrompts.map(prompt => (
            <PromptCard
              key={prompt.key}
              prompt={prompt}
              onUpdate={loadPrompts}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
```

---

### Step 2: Prompt Card Component

```typescript
interface PromptCardProps {
  prompt: AIPrompt
  onUpdate: () => void
}

function PromptCard({ prompt, onUpdate }: PromptCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [testLoading, setTestLoading] = useState(false)

  // Format value for editing (pretty JSON or plain text)
  const formatValue = (val: any) => {
    if (typeof val === 'string') return val
    return JSON.stringify(val, null, 2)
  }

  const handleEdit = () => {
    setEditValue(formatValue(prompt.value))
    setIsEditing(true)
  }

  const handleSave = async () => {
    try {
      // Try to parse as JSON first
      let parsedValue: any
      try {
        parsedValue = JSON.parse(editValue)
      } catch {
        // Not JSON, treat as plain text
        parsedValue = editValue
      }

      const { error } = await supabase
        .from('app_settings')
        .update({ value: parsedValue })
        .eq('key', prompt.key)

      if (error) throw error

      alert('Prompt saved successfully!')
      setIsEditing(false)
      onUpdate()
    } catch (error) {
      console.error('Save failed:', error)
      alert('Failed to save prompt')
    }
  }

  const handleTest = async () => {
    setTestLoading(true)
    try {
      const response = await fetch('/api/debug/test-ai-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptType: promptTypeMap[prompt.key] || prompt.key
        })
      })

      const result = await response.json()
      setTestResult(result)
    } catch (error) {
      setTestResult({ error: 'Test failed' })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="border rounded p-4 mb-4">
      <h3>{prompt.name}</h3>
      <p className="text-sm text-gray-600">{prompt.description}</p>

      <div className="mt-2 flex gap-2">
        <button onClick={handleEdit}>Edit</button>
        <button onClick={handleTest} disabled={testLoading}>
          {testLoading ? 'Testing...' : 'Test Prompt'}
        </button>
      </div>

      {isEditing && (
        <div className="mt-4">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full h-96 font-mono text-sm border p-2"
          />
          <div className="flex gap-2 mt-2">
            <button onClick={handleSave}>Save</button>
            <button onClick={() => setIsEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {testResult && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h4>Test Result:</h4>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// Map database keys to test endpoint types
const promptTypeMap: Record<string, string> = {
  'ai_prompt_content_evaluator': 'contentEvaluator',
  'ai_prompt_newsletter_writer': 'newsletterWriter',
  'ai_prompt_topic_deduper': 'topicDeduper',
  // ... add all your prompts
}
```

---

## Test System

### Test Endpoint

**Location**: `src/app/api/debug/test-ai-prompts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { AI_PROMPTS } from '@/lib/openai'

// Test data for each prompt type
const testData = {
  contentEvaluator: {
    title: 'AI Tool Revolutionizes Accounting Workflows',
    description: 'New software automates bookkeeping tasks, saving firms hours per week.',
  },

  topicDeduper: [
    {
      title: 'AI Tax Software Launches for CPAs',
      description: 'Revolutionary AI tool reduces tax prep time by 60%',
    },
    {
      title: 'New AI Platform Transforms Tax Filing',
      description: 'Tax professionals adopt AI that cuts preparation time in half',
    },
    {
      title: 'Accounting Firms Embrace Cloud Computing',
      description: 'Survey shows 80% of firms moving to cloud-based solutions',
    },
  ],

  // ... add test data for all prompts
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { promptType } = body

    if (!promptType) {
      return NextResponse.json(
        { error: 'Missing promptType' },
        { status: 400 }
      )
    }

    const results: any = {}

    // Content Evaluator Test
    if (promptType === 'all' || promptType === 'contentEvaluator') {
      console.log('Testing Content Evaluator...')
      try {
        const prompt = await AI_PROMPTS.contentEvaluator(testData.contentEvaluator)

        results.contentEvaluator = {
          success: true,
          response: prompt,
          prompt_length: prompt.length,
        }
      } catch (error) {
        results.contentEvaluator = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Topic Deduper Test
    if (promptType === 'all' || promptType === 'topicDeduper') {
      console.log('Testing Topic Deduper...')
      try {
        const prompt = await AI_PROMPTS.topicDeduper(testData.topicDeduper)

        results.topicDeduper = {
          success: true,
          response: prompt,
          prompt_length: typeof prompt === 'string' ? prompt.length : 0,
          test_posts_count: testData.topicDeduper.length,
        }
      } catch (error) {
        results.topicDeduper = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    return NextResponse.json(results)

  } catch (error: any) {
    console.error('[TEST] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export const maxDuration = 300 // 5 minutes for testing
```

---

## Migration Scripts

### Adding a New Plain Text Prompt

```sql
-- database_migrations/add_content_evaluator_prompt.sql

INSERT INTO app_settings (key, value, description)
VALUES (
  'ai_prompt_content_evaluator',
  to_jsonb('You are evaluating content for a newsletter about accounting and AI.

Rate this article on a scale of 1-10 based on:
- Relevance to accounting professionals
- News value and timeliness
- Quality of information

Article:
{{post}}

Respond with just a number from 1-10.'::text),
  'Content Scoring - Post Evaluator: Rates posts for relevance and quality before inclusion in newsletter'
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
```

**Run with**: `psql -f database_migrations/add_content_evaluator_prompt.sql`

---

### Adding a Structured JSON Prompt

```sql
-- database_migrations/add_topic_deduper_structured.sql

INSERT INTO app_settings (key, value, description)
VALUES (
  'ai_prompt_topic_deduper',
  jsonb_build_object(
    'model', 'gpt-4o',
    'temperature', 0.3,
    'top_p', 0.9,
    'presence_penalty', 0.2,
    'frequency_penalty', 0.1,
    'messages', jsonb_build_array(
      -- System prompt
      jsonb_build_object(
        'role', 'system',
        'content', 'You are identifying duplicate stories in a newsletter.

Your goal is to prevent readers from seeing multiple articles about the same event or topic.

Rules:
1. Group articles about the SAME event or product launch
2. Group articles covering the SAME news story from different sources
3. Be AGGRESSIVE - err on the side of grouping similar topics
4. Keep the article with the MOST SPECIFIC details

Output Format (MUST be valid JSON):
{
  "groups": [
    {
      "topic_signature": "brief description",
      "primary_article_index": 0,
      "duplicate_indices": [1, 2],
      "similarity_explanation": "why these are duplicates"
    }
  ],
  "unique_articles": [3, 4]
}'
      ),

      -- Example assistant response (few-shot learning)
      jsonb_build_object(
        'role', 'assistant',
        'content', '{
  "groups": [
    {
      "topic_signature": "OpenAI product launch",
      "primary_article_index": 0,
      "duplicate_indices": [1],
      "similarity_explanation": "Both articles describe the same OpenAI GPT-5 launch event with different wording"
    }
  ],
  "unique_articles": [2, 3]
}'
      ),

      -- User prompt (with placeholder)
      jsonb_build_object(
        'role', 'user',
        'content', 'Articles to analyze (0-based indexing):

{{articles}}

Task: Group duplicates and return valid JSON with the format shown above.'
      )
    )
  ),
  'Content Generation - Topic Deduplicator: Detects duplicate stories using structured AI analysis with few-shot examples'
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
```

---

### Updating an Existing Prompt

```sql
-- database_migrations/update_content_evaluator.sql

UPDATE app_settings
SET
  value = to_jsonb('You are evaluating content for a newsletter.

NEW CRITERIA:
- Relevance: 1-10
- Timeliness: 1-10
- Quality: 1-10

Article:
{{post}}

Respond with JSON:
{
  "relevance": 8,
  "timeliness": 9,
  "quality": 7,
  "total_score": 24
}'::text),
  updated_at = NOW()
WHERE key = 'ai_prompt_content_evaluator';
```

---

## Step-by-Step Setup Guide

### For St Cloud Scoop Project

#### Step 1: Database Setup

```sql
-- 1. Create app_settings table (if not exists)
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  newsletter_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- 2. Add your first prompt
INSERT INTO app_settings (key, value, description, newsletter_id)
VALUES (
  'ai_prompt_content_scorer',
  to_jsonb('Rate this post for a local news newsletter.

Post:
{{post}}

Rating (1-10):'::text),
  'Content Scoring - Post Scorer: Rates local news posts for newsletter inclusion',
  'stcloud'
);
```

#### Step 2: Create OpenAI Utility

Copy `src/lib/openai.ts` pattern:

```bash
# Create file
touch src/lib/ai-prompts.ts
```

```typescript
// src/lib/ai-prompts.ts
import OpenAI from 'openai'
import { supabase } from './supabase'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

// Copy callWithStructuredPrompt function from guide above

// Copy FALLBACK_PROMPTS pattern

// Copy AI_PROMPTS object with your specific prompts
export const AI_PROMPTS = {
  contentScorer: async (post: any) => {
    // Follow pattern from guide above
  }
}
```

#### Step 3: Create Settings Page

```bash
mkdir -p src/app/dashboard/settings
touch src/app/dashboard/settings/page.tsx
```

Copy the frontend implementation from the guide above.

#### Step 4: Create Test Endpoint

```bash
mkdir -p src/app/api/debug/test-prompts
touch src/app/api/debug/test-prompts/route.ts
```

Copy the test endpoint implementation from the guide above.

#### Step 5: Use in Your Code

```typescript
// src/lib/rss-processor.ts (or wherever you process content)
import { AI_PROMPTS } from './ai-prompts'

async function scorePost(post: RSSPost) {
  const prompt = await AI_PROMPTS.contentScorer(post)

  // If using plain text prompt, call OpenAI
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
  })

  return response.choices[0]?.message?.content
}
```

#### Step 6: Test Everything

```bash
# 1. Run migration
psql -d your_database -f database_migrations/add_content_scorer.sql

# 2. Start dev server
npm run dev

# 3. Visit settings page
http://localhost:3000/dashboard/settings

# 4. Click "Test Prompt" button

# 5. Verify output in browser
```

---

## Common Patterns & Tips

### Pattern 1: Multiple Placeholders

```typescript
// Prompt with {{title}} and {{content}}
const prompt = await AI_PROMPTS.articleWriter({ title, content })

// Implementation
articleWriter: async ({ title, content }) => {
  // ... load from DB
  const placeholders = { title, content }

  if (isStructured) {
    return await callWithStructuredPrompt(config, placeholders)
  }

  return promptText
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{content\}\}/g, content)
}
```

### Pattern 2: Conditional Prompts

```typescript
// Different prompt for different post types
articleWriter: async (post) => {
  const promptKey = post.type === 'event'
    ? 'ai_prompt_event_writer'
    : 'ai_prompt_news_writer'

  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', promptKey)
    .single()

  // ... rest of implementation
}
```

### Pattern 3: Multi-Newsletter Support

```sql
-- Store prompts per newsletter
INSERT INTO app_settings (key, value, description, newsletter_id)
VALUES (
  'ai_prompt_content_scorer',
  to_jsonb('...'::text),
  'Content Scoring - Post Scorer: ...',
  'stcloud'  -- Specific to St Cloud Scoop
);
```

```typescript
// Load with newsletter filter
const { data } = await supabase
  .from('app_settings')
  .select('value')
  .eq('key', 'ai_prompt_content_scorer')
  .eq('newsletter_id', 'stcloud')
  .single()
```

---

## Troubleshooting

### Issue: "Invalid JSON syntax" in migration

**Cause**: JSONB column requires proper type conversion

**Fix**: Always use `to_jsonb('...'::text)` for plain text:
```sql
-- ❌ Wrong
value = 'plain text'

-- ✅ Correct
value = to_jsonb('plain text'::text)
```

### Issue: "Polymorphic type" error

**Cause**: PostgreSQL can't infer type for `to_jsonb()`

**Fix**: Add `::text` cast:
```sql
to_jsonb('your prompt'::text)
```

### Issue: Prompt not loading in UI

**Check**:
1. Is the key correct? (`ai_prompt_*`)
2. Is the description formatted correctly? (`Category - Name: Description`)
3. Is the value valid JSON? (Check in database directly)
4. Are there console errors? (Check browser dev tools)

### Issue: Test returns old results

**Cause**: Caching or not reading latest database value

**Fix**:
1. Hard refresh browser (Ctrl+Shift+R)
2. Check database directly: `SELECT * FROM app_settings WHERE key = 'your_key'`
3. Add cache-busting to API: `cache: 'no-store'`

### Issue: Structured prompt not working

**Check**:
1. Does `value` have `messages` array?
2. Are messages properly formatted? (role + content)
3. Is `callWithStructuredPrompt()` being called?
4. Check console logs for "[AI] Using structured JSON prompt"

---

## Advanced: Versioning Prompts

```sql
-- Create prompt history table
CREATE TABLE prompt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to track changes
CREATE OR REPLACE FUNCTION track_prompt_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO prompt_history (prompt_key, old_value, new_value)
  VALUES (OLD.key, OLD.value, NEW.value);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompt_update_trigger
AFTER UPDATE ON app_settings
FOR EACH ROW
WHEN (OLD.key LIKE 'ai_prompt_%' AND OLD.value IS DISTINCT FROM NEW.value)
EXECUTE FUNCTION track_prompt_changes();
```

Now you have full audit history of prompt changes!

---

## Security Considerations

### 1. Restrict Access to Settings Page

```typescript
// Add auth check
export default async function SettingsPage() {
  const session = await getServerSession()

  if (!session || session.user.role !== 'admin') {
    redirect('/unauthorized')
  }

  // ... rest of page
}
```

### 2. Validate Prompt Changes

```typescript
// Before saving
const handleSave = async () => {
  // Validate JSON structure for structured prompts
  if (isStructured) {
    const parsed = JSON.parse(editValue)
    if (!parsed.messages || !Array.isArray(parsed.messages)) {
      alert('Invalid structured prompt: must have messages array')
      return
    }
  }

  // Check for malicious content
  if (editValue.includes('<!--') || editValue.includes('<script>')) {
    alert('Invalid content detected')
    return
  }

  // Save...
}
```

### 3. Rate Limit Test Endpoint

```typescript
// Add rate limiting
import { Ratelimit } from '@upstash/ratelimit'

const ratelimit = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 tests per hour
})

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { success } = await ratelimit.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }

  // ... rest of handler
}
```

---

## Summary Checklist

**To replicate this system in St Cloud Scoop:**

- [ ] Create `app_settings` table with JSONB `value` column
- [ ] Add first prompt using migration script
- [ ] Copy `callWithStructuredPrompt()` helper function
- [ ] Create `AI_PROMPTS` object with loader functions
- [ ] Build settings page UI with edit/test functionality
- [ ] Create test endpoint with sample data
- [ ] Add `promptTypeMap` to connect UI to test endpoint
- [ ] Test plain text format first
- [ ] Test structured JSON format
- [ ] Add fallback prompts for reliability
- [ ] Implement error handling throughout
- [ ] Add authentication to settings page
- [ ] Deploy and verify in production

---

## Additional Resources

- **OpenAI Chat Completions API**: https://platform.openai.com/docs/api-reference/chat
- **Supabase JSONB Queries**: https://supabase.com/docs/guides/database/json
- **PostgreSQL JSONB Functions**: https://www.postgresql.org/docs/current/functions-json.html

---

**Questions or Issues?**

Refer back to the AI Pros Newsletter implementation:
- `src/lib/openai.ts` - Prompt loading logic
- `src/app/dashboard/[slug]/settings/page.tsx` - UI implementation
- `src/app/api/debug/test-ai-prompts/route.ts` - Test endpoint
- `database_migrations/*.sql` - Migration examples

This guide contains everything needed to replicate the system. Good luck with St Cloud Scoop! 🚀
