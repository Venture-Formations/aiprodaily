-- CRITICAL FIX: Update post_ratings constraint to allow interest_level 1-20
-- The database currently has CHECK (interest_level <= 10) which blocks the 1-20 scale
--
-- Instructions:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Run this SQL:

ALTER TABLE post_ratings DROP CONSTRAINT IF EXISTS post_ratings_interest_level_check;

ALTER TABLE post_ratings ADD CONSTRAINT post_ratings_interest_level_check
CHECK (interest_level >= 1 AND interest_level <= 20);

-- Verify the change:
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'post_ratings_interest_level_check';

-- Expected result: CHECK (interest_level >= 1 AND interest_level <= 20)
