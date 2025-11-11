# RSS Processing Workflow

_Last updated: 2025-11-11_

## When to use this
- You are modifying the nightly campaign generation workflow
- You need to debug a stuck or failed workflow step
- You are adding a new AI generation step or adjusting scoring/selection logic

Related references:
- @docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md — Scoring strategy, criteria prompts, weighting
- @docs/architecture/system-overview.md — Platform data flow and table relationships
- @docs/operations/cron-jobs.md — Scheduling, retries, and workflow trigger cadence

## Entry Points
- **Workflow orchestrator:** `src/lib/workflows/process-rss-workflow.ts`
- **Workflow invocation:** `/api/workflows/process-rss`
- **Cron trigger:** `/api/cron/trigger-workflow`
- **Manual run:** Dashboard button → same workflow endpoint

## High-Level Flow

```
Ingest feeds → Score posts → Launch workflow → Assign & dedupe → Generate primary + secondary → Fact-check → Finalize → Notify & review
```

## Ten-Step Workflow Breakdown

| Step | Purpose | Key Functions | Notes |
|------|---------|---------------|-------|
| 1 | Setup campaign, select AI apps/prompts, assign top 12 posts per section, dedupe staging data | `workflow.setupCampaign`, `RSSProcessor.assignTopPostsToCampaign`, `RSSProcessor.handleDuplicatesForCampaign` | Must complete within 800s; posts come from pre-scored pool (`campaign_id = NULL`). |
| 2 | Generate six primary titles | `RSSProcessor.generateTitlesOnly` (primary) | Fast batch; relies on `ai_prompt_primary_article_title`. |
| 3 | Generate three primary bodies (batch 1) | `RSSProcessor.generateArticlesForSection` | Uses deduped, top-ranked posts. |
| 4 | Generate three primary bodies (batch 2) | same as step 3 | Ensure batching delay (2s) to respect rate limits. |
| 5 | Fact-check primary articles | `RSSProcessor.factCheckArticles` | Stores `fact_check_score`, `fact_check_notes`. |
| 6 | Generate six secondary titles | `generateTitlesOnly` (secondary) | Pulls secondary feeds flagged in `rss_feeds.use_for_secondary_section`. |
| 7 | Generate three secondary bodies (batch 1) | `generateArticlesForSection` (secondary) | |
| 8 | Generate three secondary bodies (batch 2) | same as step 7 | |
| 9 | Fact-check secondary | `factCheckSecondaryArticles` | Same limits as step 5. |
| 10 | Finalize campaign: auto-select top 3 per section, generate welcome, ensure subject, select ad, unassign unused posts (Stage 1) | `RSSProcessor.selectTopArticlesForCampaign`, `generateWelcomeSection`, `AdScheduler.selectAdForCampaign`, `RSSProcessor.unassignUnusedPosts` | Sets status to `draft`; writes `campaign_advertisements`. |

## Failure & Retry Behavior
- Each step wraps logic with retry loop (max 2 retries, 2s delay). If retries exhausted, workflow throws, status set `failed`.
- `trigger-workflow` cron detects failed/stuck campaigns and will retry on next interval if schedule still active.
- Logs must stay under 10MB; prefer single summary log per step (`[Workflow Step X/10] ...`).

## Required Configuration
- `app_settings` keys for prompts, scoring criteria, AI providers per tenant.
- Supabase tables with `newsletter_id` filters enforced in every query.
- Vercel environment variables: `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, etc.

## Checklist Before Deploying Changes
1. Run workflow locally (`npm run workflow:process-rss` if script exists) or use staging environment.
2. Monitor Vercel logs during a full run to ensure step durations < 800s.
3. Validate campaign status transitions (`processing → draft`) in Supabase.
4. Confirm Stage 1 unassignment returns unused posts to pool.
5. Verify downstream cron (`send-review`) still receives draft campaigns.

## Common Pitfalls
- **Missing newsletter filter:** Always call `.eq('newsletter_id', newsletterId)`.
- **UTC shift:** Never use `toISOString()` for logical comparisons; rely on date strings (Central time).
- **Prompt drift:** Changing prompt keys requires updating `app_settings` and ensuring criteria docs are current.
- **Unassigned ads:** If no ad selected in Step 10, check `app_settings.next_ad_position` and active ads ordering.

## Extending the Workflow
- Add new steps by augmenting `process-rss-workflow.ts` with consistent logging + retry wrapper.
- For additional AI generations, store prompts under new `app_settings` keys and call `callAIWithPrompt`.
- Keep runtime < 600s per API route and < 800s per step; break heavy work into batches with `await sleep(2000)` between batches.

Documenting changes here keeps Claude synced with the actual runtime sequence whenever the workflow evolves.
