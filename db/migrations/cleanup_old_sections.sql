-- Cleanup old sections and convert Polls to poll module
-- Run this after the poll_modules table has been created

-- 1. Delete the "Presented by" section (no longer used)
DELETE FROM newsletter_sections WHERE name = 'Presented by';

-- 2. Delete the old "Polls" section (replaced by poll_modules system)
DELETE FROM newsletter_sections WHERE name = 'Polls';

-- 3. Create a default poll module if none exist for the publication
-- First, get the publication_id (assuming single publication)
INSERT INTO poll_modules (publication_id, name, display_order, is_active, block_order)
SELECT
  p.id,
  'Weekly Poll',
  10, -- Display order
  true,
  '["title", "question", "image", "options"]'::jsonb
FROM publications p
WHERE NOT EXISTS (
  SELECT 1 FROM poll_modules pm WHERE pm.publication_id = p.id
)
LIMIT 1;

-- Verify the changes
SELECT 'newsletter_sections after cleanup:' as info;
SELECT id, name, is_active, display_order FROM newsletter_sections ORDER BY display_order;

SELECT 'poll_modules:' as info;
SELECT id, name, is_active, display_order FROM poll_modules ORDER BY display_order;
