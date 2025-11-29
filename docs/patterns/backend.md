# Backend Patterns & Templates

_Last updated: 2025-11-28_

## When to use this
- You are creating a new API route, server action, or cron handler
- You need reminders on safe database access and logging conventions
- You are evaluating batching/retry strategies for Supabase or AI calls

Related references:
- @docs/architecture/system-overview.md — Data domains and multi-tenant structure
- @docs/operations/cron-jobs.md — Scheduling constraints and timeouts
- @docs/troubleshooting/common-issues.md — Recovery steps when things go wrong

## API Route Template
```typescript
// app/api/<feature>/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 600 // Vercel limit, adjust if needed

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.issueId || !body.publicationId) {
      return NextResponse.json({ error: 'Missing issueId/publicationId' }, { status: 400 })
    }

    const { issueId, publicationId } = body

    const { data, error } = await supabaseAdmin
      .from('issues')
      .select('id')
      .eq('id', issueId)
      .eq('publication_id', publicationId)
      .maybeSingle()

    if (error) {
      console.error('[API] Supabase error:', error.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Domain logic here

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Fatal error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Key practices
- Export `maxDuration` to control Vercel runtime budget.
- Always validate inputs and respond with explicit errors (400/404/500).
- Never log secrets; prefer structured, high-level messages.
- Reuse helpers in `src/lib` for shared logic and Supabase interactions.

## Database Query Pattern
```typescript
const { data, error } = await supabaseAdmin
  .from('issue_articles')
  .select('id, headline, fact_check_score')
  .eq('publication_id', publicationId)
  .eq('issue_id', issueId)
  .order('rank', { ascending: true })

if (error) {
  console.error('[DB] Query failed:', error.message)
  throw new Error('Database error')
}

if (!data || data.length === 0) {
  console.log('[DB] No articles found for issue', issueId)
  return []
}

return data
```

### Guardrails
- Select only required columns (avoid `*`).
- Always include `publication_id` in filters for multi-tenant safety.
- Handle empty results gracefully (log + fallback).

## Batching Long Operations
```typescript
import { chunkArray, sleep } from '@/lib/utils'

const BATCH_SIZE = 3
const BATCH_DELAY = 2000 // 2 seconds

for (const batch of chunkArray(items, BATCH_SIZE)) {
  await Promise.all(batch.map(processItemSafely))
  await sleep(BATCH_DELAY)
}

async function processItemSafely(item: Item) {
  try {
    await callAIWithPrompt('ai_prompt_primary_article_body', publicationId, item)
  } catch (error) {
    console.error('[AI] Item failed', item.id, error)
  }
}
```

- Keeps each batch within provider rate limits.
- `sleep` helps avoid API throttling and respects Vercel log limits.
- Catch per-item errors to continue processing the batch.

## Retry Loop Pattern
```typescript
async function withRetries<T>(taskName: string, fn: () => Promise<T>): Promise<T> {
  const maxRetries = 2
  let attempt = 0

  while (attempt <= maxRetries) {
    try {
      return await fn()
    } catch (error) {
      attempt++
      if (attempt > maxRetries) {
        console.error(`[${taskName}] Failed after retries`, error)
        throw error
      }
      console.log(`[${taskName}] Retrying (${attempt}/${maxRetries})...`)
      await sleep(2000)
    }
  }
  throw new Error(`${taskName} retry loop exhausted`)
}
```

Use for long-running steps (workflow tasks, AI batches) to gracefully recover from transient issues.

## Logging Conventions
- Prefix logs with domain tags (`[Workflow]`, `[RSS]`, `[AI]`, `[DB]`, `[CRON]`).
- Prefer single summary line per operation to stay under 10MB limit.
- Use `console.error` for actionable errors; rely on Slack hooks or monitoring for escalations.

These patterns help Claude apply consistent, production-safe practices when extending backend features.
