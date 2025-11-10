-- Update Topic Deduplicator expected outputs for test result parsing
-- Simplified to work with parseResponseOutputs function
-- Both "groups" and "unique_articles" will be shown in test results
-- Each group contains: topic_signature, primary_article_index, duplicate_indices, similarity_explanation

UPDATE app_settings
SET expected_outputs = '{
  "groups": "array",
  "unique_articles": "array"
}'::jsonb
WHERE key = 'ai_prompt_topic_deduper';

-- Verify the update
SELECT
  key,
  expected_outputs
FROM app_settings
WHERE key = 'ai_prompt_topic_deduper';
