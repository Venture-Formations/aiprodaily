# Quick Actions & Checklists

_Last updated: 2025-11-11_

## When to use this
- You need a fast reminder of steps for a common task
- You want to confirm you didn’t miss a provisioning step when onboarding a tenant
- You’re sanity-checking a change before asking for review

Related references:
- @docs/ai/prompt-system.md — Detailed prompt storage and naming conventions
- @docs/workflows/rss-processing.md — Full workflow behavior for campaign runs
- @docs/troubleshooting/common-issues.md — In-depth debugging procedures

---

## Provision a New AI Prompt
1. Draft JSON payload (model, temperature, messages, response schema).
2. Insert into `app_settings` with tenant `newsletter_id` and `ai_provider`.
3. Update code to call `callAIWithPrompt('<key>', newsletterId, vars)`.
4. Add fallback behavior if prompt optional (catch missing key).
5. Test in staging; verify structured response matches schema.
6. Document prompt usage in relevant feature doc.

## Add a Workflow Step
1. Identify task placement (before/after which existing step?).
2. Implement helper in `src/lib/workflows/process-rss-workflow.ts` with retry loop (`while` + 2 retries).
3. Log using `[Workflow Step X/10]` format and keep output concise.
4. Ensure runtime < 800s; batch AI calls if needed.
5. Update docs: @docs/workflows/rss-processing.md and related feature guide.
6. Run workflow end-to-end locally/staging to confirm status transitions.

## Debug a Campaign Stuck in `processing`
1. Check Supabase: `SELECT id, status FROM newsletter_campaigns WHERE status = 'processing' ORDER BY created_at DESC;`
2. Inspect Vercel logs for `/api/workflows/process-rss`; locate failing step.
3. Review `monitor-workflows` logs/Slack alerts for step number and error.
4. Run relevant step manually using debug endpoints in `src/app/api/debug` if available.
5. If safe, reset status: `UPDATE newsletter_campaigns SET status = 'draft' WHERE id = '<campaign_id>';`
6. Investigate root cause (prompt missing, AI failure, Supabase permission) and patch before retrying workflow.

## Re-seed Advertorial Ad Rotation
1. Confirm `campaign_advertisements` contains latest usage rows.
2. Update `advertisements.display_order` to desired sequence (lower = sooner).
3. Reset `app_settings.next_ad_position` to `1` for the tenant.
4. Run `/api/cron/send-final?secret=...` in staging to validate Stage 2 unassignment + ad logging.
5. Monitor logs for `[Workflow Step 10/10]` ad selection result.

## Nightly Smoke Check (post-deploy)
1. Run `/api/cron/trigger-workflow?secret=...` manually to kick off workflow.
2. Monitor steps 1–10 in logs; ensure runtime within limits.
3. Visit dashboard (`/dashboard/[slug]`) to confirm new draft campaign.
4. Trigger `/api/cron/send-review` manually (if needed) and inspect MailerLite preview.
5. Verify Stage 2 unassignment returned unused posts (check `rss_posts` where `campaign_id IS NULL`).

Keep this doc concise; expand only when a new recurring task emerges so Claude (and teammates) have a ready-made checklist.
