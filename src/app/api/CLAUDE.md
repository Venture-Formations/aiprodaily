# API Routes

## Required Pattern

Every API route must use `withApiHandler`:

```typescript
import { withApiHandler } from '@/lib/api-handler'

export const POST = withApiHandler(
  {
    authTier: 'authenticated',     // or 'admin', 'system', 'public'
    logContext: 'route-name',
    requirePublicationId: true,    // extracts and validates publication_id
    inputSchema: myZodSchema,      // optional: auto-validates request body
  },
  async ({ input, publicationId, logger, request, session }) => {
    // input is typed from inputSchema
    // publicationId is guaranteed non-null when requirePublicationId: true
    return NextResponse.json({ ... })
  }
)
```

## Auth Tiers

| Tier | Use When |
|------|----------|
| `system` | Cron jobs, internal workflow calls |
| `admin` | Dashboard admin actions |
| `authenticated` | Logged-in user actions |
| `public` | Unauthenticated endpoints (website, webhooks) |

## Multi-Tenant Isolation (CRITICAL)

Every query must filter by `publication_id`. Use `requirePublicationId: true` in config:

```typescript
const { data } = await supabaseAdmin
  .from('table_name')
  .select('id, name, ...')           // explicit columns, never select('*')
  .eq('publication_id', publicationId)
```

## Input Validation

Define Zod schemas for POST/PUT/PATCH:

```typescript
const schema = z.object({
  title: z.string().min(1),
  status: z.enum(['draft', 'active']),
})

export const POST = withApiHandler(
  { authTier: 'admin', inputSchema: schema, logContext: 'my-route' },
  async ({ input }) => { /* input is typed */ }
)
```

## Error Handling

- Let `withApiHandler` catch and format errors — don't wrap in try/catch unless you need custom recovery
- Use `logger.error({ err }, 'message')` for structured error logging
- Return `NextResponse.json({ error: message }, { status: 4xx/5xx })` for business errors

## Supabase Queries

- Use `supabaseAdmin` exclusively (never the anon client)
- Use `.maybeSingle()` for optional lookups, `.single()` for required
- Always specify explicit columns in `.select()`
