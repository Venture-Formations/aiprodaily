# Quick Actions & Checklists

_Last updated: 2025-11-28_

## When to use this
- You need a fast reminder of steps for a common task
- You want to confirm you didn't miss a provisioning step when onboarding a tenant
- You're sanity-checking a change before asking for review

Related references:
- @docs/ai/prompt-system.md — Detailed prompt storage and naming conventions
- @docs/workflows/rss-processing.md — Full workflow behavior for issue runs
- @docs/troubleshooting/common-issues.md — In-depth debugging procedures

---

## Provision a New AI Prompt
1. Draft JSON payload (model, temperature, messages, response schema).
2. Insert into `publication_settings` with tenant `publication_id`.
3. Update code to call `callAIWithPrompt('<key>', publicationId, vars)`.
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

## Debug an Issue Stuck in `processing`
1. Check Supabase: `SELECT id, status FROM issues WHERE status = 'processing' ORDER BY created_at DESC;`
2. Inspect Vercel logs for `/api/workflows/process-rss`; locate failing step.
3. Review `monitor-workflows` logs/Slack alerts for step number and error.
4. Run relevant step manually using debug endpoints in `src/app/api/debug` if available.
5. If safe, reset status: `UPDATE issues SET status = 'draft' WHERE id = '<issue_id>';`
6. Investigate root cause (prompt missing, AI failure, Supabase permission) and patch before retrying workflow.

## Re-seed Advertorial Ad Rotation
1. Confirm `issue_advertisements` contains latest usage rows.
2. Update `advertisements.display_order` to desired sequence (lower = sooner).
3. Reset `publication_settings.next_ad_position` to `1` for the tenant.
4. Run `/api/cron/send-final?secret=...` in staging to validate Stage 2 unassignment + ad logging.
5. Monitor logs for `[Workflow Step 10/10]` ad selection result.

## Nightly Smoke Check (post-deploy)
1. Run `/api/cron/trigger-workflow?secret=...` manually to kick off workflow.
2. Monitor steps 1–10 in logs; ensure runtime within limits.
3. Visit dashboard (`/dashboard/[slug]`) to confirm new draft issue.
4. Trigger `/api/cron/send-review` manually (if needed) and inspect MailerLite preview.
5. Verify Stage 2 unassignment returned unused posts (check `rss_posts` where `issue_id IS NULL`).

## Check AI App Selection Status
1. Visit `/api/debug/(ai)/ai-apps-status` to see current rotation state.
2. Verify `affiliate_cooldown_days` in `publication_settings`.
3. Check `issue_ai_app_selections` for recent selections.
4. Review `ai_applications.last_used_date` for rotation tracking.

Keep this doc concise; expand only when a new recurring task emerges so Claude (and teammates) have a ready-made checklist.
