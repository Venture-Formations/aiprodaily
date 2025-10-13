-- Migration Script: Convert existing feedback_responses to poll_responses
-- Run this AFTER running create_polls_system.sql

-- Step 1: Get the ID of the initial poll
DO $$
DECLARE
  initial_poll_id UUID;
  feedback_count INTEGER;
  migrated_count INTEGER;
BEGIN
  -- Get the first/active poll ID (should be the one we just created)
  SELECT id INTO initial_poll_id
  FROM polls
  WHERE title = 'Your opinion matters!'
  LIMIT 1;

  IF initial_poll_id IS NULL THEN
    RAISE EXCEPTION 'Initial poll not found. Please run create_polls_system.sql first.';
  END IF;

  RAISE NOTICE 'Found initial poll ID: %', initial_poll_id;

  -- Count existing feedback responses
  SELECT COUNT(*) INTO feedback_count FROM feedback_responses;
  RAISE NOTICE 'Found % feedback responses to migrate', feedback_count;

  -- Migrate feedback_responses to poll_responses
  -- Note: We use the section_choice as the selected_option
  -- We don't have a campaign_id in feedback_responses, so it will be NULL
  INSERT INTO poll_responses (poll_id, subscriber_email, selected_option, campaign_id, responded_at)
  SELECT
    initial_poll_id,
    subscriber_email,
    section_choice,
    NULL,  -- No campaign_id in old feedback system
    created_at
  FROM feedback_responses
  ON CONFLICT (poll_id, subscriber_email) DO NOTHING;

  -- Count how many were migrated
  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % feedback responses to poll_responses', migrated_count;

  -- Optional: You can choose to keep or drop the old feedback_responses table
  -- UNCOMMENT the line below if you want to drop the old table after successful migration
  -- DROP TABLE IF EXISTS feedback_responses;

  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE 'Old feedback_responses table still exists. Drop it manually if no longer needed.';
END $$;
