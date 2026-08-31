-- Migration: One issue per publication per date
-- Date: 2026-08-31
-- Purpose: Hard backstop against duplicate issue rows, which silently stop sends.
--
-- Background:
--   trigger-workflow runs every 5 minutes; ScheduleChecker accepted any tick
--   within +/-4 minutes (inclusive) of the scheduled time. With RSS processing
--   set to 19:50 CT, the tick nominally at 19:45 also qualified whenever platform
--   cron dispatch slipped past the minute boundary and it reported 19:46. Two
--   ticks passed the window, two workflows ran, two issues were created for the
--   same date. send-review then looked up the day's draft with .single(), got
--   PGRST116 (multiple rows), and skipped silently -- so the issue never reached
--   'in_review' and send-final had nothing to send.
--   First occurrence 2026-08-11; 10 of the following 21 days failed to send.
--
--   Application-level fixes ship alongside this (once-per-day run marker in
--   ScheduleChecker, find-or-create in IssueLifecycle). This index is the
--   guarantee that holds even if those are bypassed or regressed.
--
-- PREREQUISITE: existing duplicates must be resolved first or CREATE UNIQUE
-- INDEX will fail. Step 1 reports them; step 2 is intentionally NOT automated.
--
-- !! rss_posts.issue_id is ON DELETE CASCADE !!
-- Deleting an issue DELETES the rss_posts assigned to it -- it does not return
-- them to the pool. Always unassign first (step 2a), then delete (step 2b).
-- module_articles, issue_events, issue_advertisements, issue_ai_app_selections,
-- issue_prompt_selections, issue_breaking_news, issue_sparkloop_rec_modules,
-- email_metrics, duplicate_groups and user_activities also cascade; those are
-- per-issue records and are correct to remove with the discarded issue.

-- ============================================================
-- 1. Report existing duplicates (run this first; expect 0 rows before step 3)
-- ============================================================
-- SELECT publication_id, date, count(*) AS rows,
--        array_agg(id ORDER BY created_at) AS issue_ids
-- FROM publication_issues
-- WHERE status IN ('draft', 'processing', 'in_review', 'changes_made')
-- GROUP BY publication_id, date
-- HAVING count(*) > 1
-- ORDER BY date DESC;

-- ============================================================
-- 2. Resolve duplicates manually
-- ============================================================
-- Keep, per date, the row with the most active module_articles (ties: earliest
-- created_at). Verify the survivor has a subject_line and its expected article
-- count BEFORE removing anything.
--
-- 2a. Return the discarded issue's posts to the pool (must precede the delete,
--     otherwise the CASCADE destroys them):
--
--   UPDATE rss_posts SET issue_id = NULL WHERE issue_id = '<the-loser-id>';
--
-- 2b. Then remove the discarded issue:
--
--   DELETE FROM publication_issues WHERE id = '<the-loser-id>';
--
-- Confirm rss_posts is unchanged in total afterwards:
--   SELECT count(*) FROM rss_posts;   -- compare before/after

-- ============================================================
-- 3. Enforce uniqueness (PARTIAL -- live statuses only)
-- ============================================================
-- Deliberately partial, not a plain unique index on (publication_id, date).
--
-- IssueLifecycle marks a failed workflow's issue as status='failed' and its
-- find-or-create only reuses 'draft'/'processing'. An unconditional index would
-- therefore make the retry-after-failure path insert a second row for the date,
-- hit a 23505, and die -- bricking exactly the recovery scenario this change is
-- about. Terminal rows ('failed', 'archived') must not block a fresh attempt.
--
-- 'sent' is excluded from the predicate for the same reason: a sent issue is
-- history, and must not prevent creating a new issue for that date.
--
-- The invariant that actually matters is "at most one LIVE issue per
-- publication per date" -- that is the one whose violation stopped the sends.
CREATE UNIQUE INDEX IF NOT EXISTS idx_publication_issues_pub_date_live_unique
  ON public.publication_issues (publication_id, date)
  WHERE status IN ('draft', 'processing', 'in_review', 'changes_made');

COMMENT ON INDEX public.idx_publication_issues_pub_date_live_unique IS
  'At most one live (draft/processing/in_review/changes_made) issue per publication per date. A second one makes send-review refuse to send and silently stops the newsletter.';
