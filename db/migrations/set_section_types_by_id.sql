-- Set section_type by stable section IDs
-- Migration: set_section_types_by_id.sql
-- Date: 2025-11-17
-- Description: Sets section_type based on stable section IDs (not names which can change)

-- IMPORTANT: This migration should be run AFTER add_section_type_to_newsletter_sections.sql
-- It ensures section_type is set correctly based on immutable section IDs

-- Known section IDs (from existing database)
-- These IDs are stable and don't change when names are updated

-- AI Pro Daily sections
UPDATE newsletter_sections SET section_type = 'primary_articles' WHERE id = 'bab4f978-7d69-43a9-a8cd-ff6f94c2f55a';  -- Latest in Accounting AI
UPDATE newsletter_sections SET section_type = 'ai_applications' WHERE id = '853f8d0b-bc76-473a-bfc6-421418266222';    -- AI Apps for the Week
UPDATE newsletter_sections SET section_type = 'secondary_articles' WHERE id = '78e02847-8c75-4455-a47e-55cc73aa3c25'; -- Updates in AI
UPDATE newsletter_sections SET section_type = 'prompt_ideas' WHERE id = 'a917ac63-6cf0-428b-afe7-60a74fbf160b';       -- Prompt Ideas
UPDATE newsletter_sections SET section_type = 'advertorial' WHERE id = 'c0bc7173-de47-41b2-a260-77f55525ee3d';        -- Advertorial
UPDATE newsletter_sections SET section_type = 'poll' WHERE id = 'd12a9c84-2f5e-4b87-9a3c-8e1f6d7b0c2a';               -- Poll

-- Add more section IDs as they are created
-- Use this pattern:
-- UPDATE newsletter_sections SET section_type = 'TYPE' WHERE id = 'UUID';

-- Verify the updates
SELECT
  p.name as publication_name,
  ns.id as section_id,
  ns.name as section_name,
  ns.section_type,
  ns.display_order,
  ns.is_active
FROM newsletter_sections ns
JOIN publications p ON p.id = ns.publication_id
ORDER BY p.name, ns.display_order;
