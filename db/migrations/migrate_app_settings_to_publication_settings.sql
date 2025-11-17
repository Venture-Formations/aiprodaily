-- Migrate app_settings to publication_settings
-- Migration: migrate_app_settings_to_publication_settings.sql
-- Date: 2025-11-17
-- Description: Copies all settings from app_settings to publication_settings for the 'accounting' publication

-- STEP 1: Verify the publication exists
SELECT id, name, slug FROM publications WHERE slug = 'accounting';

-- STEP 2: Run the migration
-- Insert all app_settings for the accounting publication
-- Uses ON CONFLICT to handle duplicates (updates existing values)
INSERT INTO publication_settings (publication_id, key, value, description, created_at, updated_at)
SELECT
  (SELECT id FROM publications WHERE slug = 'accounting'),
  key,
  value,
  description,
  NOW() as created_at,
  NOW() as updated_at
FROM app_settings
ON CONFLICT (publication_id, key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = COALESCE(EXCLUDED.description, publication_settings.description),
  updated_at = NOW();

-- STEP 3: Verify the migration
-- Check that counts match
SELECT
  'app_settings' as source,
  COUNT(*) as count
FROM app_settings
UNION ALL
SELECT
  'publication_settings' as source,
  COUNT(*) as count
FROM publication_settings
WHERE publication_id = (SELECT id FROM publications WHERE slug = 'accounting');

-- List all migrated settings
SELECT
  key,
  LEFT(value, 100) as value_preview,
  updated_at
FROM publication_settings
WHERE publication_id = (SELECT id FROM publications WHERE slug = 'accounting')
ORDER BY key;

-- STEP 4: Verify specific critical settings
SELECT
  key,
  CASE
    WHEN value IS NOT NULL THEN 'Has value'
    ELSE 'NULL'
  END as status,
  LEFT(value, 50) as value_preview
FROM publication_settings
WHERE publication_id = (SELECT id FROM publications WHERE slug = 'accounting')
  AND key IN (
    'primary_color',
    'website_url',
    'newsletter_name',
    'email_senderName',
    'email_fromEmail',
    'mailerlite_group_id',
    'primary_article_lookback_hours',
    'max_top_articles'
  )
ORDER BY key;

-- STEP 5: Check for any settings that didn't migrate (NULL values)
SELECT key, value
FROM publication_settings
WHERE publication_id = (SELECT id FROM publications WHERE slug = 'accounting')
  AND value IS NULL
ORDER BY key;
