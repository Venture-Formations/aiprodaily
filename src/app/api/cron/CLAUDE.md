# Cron Routes

## Required Pattern

Every cron route must use `withApiHandler` with `authTier: 'system'`:

```typescript
import { withApiHandler } from '@/lib/api-handler'

export const POST = withApiHandler(
  { authTier: 'system', logContext: 'cron-name' },
  async ({ logger }) => {
    logger.info('Starting...')
    // ... work ...
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  }
)

export const GET = POST  // or separate handler for health-check style responses
export const maxDuration = 300  // seconds — match vercel.json
```

## Rules

- **Auth tier is always `system`** — never `authenticated` or `admin`
- **Support both GET and POST** — GET for Vercel cron pings, POST for manual Bearer token triggers
- **Set `maxDuration`** to match the value in `vercel.json` for this route
- **Use injected `logger`** — never `console.log`. Prefix context via `logContext`
- **Cron kill switch**: `CRON_ENABLED=false` disables all crons; manual Bearer triggers bypass it
- **Multi-tenant loop**: Most crons iterate over active publications:

```typescript
const { data: pubs } = await supabaseAdmin
  .from('publications')
  .select('id, name, slug')
  .eq('is_active', true)

for (const pub of pubs) {
  // Process per-publication, filtering by pub.id
}
```

## Scheduling

- Use `ScheduleChecker` methods for time-based decisions (not raw date comparisons)
- Schedule config lives in `publication_settings` per tenant
- Cron definitions are in `vercel.json` — update both when changing schedules

## Logging

- One-line summaries: `logger.info({ fetched: 5, scored: 3 }, 'Ingestion complete')`
- Stay under 10MB total log output per invocation
- Log errors with structured data: `logger.error({ err: error, pubId }, 'Failed')`
