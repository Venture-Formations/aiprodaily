-- Database Migration: Complete Newsletter Sections Setup
-- This ensures all newsletter sections that the system supports are properly configured
-- Date: 2025-09-23

-- Add Yesterday's Wordle section (only if it doesn't exist)
INSERT INTO newsletter_sections (name, display_order, is_active)
SELECT "Yesterday's Wordle", 40, true
WHERE NOT EXISTS (
    SELECT 1 FROM newsletter_sections WHERE name = "Yesterday's Wordle"
);

-- Add Minnesota Getaways section (only if it doesn't exist)
INSERT INTO newsletter_sections (name, display_order, is_active)
SELECT 'Minnesota Getaways', 50, true
WHERE NOT EXISTS (
    SELECT 1 FROM newsletter_sections WHERE name = 'Minnesota Getaways'
);

-- Add Dining Deals section (only if it doesn't exist)
INSERT INTO newsletter_sections (name, display_order, is_active)
SELECT 'Dining Deals', 60, true
WHERE NOT EXISTS (
    SELECT 1 FROM newsletter_sections WHERE name = 'Dining Deals'
);

-- Update display orders to ensure proper spacing and ordering
-- This gives us:
-- 1. The Local Scoop (10)
-- 2. Local Events (20)
-- 3. Local Weather (30)
-- 4. Yesterday's Wordle (40)
-- 5. Minnesota Getaways (50)
-- 6. Dining Deals (60)

UPDATE newsletter_sections SET display_order = 10 WHERE name = 'The Local Scoop' AND display_order != 10;
UPDATE newsletter_sections SET display_order = 20 WHERE name = 'Local Events' AND display_order != 20;
UPDATE newsletter_sections SET display_order = 30 WHERE name = 'Local Weather' AND display_order != 30;
UPDATE newsletter_sections SET display_order = 40 WHERE name = "Yesterday's Wordle" AND display_order != 40;
UPDATE newsletter_sections SET display_order = 50 WHERE name = 'Minnesota Getaways' AND display_order != 50;
UPDATE newsletter_sections SET display_order = 60 WHERE name = 'Dining Deals' AND display_order != 60;

-- Show final configuration
SELECT name, display_order, is_active
FROM newsletter_sections
ORDER BY display_order ASC;