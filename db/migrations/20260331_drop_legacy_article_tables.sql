-- Phase 5: Drop legacy articles and secondary_articles tables
--
-- PREREQUISITES (must be verified before running):
-- 1. All code references to articles/secondary_articles migrated (Phases 1-4)
-- 2. Full newsletter workflow verified on staging
-- 3. 1-week staging soak completed
-- 4. Backups taken and verified
-- 5. FK constraints inspected
--
-- DO NOT RUN until all prerequisites are confirmed.

-- Step 1: Drop FK constraints explicitly (do NOT rely on CASCADE)
ALTER TABLE archived_articles DROP CONSTRAINT IF EXISTS archived_articles_original_article_id_fkey;

-- Step 2: Drop article_performance if it exists (FK to articles)
DROP TABLE IF EXISTS article_performance;

-- Step 3: Verify no remaining FKs reference these tables
-- Run this SELECT manually and confirm 0 rows before proceeding:
--   SELECT conname, conrelid::regclass FROM pg_constraint
--   WHERE confrelid IN ('articles'::regclass, 'secondary_articles'::regclass);

-- Step 4: Drop tables WITHOUT CASCADE
DROP TABLE IF EXISTS secondary_articles;
DROP TABLE IF EXISTS articles;
