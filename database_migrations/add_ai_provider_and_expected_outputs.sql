-- ============================================
-- Add AI Provider and Expected Outputs to app_settings
-- ============================================
-- This migration adds support for:
-- 1. AI provider selection (OpenAI vs Claude) per prompt
-- 2. Expected output fields for validation
-- 3. Migrates existing prompts to JSON format

-- Step 1: Add new columns to app_settings
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'openai' CHECK (ai_provider IN ('openai', 'claude')),
ADD COLUMN IF NOT EXISTS expected_outputs JSONB;

-- Step 2: Add comments to explain the columns
COMMENT ON COLUMN app_settings.ai_provider IS 'AI provider to use for this prompt (openai or claude)';
COMMENT ON COLUMN app_settings.expected_outputs IS 'JSON object defining expected output fields for validation, e.g. {"Score": "integer", "Reason": "string"}';

-- Step 3: Set default AI providers for existing prompts (all default to openai)
UPDATE app_settings
SET ai_provider = 'openai'
WHERE key LIKE 'ai_prompt_%' AND ai_provider IS NULL;

-- Step 4: Set expected outputs for criteria prompts
UPDATE app_settings
SET expected_outputs = '{"score": "integer", "reason": "string"}'::jsonb
WHERE key LIKE 'ai_prompt_criteria_%';

-- Step 5: Set expected outputs for article title prompts
UPDATE app_settings
SET expected_outputs = '{"title": "string"}'::jsonb
WHERE key IN ('ai_prompt_primary_article_title', 'ai_prompt_secondary_article_title');

-- Step 6: Set expected outputs for article body prompts
UPDATE app_settings
SET expected_outputs = '{"content": "string", "word_count": "integer"}'::jsonb
WHERE key IN ('ai_prompt_primary_article_body', 'ai_prompt_secondary_article_body');

-- Step 7: Set expected outputs for subject line generator
UPDATE app_settings
SET expected_outputs = '{"subject": "string"}'::jsonb
WHERE key = 'ai_prompt_subject_line_generator';

-- Step 8: Set expected outputs for article writer (combined title + body)
UPDATE app_settings
SET expected_outputs = '{"headline": "string", "content": "string", "word_count": "integer"}'::jsonb
WHERE key = 'ai_prompt_article_writer';

-- Step 9: Set expected outputs for fact checker
UPDATE app_settings
SET expected_outputs = '{"score": "integer", "details": "string", "passed": "boolean"}'::jsonb
WHERE key = 'ai_prompt_fact_checker';

-- Step 10: Set expected outputs for topic deduper
UPDATE app_settings
SET expected_outputs = '{
  "groups": {
    "type": "array",
    "items": {
      "topic_signature": "string",
      "primary_article_index": "integer",
      "duplicate_indices": "array",
      "similarity_explanation": "string"
    }
  }
}'::jsonb
WHERE key = 'ai_prompt_topic_deduper';

-- Step 11: Set expected outputs for breaking news scorer
UPDATE app_settings
SET expected_outputs = '{"score": "integer", "category": "string", "reasoning": "string", "key_topics": "array", "urgency": "string", "actionable": "boolean"}'::jsonb
WHERE key = 'ai_prompt_breaking_news_scorer';

-- Step 12: Set expected outputs for welcome section
UPDATE app_settings
SET expected_outputs = '{"welcome_text": "string"}'::jsonb
WHERE key = 'ai_prompt_welcome_section';

-- Step 13: Migrate existing plain text prompts to JSON format
-- This will convert prompts from plain text to JSON API request format
-- Note: This is a one-way migration. Back up your data before running this.
-- Note: The value column is JSONB, so we work with JSONB values

-- For criteria prompts (1-5)
-- Check if value is a string (plain text prompt), and if so, wrap it in JSON API format
UPDATE app_settings
SET value = jsonb_build_object(
  'model', 'gpt-4o',
  'messages', jsonb_build_array(
    jsonb_build_object(
      'role', 'user',
      'content', value #>> '{}'  -- Extract string value from JSONB
    )
  ),
  'temperature', 0.7,
  'max_tokens', 1000
)
WHERE key LIKE 'ai_prompt_criteria_%'
AND key ~ 'ai_prompt_criteria_[1-5]$'
AND jsonb_typeof(value) = 'string';  -- Only migrate if value is a JSON string (not object)

-- For article title prompts
UPDATE app_settings
SET value = jsonb_build_object(
  'model', 'gpt-4o',
  'messages', jsonb_build_array(
    jsonb_build_object(
      'role', 'user',
      'content', value #>> '{}'  -- Extract string value from JSONB
    )
  ),
  'temperature', 0.7,
  'max_tokens', 500
)
WHERE key IN ('ai_prompt_primary_article_title', 'ai_prompt_secondary_article_title')
AND jsonb_typeof(value) = 'string';  -- Only migrate if value is a JSON string (not object)

-- For article body prompts
UPDATE app_settings
SET value = jsonb_build_object(
  'model', 'gpt-4o',
  'messages', jsonb_build_array(
    jsonb_build_object(
      'role', 'user',
      'content', value #>> '{}'  -- Extract string value from JSONB
    )
  ),
  'temperature', 0.7,
  'max_tokens', 1000
)
WHERE key IN ('ai_prompt_primary_article_body', 'ai_prompt_secondary_article_body')
AND jsonb_typeof(value) = 'string';  -- Only migrate if value is a JSON string (not object)

-- For other prompts, keep them as-is for now (they may have custom formats)
-- Users can manually migrate them using the UI if needed

-- Verification queries (uncomment to run):
-- SELECT key, ai_provider, expected_outputs, LEFT(value, 100) as value_preview
-- FROM app_settings
-- WHERE key LIKE 'ai_prompt_%'
-- ORDER BY key;
