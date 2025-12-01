# Common Issues & Troubleshooting

_Last updated: 2025-11-28_

## When to use this
- A cron or workflow failed and you need a triage checklist
- An issue is stuck or missing content
- AI output or data integrity looks wrong and you need quick diagnostics

Related references:
- @docs/workflows/rss-processing.md — Workflow step details and triggers
- @docs/operations/cron-jobs.md — Scheduling, expectations, and recovery steps
- @docs/patterns/backend.md — Safe coding patterns to prevent regressions

---

## Issue Stuck in `processing`
**Symptoms:** Workflow stops mid-run, issue never reaches `draft`.

1. Query Supabase:
   ```sql
   SELECT id, status, created_at
   FROM issues
   WHERE status = 'processing'
   ORDER BY created_at DESC;
   ```
2. Inspect Vercel logs for `/api/workflows/process-rss`; note the last `[Workflow Step X/10]` log.
3. Check `monitor-workflows` cron output/Slack for failed step and error message.
4. Validate prompts exist for the tenant; missing prompts often cause JSON errors.
5. If manual reset is safe: `UPDATE issues SET status = 'draft' WHERE id = '<issue_id>';`
6. Fix root cause before rerunning workflow (missing prompt, Supabase permissions, AI quota).

## Posts Not Scoring / Empty Drafts
**Symptoms:** Top sections empty, scoring tables unused.

1. Verify ingestion ran: check `/api/cron/ingest-rss` logs and `rss_posts` rows with `issue_id IS NULL`.
2. Ensure criteria prompts configured: `SELECT key FROM publication_settings WHERE key LIKE 'ai_prompt_criteria_%';`
3. Confirm feeds active: `SELECT name FROM rss_feeds WHERE is_active = true;`
4. Inspect `post_ratings` for recent entries. Missing entries indicate scoring step failure.
5. Review Step 2 logs (`[Workflow Step 2/10]`) for scoring errors.

## AI Output Missing or Malformed
**Symptoms:** Empty headlines/bodies, JSON parse errors.

1. Confirm prompt JSON in `publication_settings` is valid (no stray quotes/newlines).
2. Check provider is auto-detected from model name (claude/sonnet → Anthropic, else → OpenAI).
3. Look at workflow logs for `[AI]` errors; note batch number causing issues.
4. Reduce batch size or add delay (`await sleep(2000)`) if rate limits triggered.
5. Validate `response_format` matches parsing logic in code.

## Cron Did Not Run
**Symptoms:** No logs for cron path, automation missed schedule.

1. Confirm `vercel.json` entry exists and schedule is correct (no duplicates).
2. Verify environment variable `CRON_SECRET` present and matches manual requests.
3. Check Vercel dashboard `Deployments → Functions` for invocation history.
4. Run endpoint manually with secret to confirm functionality.
5. Temporarily increase logging and redeploy if still undetected.

## Advertorial Missing in Final Send
**Symptoms:** Email lacks advertorial section or shows fallback copy.

1. Check `issue_advertisements` for selected ad linked to issue.
2. Ensure `advertisements` entries have `status = 'active'` and valid `button_url`/`image_url`.
3. Review workflow Step 10 logs for ad selection (`[Workflow Step 10/10]`).
4. Inspect `/api/cron/send-final` logs to confirm Stage 2 unassignment didn't remove the ad post.
5. If re-running, reset `issue_advertisements` entry and rerun Step 10 or final send.

## AI Apps Not Rotating Properly
**Symptoms:** Same apps appearing repeatedly in newsletters.

1. Check `publication_settings` for `affiliate_cooldown_days` setting.
2. Verify `ai_applications` table has `last_used_date` being updated.
3. For affiliates: Check if cooldown period has passed.
4. For non-affiliates: Verify all apps in category have been used before cycling.
5. Review `issue_ai_app_selections` for recent selection patterns.
6. Check `/api/debug/(ai)/ai-apps-status` for current rotation state.

Document additional scenarios here as they surface so Claude and humans share the same playbook.
