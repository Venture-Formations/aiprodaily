-- ============================================
-- FIX NEWSLETTER_CAMPAIGNS ID DEFAULT
-- ============================================
-- The id column is missing its UUID default generator
-- This fixes it so campaigns can be created
-- ============================================

-- Check current default for id column
-- (Run this first to see what's there)
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'newsletter_campaigns'
  AND column_name = 'id';

-- Fix: Add default UUID generator to id column
-- Use gen_random_uuid() which is built into PostgreSQL 13+
ALTER TABLE newsletter_campaigns
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Verify the fix
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'newsletter_campaigns'
  AND column_name = 'id';

-- ============================================
-- COMPLETE!
-- ============================================
-- The newsletter_campaigns.id column now has a default
-- UUID generator, so new campaigns will automatically
-- get an ID assigned.
-- ============================================
