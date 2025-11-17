-- Add quaternary_color to publication_settings
-- Migration: add_quaternary_color.sql
-- Date: 2025-11-17
-- Description: Adds quaternary_color (4th color) setting to all publications with a default purple color

-- STEP 1: Verify current color settings
SELECT
  p.name as publication_name,
  ps.key,
  ps.value
FROM publications p
LEFT JOIN publication_settings ps ON ps.publication_id = p.id
WHERE ps.key IN ('primary_color', 'secondary_color', 'tertiary_color', 'quaternary_color')
ORDER BY p.name, ps.key;

-- STEP 2: Add quaternary_color to all publications that don't have it
-- Uses a default purple color (#8B5CF6) that complements most color schemes
INSERT INTO publication_settings (publication_id, key, value, description, created_at, updated_at)
SELECT
  p.id,
  'quaternary_color',
  '#8B5CF6',
  'Quaternary/fourth accent color for the publication brand',
  NOW() as created_at,
  NOW() as updated_at
FROM publications p
WHERE NOT EXISTS (
  SELECT 1 FROM publication_settings ps
  WHERE ps.publication_id = p.id AND ps.key = 'quaternary_color'
)
ON CONFLICT (publication_id, key) DO NOTHING;

-- STEP 3: Verify the migration
SELECT
  p.name as publication_name,
  ps.key,
  ps.value
FROM publications p
JOIN publication_settings ps ON ps.publication_id = p.id
WHERE ps.key IN ('primary_color', 'secondary_color', 'tertiary_color', 'quaternary_color')
ORDER BY p.name, ps.key;

-- STEP 4: Summary count
SELECT
  'quaternary_color added' as status,
  COUNT(*) as count
FROM publication_settings
WHERE key = 'quaternary_color';
