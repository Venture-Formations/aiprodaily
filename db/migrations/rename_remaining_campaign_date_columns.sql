-- Rename remaining campaign_date columns
-- This migration handles tables that were missed in the main campaign → issue migration
-- Part of the campaign → issue terminology migration

-- ============================================================
-- Table 1: issue_advertisements (campaign_date → issue_date)
-- ============================================================

-- Rename campaign_date to issue_date
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'issue_advertisements'
    AND column_name = 'campaign_date'
  ) THEN
    ALTER TABLE issue_advertisements
    RENAME COLUMN campaign_date TO issue_date;
    RAISE NOTICE '✓ Renamed campaign_date to issue_date in issue_advertisements';
  ELSE
    RAISE NOTICE '⚠ Column campaign_date not found in issue_advertisements (already renamed or doesn''t exist)';
  END IF;
END $$;

-- Rename campaign_id to issue_id (if not already renamed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'issue_advertisements'
    AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE issue_advertisements
    RENAME COLUMN campaign_id TO issue_id;
    RAISE NOTICE '✓ Renamed campaign_id to issue_id in issue_advertisements';
  ELSE
    RAISE NOTICE '⚠ Column campaign_id not found in issue_advertisements (already renamed or doesn''t exist)';
  END IF;
END $$;

-- ============================================================
-- Table 2: feedback_responses (campaign_date → issue_date)
-- ============================================================

-- Check if feedback_responses table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'feedback_responses'
  ) THEN
    -- Rename campaign_date to issue_date
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'feedback_responses'
      AND column_name = 'campaign_date'
    ) THEN
      ALTER TABLE feedback_responses
      RENAME COLUMN campaign_date TO issue_date;
      RAISE NOTICE '✓ Renamed campaign_date to issue_date in feedback_responses';
    ELSE
      RAISE NOTICE '⚠ Column campaign_date not found in feedback_responses (already renamed or doesn''t exist)';
    END IF;

    -- Update unique constraint if it exists
    -- Drop old constraint: (campaign_date, subscriber_email)
    -- Create new constraint: (issue_date, subscriber_email)
    IF EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_name = 'feedback_responses'
      AND constraint_name LIKE '%campaign_date%'
    ) THEN
      ALTER TABLE feedback_responses
      DROP CONSTRAINT IF EXISTS feedback_responses_campaign_date_subscriber_email_key;

      ALTER TABLE feedback_responses
      ADD CONSTRAINT feedback_responses_issue_date_subscriber_email_key
      UNIQUE (issue_date, subscriber_email);

      RAISE NOTICE '✓ Updated unique constraint in feedback_responses';
    ELSE
      RAISE NOTICE '⚠ No campaign_date constraint found in feedback_responses';
    END IF;
  ELSE
    RAISE NOTICE '⚠ Table feedback_responses does not exist';
  END IF;
END $$;

-- ============================================================
-- Verification
-- ============================================================

-- Verify issue_advertisements columns
DO $$
BEGIN
  RAISE NOTICE '=== Verification: issue_advertisements columns ===';
END $$;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'issue_advertisements'
ORDER BY ordinal_position;

-- Verify feedback_responses columns (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback_responses') THEN
    RAISE NOTICE '=== Verification: feedback_responses columns ===';
  END IF;
END $$;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'feedback_responses'
ORDER BY ordinal_position;

-- Final status
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables updated:';
  RAISE NOTICE '  1. issue_advertisements: campaign_date → issue_date';
  RAISE NOTICE '  2. feedback_responses: campaign_date → issue_date (if exists)';
  RAISE NOTICE '========================================';
END $$;
