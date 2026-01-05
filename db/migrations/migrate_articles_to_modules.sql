-- Article Modules Data Migration
-- Migrates existing Primary/Secondary articles to the new module system
-- Date: 2025-01-05
--
-- Prerequisites: create_article_modules_system.sql must be run first
--
-- This migration:
-- 1. Creates Primary Articles and Secondary Articles modules for each publication
-- 2. Migrates criteria settings from publication_settings to article_module_criteria
-- 3. Migrates prompts from publication_settings to article_module_prompts
-- 4. Assigns RSS feeds to modules based on use_for_primary_section/use_for_secondary_section
-- 5. Migrates articles table data to module_articles
-- 6. Migrates secondary_articles table data to module_articles
-- 7. Updates rss_posts with article_module_id based on feed assignment

-- ============================================
-- 1. Create Primary Articles module for each publication
-- ============================================
INSERT INTO article_modules (
  publication_id,
  name,
  display_order,
  is_active,
  selection_mode,
  block_order,
  articles_count,
  lookback_hours
)
SELECT
  p.id,
  'Primary Articles',
  10, -- Display order before secondary (will be adjusted)
  true,
  'top_score',
  '["source_image", "title", "body"]'::jsonb,
  COALESCE(
    (SELECT CAST(value AS INTEGER) FROM publication_settings
     WHERE publication_id = p.id AND key = 'max_top_articles'
     LIMIT 1), 3
  ),
  COALESCE(
    (SELECT CAST(value AS INTEGER) FROM publication_settings
     WHERE publication_id = p.id AND key = 'primary_article_lookback_hours'
     LIMIT 1), 72
  )
FROM publications p
WHERE NOT EXISTS (
  SELECT 1 FROM article_modules
  WHERE publication_id = p.id AND name = 'Primary Articles'
);

-- ============================================
-- 2. Create Secondary Articles module for each publication
-- ============================================
INSERT INTO article_modules (
  publication_id,
  name,
  display_order,
  is_active,
  selection_mode,
  block_order,
  articles_count,
  lookback_hours
)
SELECT
  p.id,
  'Secondary Articles',
  20, -- Display order after primary
  true,
  'top_score',
  '["source_image", "title", "body"]'::jsonb,
  COALESCE(
    (SELECT CAST(value AS INTEGER) FROM publication_settings
     WHERE publication_id = p.id AND key = 'max_secondary_articles'
     LIMIT 1), 3
  ),
  COALESCE(
    (SELECT CAST(value AS INTEGER) FROM publication_settings
     WHERE publication_id = p.id AND key = 'secondary_article_lookback_hours'
     LIMIT 1), 36
  )
FROM publications p
WHERE NOT EXISTS (
  SELECT 1 FROM article_modules
  WHERE publication_id = p.id AND name = 'Secondary Articles'
);

-- ============================================
-- 3. Migrate Primary criteria to article_module_criteria
-- ============================================
-- For each publication with primary article module, migrate criteria 1-5

-- Criteria 1 (Primary)
INSERT INTO article_module_criteria (
  article_module_id,
  criteria_number,
  name,
  weight,
  ai_prompt,
  ai_model,
  ai_provider,
  is_active
)
SELECT
  am.id,
  1,
  COALESCE(
    (SELECT value::text FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'criteria_1_name'
     LIMIT 1), 'Relevance'
  ),
  COALESCE(
    (SELECT (value::text)::numeric FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'criteria_1_weight'
     LIMIT 1), 0.2
  ),
  (SELECT value::text FROM publication_settings
   WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_1'
   LIMIT 1),
  COALESCE(
    (SELECT (value::jsonb)->>'model' FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_1'
     LIMIT 1), 'gpt-4o'
  ),
  CASE
    WHEN (SELECT (value::jsonb)->>'model' FROM publication_settings
          WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_1'
          LIMIT 1) ILIKE '%claude%' THEN 'anthropic'
    ELSE 'openai'
  END,
  true
FROM article_modules am
WHERE am.name = 'Primary Articles'
  AND NOT EXISTS (
    SELECT 1 FROM article_module_criteria
    WHERE article_module_id = am.id AND criteria_number = 1
  );

-- Criteria 2 (Primary)
INSERT INTO article_module_criteria (
  article_module_id,
  criteria_number,
  name,
  weight,
  ai_prompt,
  ai_model,
  ai_provider,
  is_active
)
SELECT
  am.id,
  2,
  COALESCE(
    (SELECT value::text FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'criteria_2_name'
     LIMIT 1), 'Timeliness'
  ),
  COALESCE(
    (SELECT (value::text)::numeric FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'criteria_2_weight'
     LIMIT 1), 0.2
  ),
  (SELECT value::text FROM publication_settings
   WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_2'
   LIMIT 1),
  COALESCE(
    (SELECT (value::jsonb)->>'model' FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_2'
     LIMIT 1), 'gpt-4o'
  ),
  CASE
    WHEN (SELECT (value::jsonb)->>'model' FROM publication_settings
          WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_2'
          LIMIT 1) ILIKE '%claude%' THEN 'anthropic'
    ELSE 'openai'
  END,
  CASE
    WHEN EXISTS (SELECT 1 FROM publication_settings
                 WHERE publication_id = am.publication_id AND key = 'criteria_2_name')
    THEN true ELSE false
  END
FROM article_modules am
WHERE am.name = 'Primary Articles'
  AND NOT EXISTS (
    SELECT 1 FROM article_module_criteria
    WHERE article_module_id = am.id AND criteria_number = 2
  );

-- Criteria 3 (Primary)
INSERT INTO article_module_criteria (
  article_module_id,
  criteria_number,
  name,
  weight,
  ai_prompt,
  ai_model,
  ai_provider,
  is_active
)
SELECT
  am.id,
  3,
  COALESCE(
    (SELECT value::text FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'criteria_3_name'
     LIMIT 1), 'Quality'
  ),
  COALESCE(
    (SELECT (value::text)::numeric FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'criteria_3_weight'
     LIMIT 1), 0.2
  ),
  (SELECT value::text FROM publication_settings
   WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_3'
   LIMIT 1),
  COALESCE(
    (SELECT (value::jsonb)->>'model' FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_3'
     LIMIT 1), 'gpt-4o'
  ),
  CASE
    WHEN (SELECT (value::jsonb)->>'model' FROM publication_settings
          WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_3'
          LIMIT 1) ILIKE '%claude%' THEN 'anthropic'
    ELSE 'openai'
  END,
  CASE
    WHEN EXISTS (SELECT 1 FROM publication_settings
                 WHERE publication_id = am.publication_id AND key = 'criteria_3_name')
    THEN true ELSE false
  END
FROM article_modules am
WHERE am.name = 'Primary Articles'
  AND NOT EXISTS (
    SELECT 1 FROM article_module_criteria
    WHERE article_module_id = am.id AND criteria_number = 3
  );

-- Criteria 4 (Primary)
INSERT INTO article_module_criteria (
  article_module_id,
  criteria_number,
  name,
  weight,
  ai_prompt,
  ai_model,
  ai_provider,
  is_active
)
SELECT
  am.id,
  4,
  COALESCE(
    (SELECT value::text FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'criteria_4_name'
     LIMIT 1), 'Engagement'
  ),
  COALESCE(
    (SELECT (value::text)::numeric FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'criteria_4_weight'
     LIMIT 1), 0.2
  ),
  (SELECT value::text FROM publication_settings
   WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_4'
   LIMIT 1),
  COALESCE(
    (SELECT (value::jsonb)->>'model' FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_4'
     LIMIT 1), 'gpt-4o'
  ),
  CASE
    WHEN (SELECT (value::jsonb)->>'model' FROM publication_settings
          WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_4'
          LIMIT 1) ILIKE '%claude%' THEN 'anthropic'
    ELSE 'openai'
  END,
  CASE
    WHEN EXISTS (SELECT 1 FROM publication_settings
                 WHERE publication_id = am.publication_id AND key = 'criteria_4_name')
    THEN true ELSE false
  END
FROM article_modules am
WHERE am.name = 'Primary Articles'
  AND NOT EXISTS (
    SELECT 1 FROM article_module_criteria
    WHERE article_module_id = am.id AND criteria_number = 4
  );

-- Criteria 5 (Primary)
INSERT INTO article_module_criteria (
  article_module_id,
  criteria_number,
  name,
  weight,
  ai_prompt,
  ai_model,
  ai_provider,
  is_active
)
SELECT
  am.id,
  5,
  COALESCE(
    (SELECT value::text FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'criteria_5_name'
     LIMIT 1), 'Uniqueness'
  ),
  COALESCE(
    (SELECT (value::text)::numeric FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'criteria_5_weight'
     LIMIT 1), 0.2
  ),
  (SELECT value::text FROM publication_settings
   WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_5'
   LIMIT 1),
  COALESCE(
    (SELECT (value::jsonb)->>'model' FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_5'
     LIMIT 1), 'gpt-4o'
  ),
  CASE
    WHEN (SELECT (value::jsonb)->>'model' FROM publication_settings
          WHERE publication_id = am.publication_id AND key = 'ai_prompt_criteria_5'
          LIMIT 1) ILIKE '%claude%' THEN 'anthropic'
    ELSE 'openai'
  END,
  CASE
    WHEN EXISTS (SELECT 1 FROM publication_settings
                 WHERE publication_id = am.publication_id AND key = 'criteria_5_name')
    THEN true ELSE false
  END
FROM article_modules am
WHERE am.name = 'Primary Articles'
  AND NOT EXISTS (
    SELECT 1 FROM article_module_criteria
    WHERE article_module_id = am.id AND criteria_number = 5
  );

-- ============================================
-- 4. Migrate Secondary criteria to article_module_criteria
-- ============================================
-- Secondary uses the same criteria as primary (shared prompts)
-- Just copy the primary criteria to secondary module

INSERT INTO article_module_criteria (
  article_module_id,
  criteria_number,
  name,
  weight,
  ai_prompt,
  ai_model,
  ai_provider,
  is_active
)
SELECT
  sec.id,
  pri_crit.criteria_number,
  pri_crit.name,
  pri_crit.weight,
  pri_crit.ai_prompt,
  pri_crit.ai_model,
  pri_crit.ai_provider,
  pri_crit.is_active
FROM article_modules sec
JOIN article_modules pri ON pri.publication_id = sec.publication_id AND pri.name = 'Primary Articles'
JOIN article_module_criteria pri_crit ON pri_crit.article_module_id = pri.id
WHERE sec.name = 'Secondary Articles'
  AND NOT EXISTS (
    SELECT 1 FROM article_module_criteria
    WHERE article_module_id = sec.id AND criteria_number = pri_crit.criteria_number
  );

-- ============================================
-- 5. Migrate article prompts to article_module_prompts
-- ============================================

-- Primary Article Title Prompt
INSERT INTO article_module_prompts (
  article_module_id,
  prompt_type,
  ai_prompt,
  ai_model,
  ai_provider
)
SELECT
  am.id,
  'article_title',
  COALESCE(
    (SELECT value::text FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_primary_article_title'
     LIMIT 1),
    '{"messages": [{"role": "system", "content": "Generate a headline for this article."}]}'
  ),
  COALESCE(
    (SELECT (value::jsonb)->>'model' FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_primary_article_title'
     LIMIT 1), 'gpt-4o'
  ),
  CASE
    WHEN (SELECT (value::jsonb)->>'model' FROM publication_settings
          WHERE publication_id = am.publication_id AND key = 'ai_prompt_primary_article_title'
          LIMIT 1) ILIKE '%claude%' THEN 'anthropic'
    ELSE 'openai'
  END
FROM article_modules am
WHERE am.name = 'Primary Articles'
  AND NOT EXISTS (
    SELECT 1 FROM article_module_prompts
    WHERE article_module_id = am.id AND prompt_type = 'article_title'
  );

-- Primary Article Body Prompt
INSERT INTO article_module_prompts (
  article_module_id,
  prompt_type,
  ai_prompt,
  ai_model,
  ai_provider
)
SELECT
  am.id,
  'article_body',
  COALESCE(
    (SELECT value::text FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_primary_article_body'
     LIMIT 1),
    '{"messages": [{"role": "system", "content": "Generate the article body."}]}'
  ),
  COALESCE(
    (SELECT (value::jsonb)->>'model' FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_primary_article_body'
     LIMIT 1), 'gpt-4o'
  ),
  CASE
    WHEN (SELECT (value::jsonb)->>'model' FROM publication_settings
          WHERE publication_id = am.publication_id AND key = 'ai_prompt_primary_article_body'
          LIMIT 1) ILIKE '%claude%' THEN 'anthropic'
    ELSE 'openai'
  END
FROM article_modules am
WHERE am.name = 'Primary Articles'
  AND NOT EXISTS (
    SELECT 1 FROM article_module_prompts
    WHERE article_module_id = am.id AND prompt_type = 'article_body'
  );

-- Secondary Article Title Prompt
INSERT INTO article_module_prompts (
  article_module_id,
  prompt_type,
  ai_prompt,
  ai_model,
  ai_provider
)
SELECT
  am.id,
  'article_title',
  COALESCE(
    (SELECT value::text FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_secondary_article_title'
     LIMIT 1),
    '{"messages": [{"role": "system", "content": "Generate a headline for this article."}]}'
  ),
  COALESCE(
    (SELECT (value::jsonb)->>'model' FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_secondary_article_title'
     LIMIT 1), 'gpt-4o'
  ),
  CASE
    WHEN (SELECT (value::jsonb)->>'model' FROM publication_settings
          WHERE publication_id = am.publication_id AND key = 'ai_prompt_secondary_article_title'
          LIMIT 1) ILIKE '%claude%' THEN 'anthropic'
    ELSE 'openai'
  END
FROM article_modules am
WHERE am.name = 'Secondary Articles'
  AND NOT EXISTS (
    SELECT 1 FROM article_module_prompts
    WHERE article_module_id = am.id AND prompt_type = 'article_title'
  );

-- Secondary Article Body Prompt
INSERT INTO article_module_prompts (
  article_module_id,
  prompt_type,
  ai_prompt,
  ai_model,
  ai_provider
)
SELECT
  am.id,
  'article_body',
  COALESCE(
    (SELECT value::text FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_secondary_article_body'
     LIMIT 1),
    '{"messages": [{"role": "system", "content": "Generate the article body."}]}'
  ),
  COALESCE(
    (SELECT (value::jsonb)->>'model' FROM publication_settings
     WHERE publication_id = am.publication_id AND key = 'ai_prompt_secondary_article_body'
     LIMIT 1), 'gpt-4o'
  ),
  CASE
    WHEN (SELECT (value::jsonb)->>'model' FROM publication_settings
          WHERE publication_id = am.publication_id AND key = 'ai_prompt_secondary_article_body'
          LIMIT 1) ILIKE '%claude%' THEN 'anthropic'
    ELSE 'openai'
  END
FROM article_modules am
WHERE am.name = 'Secondary Articles'
  AND NOT EXISTS (
    SELECT 1 FROM article_module_prompts
    WHERE article_module_id = am.id AND prompt_type = 'article_body'
  );

-- ============================================
-- 6. Assign RSS feeds to article modules
-- ============================================

-- Assign primary feeds to Primary Articles module
UPDATE rss_feeds
SET article_module_id = (
  SELECT am.id FROM article_modules am
  WHERE am.publication_id = rss_feeds.publication_id
    AND am.name = 'Primary Articles'
  LIMIT 1
)
WHERE use_for_primary_section = true
  AND article_module_id IS NULL;

-- Assign secondary feeds to Secondary Articles module
-- (Only for feeds that are ONLY secondary, not also primary)
UPDATE rss_feeds
SET article_module_id = (
  SELECT am.id FROM article_modules am
  WHERE am.publication_id = rss_feeds.publication_id
    AND am.name = 'Secondary Articles'
  LIMIT 1
)
WHERE use_for_secondary_section = true
  AND use_for_primary_section = false
  AND article_module_id IS NULL;

-- ============================================
-- 7. Update rss_posts with article_module_id from their feeds
-- ============================================
UPDATE rss_posts
SET article_module_id = (
  SELECT article_module_id FROM rss_feeds
  WHERE rss_feeds.id = rss_posts.feed_id
)
WHERE article_module_id IS NULL
  AND feed_id IS NOT NULL;

-- ============================================
-- 8. Migrate articles to module_articles (Primary)
-- ============================================
INSERT INTO module_articles (
  post_id,
  issue_id,
  article_module_id,
  headline,
  content,
  rank,
  is_active,
  skipped,
  fact_check_score,
  fact_check_details,
  word_count,
  review_position,
  final_position,
  breaking_news_score,
  breaking_news_category,
  ai_summary,
  ai_title,
  created_at,
  updated_at
)
SELECT DISTINCT ON (a.post_id, a.issue_id)
  a.post_id::uuid,
  a.issue_id::uuid,
  am.id,
  a.headline,
  a.content,
  a.rank,
  a.is_active,
  a.skipped,
  a.fact_check_score,
  a.fact_check_details,
  a.word_count,
  a.review_position,
  a.final_position,
  a.breaking_news_score,
  a.breaking_news_category,
  a.ai_summary,
  a.ai_title,
  a.created_at,
  a.updated_at
FROM articles a
JOIN publication_issues pi ON pi.id = a.issue_id
JOIN article_modules am ON am.publication_id = pi.publication_id AND am.name = 'Primary Articles'
WHERE NOT EXISTS (
  SELECT 1 FROM module_articles ma
  WHERE ma.post_id = a.post_id::uuid
    AND ma.issue_id = a.issue_id::uuid
    AND ma.article_module_id = am.id
)
ORDER BY a.post_id, a.issue_id, a.created_at DESC;

-- ============================================
-- 9. Migrate secondary_articles to module_articles (Secondary)
-- ============================================
INSERT INTO module_articles (
  post_id,
  issue_id,
  article_module_id,
  headline,
  content,
  rank,
  is_active,
  skipped,
  fact_check_score,
  fact_check_details,
  word_count,
  review_position,
  final_position,
  breaking_news_score,
  breaking_news_category,
  ai_summary,
  ai_title,
  created_at,
  updated_at
)
SELECT DISTINCT ON (sa.post_id, sa.issue_id)
  sa.post_id::uuid,
  sa.issue_id::uuid,
  am.id,
  sa.headline,
  sa.content,
  sa.rank,
  sa.is_active,
  sa.skipped,
  sa.fact_check_score,
  sa.fact_check_details,
  sa.word_count,
  sa.review_position,
  sa.final_position,
  sa.breaking_news_score,
  sa.breaking_news_category,
  sa.ai_summary,
  sa.ai_title,
  sa.created_at,
  sa.updated_at
FROM secondary_articles sa
JOIN publication_issues pi ON pi.id = sa.issue_id
JOIN article_modules am ON am.publication_id = pi.publication_id AND am.name = 'Secondary Articles'
WHERE NOT EXISTS (
  SELECT 1 FROM module_articles ma
  WHERE ma.post_id = sa.post_id::uuid
    AND ma.issue_id = sa.issue_id::uuid
    AND ma.article_module_id = am.id
)
ORDER BY sa.post_id, sa.issue_id, sa.created_at DESC;

-- ============================================
-- 10. Create issue_article_modules entries for existing issues
-- ============================================
-- For each issue, create entries for both Primary and Secondary modules
-- with article_ids populated from migrated module_articles

-- Primary Articles module entries
INSERT INTO issue_article_modules (
  issue_id,
  article_module_id,
  article_ids,
  selection_mode,
  selected_at
)
SELECT DISTINCT
  ma.issue_id,
  ma.article_module_id,
  (SELECT jsonb_agg(ma2.id) FROM module_articles ma2
   WHERE ma2.issue_id = ma.issue_id
     AND ma2.article_module_id = ma.article_module_id
     AND ma2.is_active = true),
  'top_score',
  NOW()
FROM module_articles ma
JOIN article_modules am ON am.id = ma.article_module_id
WHERE am.name = 'Primary Articles'
  AND NOT EXISTS (
    SELECT 1 FROM issue_article_modules iam
    WHERE iam.issue_id = ma.issue_id
      AND iam.article_module_id = ma.article_module_id
  )
GROUP BY ma.issue_id, ma.article_module_id;

-- Secondary Articles module entries
INSERT INTO issue_article_modules (
  issue_id,
  article_module_id,
  article_ids,
  selection_mode,
  selected_at
)
SELECT DISTINCT
  ma.issue_id,
  ma.article_module_id,
  (SELECT jsonb_agg(ma2.id) FROM module_articles ma2
   WHERE ma2.issue_id = ma.issue_id
     AND ma2.article_module_id = ma.article_module_id
     AND ma2.is_active = true),
  'top_score',
  NOW()
FROM module_articles ma
JOIN article_modules am ON am.id = ma.article_module_id
WHERE am.name = 'Secondary Articles'
  AND NOT EXISTS (
    SELECT 1 FROM issue_article_modules iam
    WHERE iam.issue_id = ma.issue_id
      AND iam.article_module_id = ma.article_module_id
  )
GROUP BY ma.issue_id, ma.article_module_id;

-- ============================================
-- Summary
-- ============================================
-- Migrated:
--   - Created Primary Articles and Secondary Articles modules per publication
--   - Migrated criteria 1-5 to article_module_criteria for both modules
--   - Migrated title/body prompts to article_module_prompts
--   - Assigned RSS feeds to modules based on use_for_primary_section/use_for_secondary_section
--   - Updated rss_posts with article_module_id from feeds
--   - Migrated articles table to module_articles (Primary)
--   - Migrated secondary_articles table to module_articles (Secondary)
--   - Created issue_article_modules entries for existing issues
--
-- Note: Original tables (articles, secondary_articles) are preserved for rollback safety
-- They can be dropped after verifying migration success
