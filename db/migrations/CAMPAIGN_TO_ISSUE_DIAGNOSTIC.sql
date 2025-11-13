-- ============================================================
-- CAMPAIGN → ISSUE MIGRATION DIAGNOSTIC
-- ============================================================
-- Purpose: Discover which tables exist and have campaign_id columns
-- Run this BEFORE attempting migration to customize the script
-- ============================================================

-- Find all tables with campaign_id column
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE column_name LIKE '%campaign%'
  AND table_schema = 'public'
ORDER BY table_name, column_name;

-- Check if newsletter_campaigns table exists
SELECT
  CASE
    WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_campaigns')
    THEN 'YES - newsletter_campaigns table exists'
    ELSE 'NO - newsletter_campaigns table does NOT exist'
  END as table_status;

-- Check if publication_issues table already exists (migration already done?)
SELECT
  CASE
    WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'publication_issues')
    THEN 'YES - publication_issues table EXISTS (migration may be done)'
    ELSE 'NO - publication_issues table does not exist'
  END as migration_status;

-- Count rows in newsletter_campaigns (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletter_campaigns') THEN
    RAISE NOTICE 'newsletter_campaigns row count: %', (SELECT COUNT(*) FROM newsletter_campaigns);
  END IF;
END $$;

-- List all tables in public schema (for reference)
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check for foreign key constraints referencing campaign_id
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (kcu.column_name LIKE '%campaign%' OR ccu.column_name LIKE '%campaign%')
ORDER BY tc.table_name;

-- Check for indexes on campaign columns
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%campaign%'
ORDER BY tablename, indexname;

-- Check for enum types containing 'campaign'
SELECT
  t.typname as enum_name,
  e.enumlabel as enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%campaign%'
ORDER BY t.typname, e.enumsortorder;
