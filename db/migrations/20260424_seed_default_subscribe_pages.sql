-- Migration: Seed default subscribe_pages from publication_settings
-- Date: 2026-04-24
-- Purpose: One-time backfill. For each active publication that has any of
--          subscribe_heading / subscribe_subheading / subscribe_tagline set
--          and does NOT already have a default subscribe_page, create one
--          from those setting values and mark it as default. Idempotent.
--
-- Safe to re-run: the NOT EXISTS guard ensures we never overwrite a page
-- the admin has already marked as default.

INSERT INTO subscribe_pages (publication_id, name, content, is_default)
SELECT
  s.publication_id,
  'Current (seeded)',
  jsonb_strip_nulls(jsonb_build_object(
    'heading',    s.heading,
    'subheading', s.subheading,
    'tagline',    s.tagline
  )),
  true
FROM (
  SELECT
    p.id AS publication_id,
    -- publication_settings values may be JSON-stringified (wrapped in quotes).
    -- Strip leading/trailing double quotes to match the runtime read path
    -- in getPublicationSetting().
    NULLIF(
      TRIM(BOTH '"' FROM (
        SELECT value FROM publication_settings
        WHERE publication_id = p.id AND key = 'subscribe_heading'
      )),
      ''
    ) AS heading,
    NULLIF(
      TRIM(BOTH '"' FROM (
        SELECT value FROM publication_settings
        WHERE publication_id = p.id AND key = 'subscribe_subheading'
      )),
      ''
    ) AS subheading,
    NULLIF(
      TRIM(BOTH '"' FROM (
        SELECT value FROM publication_settings
        WHERE publication_id = p.id AND key = 'subscribe_tagline'
      )),
      ''
    ) AS tagline
  FROM publications p
  WHERE p.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM subscribe_pages sp
      WHERE sp.publication_id = p.id
        AND sp.is_default = true
        AND sp.is_archived = false
    )
) s
WHERE s.heading IS NOT NULL
   OR s.subheading IS NOT NULL
   OR s.tagline IS NOT NULL;
