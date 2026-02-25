# Backend Patterns & Templates

_Last updated: 2026-02-24_

## When to use this
- You are creating a new API route, server action, or cron handler
- You need reminders on safe database access and logging conventions
- You are evaluating batching/retry strategies for Supabase or AI calls

Related references:
- @docs/architecture/system-overview.md — Data domains and multi-tenant structure
- @docs/operations/cron-jobs.md — Scheduling constraints and timeouts
- @docs/troubleshooting/common-issues.md — Recovery steps when things go wrong

## API Route Template (with `withApiHandler`)

**Preferred pattern** — use `withApiHandler` for new routes. Centralizes auth, validation, logging.

```typescript
// app/api/<feature>/route.ts
import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { z } from 'zod'

const inputSchema = z.object({
  issueId: z.string().uuid(),
  publicationId: z.string().uuid(),
})

export const POST = withApiHandler(
  {
    authTier: 'authenticated',
    inputSchema,
    requirePublicationId: true,
    logContext: 'my-feature',
  },
  async ({ session, input, publicationId, logger }) => {
    logger.info({ issueId: input.issueId }, 'Processing request')

    // Domain logic here — publicationId is guaranteed non-null

    return NextResponse.json({ success: true })
  }
)

export const maxDuration = 600
```

### Auth Tiers
| Tier | Check | Use for |
|------|-------|---------|
| `public` | None | Public-facing APIs (categories, directory) |
| `authenticated` | NextAuth session | Dashboard routes, user actions |
| `admin` | Session + role=admin | Admin tools, settings management |
| `system` | CRON_SECRET bearer/param | Cron jobs, internal triggers |

### Key practices
- Export `maxDuration` to control Vercel runtime budget.
- Always validate inputs with Zod schemas for request bodies.
- Use `requirePublicationId: true` for tenant-scoped routes.
- For dynamic routes with `[id]`, access `params.id` from handler context.
- The wrapper handles auth, validation errors, and unhandled exceptions automatically.

## Legacy API Route Template

For routes not yet migrated to `withApiHandler`:

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

## Data Access Layer (DAL)

**Prefer DAL functions** over inline Supabase queries for `publication_issues`:

```typescript
import { getIssueById, createIssue, updateIssueStatus } from '@/lib/dal'

// Read
const issue = await getIssueById(issueId, publicationId)

// Create
const newIssue = await createIssue(publicationId, '2026-02-24', 'processing')

// Update status
await updateIssueStatus(issueId, 'draft')
```

See `src/lib/dal/issues.ts` for all available methods. Key features:
- Every method applies `publication_id` filter for multi-tenant safety
- Explicit column lists (no `select('*')`)
- Errors logged with pino, never thrown — callers receive null/empty on failure
- Returns typed results using `PublicationIssue` from `@/types/database`

## Structured Logging

**New routes** should use pino logger from `src/lib/logger.ts`:

```typescript
import { createLogger } from '@/lib/logger'

const log = createLogger({ cronName: 'my-cron', publicationId })
log.info({ count: items.length }, 'Processing batch')
log.error({ err }, 'Step failed')
```

**Existing routes** using `console.log` with `[Tag]` prefixes continue to work — migrate incrementally.

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
- **New code:** Use `createLogger()` from `@/lib/logger` for structured JSON logging.
- **Existing code:** Prefix logs with domain tags (`[Workflow]`, `[RSS]`, `[AI]`, `[DB]`, `[CRON]`).
- Prefer single summary line per operation to stay under 10MB limit.
- Use `log.error({ err }, 'message')` for actionable errors; rely on Slack hooks or monitoring for escalations.

These patterns help Claude apply consistent, production-safe practices when extending backend features.
