# System Architecture Overview

_Last updated: 2025-11-11_

## When to use this
- You need a refresher on how the multi-tenant platform is structured end-to-end
- You are adding a new feature and must understand where it fits within campaigns, RSS, or AI flows
- You are debugging cross-cutting issues (e.g., data leakage, workflow timing) and need to trace dependencies

## Platform Layers

```
Newsletter (slug → newsletter_id)
  → Campaigns (daily cadence)
      → RSS Posts (scored pool)
          → Articles (generated content)
              → Email (review + final send)
```

- **App surface:** Next.js 15 (App Router) serves dashboard, public sites, and server actions.
- **Automations:** Vercel Workflows + cron routes orchestrate nightly processing and notification loops.
- **AI services:** OpenAI (via `callAIWithPrompt`) produces article copy, scoring, subject lines, and welcome sections.
- **Storage:** Supabase/PostgreSQL with strict `newsletter_id` scoping; GitHub hosts rehosted assets; MailerLite delivers final emails.

## Data Domains & Key Tables

| Domain | Primary Tables | Notes |
|--------|----------------|-------|
| Tenants | `newsletters`, `app_settings` | Store branding, prompts, scheduling toggles per publication. |
| Campaign Lifecycle | `newsletter_campaigns`, `campaign_advertisements`, `campaign_breaking_news` | Campaign status flows: `draft → processing → ready_to_send → sent`. Stage metadata (subject line, welcome text, ad selection). |
| Content Pool | `rss_feeds`, `rss_posts`, `post_ratings`, `duplicate_groups` | Ingestion stores posts with `campaign_id = NULL` until assignment; scoring writes weighted totals. Duplicate handling captured in `duplicate_groups`. |
| Generated Content | `articles`, `secondary_articles`, `manual_articles` | Primary/secondary articles plus manual inserts; each references `rss_posts.post_id` (where applicable). |
| Historical Archives | `archived_articles`, `archived_rss_posts` | Preserve prior campaign snapshots during reprocessing. |
| Telemetry | `newsletter_events`, `emails`, `link_tracking_events`, `polls`, `feedback`, `audit_logs` | Capture outbound campaigns, click tracking, poll responses, and review feedback. |

## Cross-Cutting Principles

- **Isolation:** Every query MUST filter by `newsletter_id` to avoid data leakage across publications.
- **Date handling:** Treat campaign dates in Central Time; comparisons should use `date.split('T')[0]` (never `toISOString()` for logic).
- **Workflow limits:** Vercel imposes 800s per workflow step, 600s per API route, and 10MB log caps—batch heavy work (especially AI calls) and log only one-line summaries.

## Module Interaction Map

1. **RSS ingestion** (`/api/cron/ingest-rss`, `RSSProcessor.ingestNewPosts`) populates the post pool.
2. **Workflow trigger** (`/api/cron/trigger-workflow`) launches the 10-step Vercel workflow in `src/lib/workflows/process-rss-workflow.ts`.
3. **Campaign processing** assigns, deduplicates, generates, fact-checks, and finalizes using prompt-driven AI helpers in `src/lib/openai.ts`.
4. **Review & send** surfaces drafts in the dashboard (`/dashboard/[slug]`) and fires MailerLite via `/api/cron/send-final`.
5. **Analytics loop** collects link tracking, poll feedback, and manual overrides for the next cycle.

Understanding this flow ensures new features slot into the right layer (ingestion, generation, review, or analytics) without breaking multi-tenant guarantees.
