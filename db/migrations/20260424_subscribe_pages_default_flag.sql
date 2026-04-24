-- Migration: Add is_default flag to subscribe_pages
-- Date: 2026-04-24
-- Purpose: Allow marking one subscribe_page per publication as the "default"
--          content rendered on /subscribe when no A/B test is active.
--          Replaces publication_settings.subscribe_{heading,subheading,tagline}
--          as the editable source of truth (old keys remain as fallback).

ALTER TABLE subscribe_pages
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- At most one default page per publication. Archived pages can't be default.
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscribe_pages_one_default_per_pub
  ON subscribe_pages(publication_id)
  WHERE is_default = true AND is_archived = false;
