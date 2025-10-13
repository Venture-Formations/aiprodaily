-- Cleanup duplicate newsletter sections
-- This script will remove duplicate sections and keep only the ones with correct display orders

-- First, let's see what duplicates exist
SELECT name, COUNT(*) as count, array_agg(id) as ids, array_agg(display_order) as orders
FROM newsletter_sections
GROUP BY name
HAVING COUNT(*) > 1;

-- Remove duplicate "Local Events" sections (keep the one with display_order = 20)
DELETE FROM newsletter_sections
WHERE name = 'Local Events'
AND display_order != 20;

-- Remove duplicate "Local Weather" sections (keep the one with display_order = 30)
DELETE FROM newsletter_sections
WHERE name = 'Local Weather'
AND display_order != 30;

-- Remove any "Weather Forecast" sections (this should be "Local Weather")
DELETE FROM newsletter_sections
WHERE name = 'Weather Forecast';

-- Ensure we have the correct 6 sections with proper display orders
INSERT INTO newsletter_sections (name, display_order, is_active)
VALUES
  ('The Local Scoop', 10, true),
  ('Local Events', 20, true),
  ('Local Weather', 30, true),
  ('Yesterday''s Wordle', 40, true),
  ('Minnesota Getaways', 50, true),
  ('Dining Deals', 60, true)
ON CONFLICT (name) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- Verify the final result
SELECT id, name, display_order, is_active, created_at
FROM newsletter_sections
ORDER BY display_order;