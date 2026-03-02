---
created: 2026-03-02T19:21:35Z
last_updated: 2026-03-02T19:21:35Z
version: 1.0
author: Claude Code PM System
---

# System Patterns

## Architectural Style
- **Next.js App Router** with server components by default, `"use client"` for interactive UI
- **Serverless** -- All backend runs as Vercel serverless functions (no persistent server)
- **Cron-driven** -- Scheduled cron jobs trigger pipeline steps via Vercel cron
- **Multi-tenant** -- All data scoped by `publication_id`; queries always filter by it

## Data Flow
1. RSS feeds fetched on schedule into `rss_posts` pool
2. Workflow triggered, runs 10 steps (score, select, generate, assemble)
3. Issue created in `issues` table with status `draft`
4. Human reviews via dashboard, moves to `ready_to_send`
5. Cron picks up and sends via MailerLite
6. Metrics imported back from MailerLite

## Design Patterns

### Data Access Layer (DAL)
- `src/lib/dal/` contains centralized query functions
- Explicit column lists (no `SELECT *`)
- Column constants defined for tables queried in multiple places

### Module System
- Block-based sections: prompt, AI app, ad, poll, feedback, text box modules
- Each module type has: config table, per-issue selection table, selector class
- Selection modes: sequential, random, priority, manual

### AI Integration
- Prompts stored in `publication_settings` (per-tenant) with `app_settings` fallback
- Access via `callAIWithPrompt(promptKey, newsletterId, variables)`
- Provider auto-detected from model name (claude -> Anthropic, else -> OpenAI)
- Structured output validated with Zod schemas

### Error Handling
- Retry loops (max 2 retries, 2s delay) for transient failures
- Graceful degradation -- non-critical errors don't fail the full workflow
- Logged with context prefixes: `[Workflow]`, `[RSS]`, `[AI]`, `[DB]`, `[CRON]`

### Date Handling
- Local date strings via `date.split('T')[0]` -- never `toISOString()` for comparisons

### Authentication
- NextAuth for admin dashboard
- Stripe for billing
- Debug auth bypass for development

## Infrastructure Patterns
- Vercel serverless with `maxDuration` per route (up to 800s for workflows)
- Supabase admin client for server-side operations only
- GitHub as image CDN (rehost Facebook images to prevent CDN expiry)
