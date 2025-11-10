-- ============================================
-- ADD BREAKING NEWS & BEYOND THE FEED SECTIONS
-- ============================================
-- Created: 2025-10-13
-- Purpose: Add Breaking News and Beyond the Feed sections to newsletter_sections table

-- Get the newsletter_id for AI Accounting Daily
-- You'll need to replace 'YOUR_NEWSLETTER_ID' with the actual UUID from your newsletters table

-- Insert Breaking News section (display_order 3 - after Ad)
INSERT INTO newsletter_sections (newsletter_id, name, display_order, is_active, created_at, updated_at)
VALUES (
  (SELECT id FROM newsletters WHERE name = 'AI Accounting Daily' LIMIT 1),
  'Breaking News',
  3,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (newsletter_id, name) DO UPDATE
SET display_order = 3, is_active = true, updated_at = NOW();

-- Insert Beyond the Feed section (display_order 5 - after Apps)
INSERT INTO newsletter_sections (newsletter_id, name, display_order, is_active, created_at, updated_at)
VALUES (
  (SELECT id FROM newsletters WHERE name = 'AI Accounting Daily' LIMIT 1),
  'Beyond the Feed',
  5,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (newsletter_id, name) DO UPDATE
SET display_order = 5, is_active = true, updated_at = NOW();

-- Update display orders for existing sections to match desired order:
-- 1. Welcome/Preview (default, not in database)
-- 2. Community Business Spotlight (Ad)
-- 3. Breaking News (NEW)
-- 4. (AI Apps - managed separately, not in newsletter_sections)
-- 5. Beyond the Feed (NEW)
-- 6. AI Prompt Ideas

UPDATE newsletter_sections
SET display_order = 2, updated_at = NOW()
WHERE name = 'Community Business Spotlight'
AND newsletter_id = (SELECT id FROM newsletters WHERE name = 'AI Accounting Daily' LIMIT 1);

UPDATE newsletter_sections
SET display_order = 6, updated_at = NOW()
WHERE name = 'AI Prompt Ideas'
AND newsletter_id = (SELECT id FROM newsletters WHERE name = 'AI Accounting Daily' LIMIT 1);

-- Add comments for clarity
COMMENT ON COLUMN newsletter_sections.display_order IS 'Section order in newsletter: 1=Welcome, 2=Ad, 3=Breaking News, 4=Apps, 5=Beyond Feed, 6=AI Prompts';
