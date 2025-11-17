-- Add Poll Section to Newsletter Sections
-- Migration: add_poll_section.sql
-- Date: 2025-11-17
-- Description: Adds Poll section to newsletter_sections for all publications

-- Add Poll section for each publication that doesn't already have one
INSERT INTO newsletter_sections (publication_id, name, display_order, is_active)
SELECT
  p.id as publication_id,
  'Poll' as name,
  COALESCE((SELECT MAX(display_order) FROM newsletter_sections WHERE publication_id = p.id), 0) + 10 as display_order,
  true as is_active
FROM publications p
WHERE NOT EXISTS (
  SELECT 1 FROM newsletter_sections ns
  WHERE ns.publication_id = p.id AND ns.name = 'Poll'
);

-- Verify the insert
SELECT
  ns.id,
  p.name as publication_name,
  ns.name as section_name,
  ns.display_order,
  ns.is_active
FROM newsletter_sections ns
JOIN publications p ON p.id = ns.publication_id
WHERE ns.name = 'Poll'
ORDER BY p.name;
