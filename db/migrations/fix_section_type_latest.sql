-- Fix section_type for "Latest" sections
-- Migration: fix_section_type_latest.sql
-- Date: 2025-11-17
-- Description: Updates sections with "latest" in name to be primary_articles type

-- Update sections with "latest" in the name to be primary_articles
UPDATE newsletter_sections
SET section_type = 'primary_articles'
WHERE LOWER(name) LIKE '%latest%' AND section_type = 'custom';

-- Verify the update
SELECT
  p.name as publication_name,
  ns.name as section_name,
  ns.section_type,
  ns.display_order
FROM newsletter_sections ns
JOIN publications p ON p.id = ns.publication_id
WHERE ns.section_type = 'primary_articles'
ORDER BY p.name;
