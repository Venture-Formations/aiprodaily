-- ============================================
-- DATABASE DIAGNOSTIC SCRIPT
-- ============================================
-- Check current state of tables and data types
-- Run this to see what's causing the foreign key error
-- ============================================

-- Check if newsletter_campaigns table exists and its id type
SELECT
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'newsletter_campaigns'
  AND column_name = 'id';

-- Check if duplicate_groups table exists and its campaign_id type
SELECT
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'duplicate_groups'
  AND column_name = 'campaign_id';

-- Check all tables with campaign_id columns and their types
SELECT
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE column_name = 'campaign_id'
ORDER BY table_name;

-- List all existing tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check for existing foreign key constraints on campaign_id
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'campaign_id';
