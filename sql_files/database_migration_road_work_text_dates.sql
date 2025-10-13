-- Road Work Database Migration: Change date fields from DATE to TEXT
-- Run this in Supabase SQL Editor to fix date parsing issues

-- Step 1: Change start_date and expected_reopen from DATE to TEXT
ALTER TABLE road_work_items
ALTER COLUMN start_date TYPE TEXT,
ALTER COLUMN expected_reopen TYPE TEXT;

-- Step 2: Verify the change worked
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'road_work_items' AND column_name IN ('start_date', 'expected_reopen');

-- Note: This allows storing original AI response dates like "mid-Oct", "Nov 15", etc.
-- without requiring complex date parsing logic