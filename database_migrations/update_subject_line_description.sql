-- Update Subject Line Generator description to use {{top_article}} placeholder
-- This corrects the placeholder documentation to match actual usage

UPDATE app_settings
SET description = 'Content Generation - Subject Line Generator: AI prompt for generating newsletter subject lines (use {{top_article}} placeholder)'
WHERE key = 'ai_prompt_subject_line';

-- Verify the update
SELECT key, description
FROM app_settings
WHERE key = 'ai_prompt_subject_line';
