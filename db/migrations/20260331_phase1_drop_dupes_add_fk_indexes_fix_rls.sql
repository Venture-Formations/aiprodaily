-- Phase 1: Database Optimization (Non-Destructive, High Impact)
-- Deploy to staging first: npm run migrate:staging
-- Then production via Supabase SQL editor
--
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- If your migration runner wraps in a transaction, run index creation
-- statements separately via SQL editor.

-- ============================================================
-- 1a. Drop 3 Duplicate Index/Constraint Pairs
-- ============================================================

-- ai_prompt_tests: two identical UNIQUE constraints on (user_id, publication_id, provider, model, prompt_type)
-- Keep: ai_prompt_tests_user_id_publication_id_provider_model_prompt_t_ (current naming)
-- Drop: ai_prompt_tests_user_id_newsletter_id_provider_model_prompt_key (legacy naming)
ALTER TABLE ai_prompt_tests
  DROP CONSTRAINT IF EXISTS ai_prompt_tests_user_id_newsletter_id_provider_model_prompt_key;

-- publication_settings: two identical UNIQUE constraints on (publication_id, key)
-- Keep: newsletter_settings_publication_id_key (current naming)
-- Drop: newsletter_settings_newsletter_id_key_key (legacy naming)
ALTER TABLE publication_settings
  DROP CONSTRAINT IF EXISTS newsletter_settings_newsletter_id_key_key;

-- tools_directory: two identical indexes on (clerk_user_id)
-- Keep: idx_tools_directory_clerk_user_id
-- Drop: idx_tools_directory_clerk_user
DROP INDEX IF EXISTS idx_tools_directory_clerk_user;

-- ============================================================
-- 1b. Add 8 Missing FK Indexes
-- ============================================================
-- These FK columns lack indexes, causing full table scans on JOINs/deletes.

-- directory_categories_tools: PK is (category_id, tool_id) — tool_id not leading
CREATE INDEX IF NOT EXISTS idx_directory_categories_tools_tool_id
  ON directory_categories_tools (tool_id);

-- issue_advertisements: has idx on issue_id but not advertisement_id
CREATE INDEX IF NOT EXISTS idx_issue_advertisements_advertisement_id
  ON issue_advertisements (advertisement_id);

-- issue_ai_app_selections: composite unique (issue_id, app_id) — app_id not leading
CREATE INDEX IF NOT EXISTS idx_issue_ai_app_selections_app_id
  ON issue_ai_app_selections (app_id);

-- issue_breaking_news: composite unique (issue_id, post_id) — post_id not leading
CREATE INDEX IF NOT EXISTS idx_issue_breaking_news_post_id
  ON issue_breaking_news (post_id);

-- issue_module_ads: has idx on ad_module_id and issue_id but not advertisement_id
CREATE INDEX IF NOT EXISTS idx_issue_module_ads_advertisement_id
  ON issue_module_ads (advertisement_id);

-- issue_prompt_selections: composite unique (issue_id, prompt_id) — prompt_id not leading
CREATE INDEX IF NOT EXISTS idx_issue_prompt_selections_prompt_id
  ON issue_prompt_selections (prompt_id);

-- manual_articles: no index on category_id
CREATE INDEX IF NOT EXISTS idx_manual_articles_category_id
  ON manual_articles (category_id);

-- manual_articles: no index on used_in_issue_id
CREATE INDEX IF NOT EXISTS idx_manual_articles_used_in_issue_id
  ON manual_articles (used_in_issue_id);

-- ============================================================
-- 1c. Fix 4 RLS Policies with Per-Row Re-evaluation
-- ============================================================
-- Wrapping auth.role() and auth.uid() in (SELECT ...) prevents
-- the planner from re-evaluating them for every row.

-- directory_categories: fix service_role policy
DROP POLICY IF EXISTS "Allow service role all on directory_categories" ON directory_categories;
CREATE POLICY "Allow service role all on directory_categories"
  ON directory_categories FOR ALL
  TO public
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- directory_categories_tools: fix service_role policy
DROP POLICY IF EXISTS "Allow service role all on directory_categories_tools" ON directory_categories_tools;
CREATE POLICY "Allow service role all on directory_categories_tools"
  ON directory_categories_tools FOR ALL
  TO public
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- tools_directory: fix service_role policy
DROP POLICY IF EXISTS "Allow service role all on tools_directory" ON tools_directory;
CREATE POLICY "Allow service role all on tools_directory"
  ON tools_directory FOR ALL
  TO public
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- feedback_comment_read_status: fix auth.uid() in user policy
DROP POLICY IF EXISTS "Users can manage their own read status" ON feedback_comment_read_status;
CREATE POLICY "Users can manage their own read status"
  ON feedback_comment_read_status FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
