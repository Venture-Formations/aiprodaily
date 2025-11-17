-- Add section_type column to newsletter_sections
-- Migration: add_section_type_to_newsletter_sections.sql
-- Date: 2025-11-17
-- Description: Adds section_type enum to identify sections by type rather than name/position

-- Create enum for section types
CREATE TYPE section_type AS ENUM (
  'primary_articles',
  'secondary_articles',
  'welcome',
  'ai_applications',
  'prompt_ideas',
  'advertorial',
  'poll',
  'breaking_news',
  'beyond_the_feed',
  'custom'
);

-- Add section_type column
ALTER TABLE newsletter_sections
ADD COLUMN section_type section_type DEFAULT 'custom';

-- Update existing sections based on their names
-- Primary/Top Articles
UPDATE newsletter_sections
SET section_type = 'primary_articles'
WHERE LOWER(name) LIKE '%top%' OR LOWER(name) LIKE '%primary%' OR LOWER(name) LIKE '%main%';

-- Secondary Articles
UPDATE newsletter_sections
SET section_type = 'secondary_articles'
WHERE LOWER(name) LIKE '%secondary%' OR LOWER(name) LIKE '%updates%' OR LOWER(name) LIKE '%more stories%';

-- Welcome
UPDATE newsletter_sections
SET section_type = 'welcome'
WHERE LOWER(name) = 'welcome';

-- AI Applications
UPDATE newsletter_sections
SET section_type = 'ai_applications'
WHERE LOWER(name) LIKE '%ai app%' OR LOWER(name) LIKE '%ai tool%';

-- Prompt Ideas
UPDATE newsletter_sections
SET section_type = 'prompt_ideas'
WHERE LOWER(name) LIKE '%prompt%';

-- Advertorial
UPDATE newsletter_sections
SET section_type = 'advertorial'
WHERE LOWER(name) LIKE '%advertor%' OR LOWER(name) LIKE '%sponsor%';

-- Poll
UPDATE newsletter_sections
SET section_type = 'poll'
WHERE LOWER(name) = 'poll';

-- Breaking News
UPDATE newsletter_sections
SET section_type = 'breaking_news'
WHERE LOWER(name) LIKE '%breaking%';

-- Beyond the Feed
UPDATE newsletter_sections
SET section_type = 'beyond_the_feed'
WHERE LOWER(name) LIKE '%beyond%';

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_sections_type ON newsletter_sections(publication_id, section_type);

-- Verify the updates
SELECT
  p.name as publication_name,
  ns.name as section_name,
  ns.section_type,
  ns.display_order,
  ns.is_active
FROM newsletter_sections ns
JOIN publications p ON p.id = ns.publication_id
ORDER BY p.name, ns.display_order;
