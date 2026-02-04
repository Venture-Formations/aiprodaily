-- Migration: Add feedback_blocks table for block-based architecture
-- Follows the same pattern as text_box_blocks

-- ============================================
-- 1. Create feedback_blocks table
-- ============================================
CREATE TABLE IF NOT EXISTS feedback_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_module_id UUID NOT NULL REFERENCES feedback_modules(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL CHECK (block_type IN ('title', 'static_text', 'vote_options', 'team_photos')),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Title block fields
  title_text TEXT,

  -- Static text block fields (for body or sign-off)
  static_content TEXT,
  is_italic BOOLEAN DEFAULT false,
  is_bold BOOLEAN DEFAULT false,
  text_size TEXT DEFAULT 'medium' CHECK (text_size IN ('small', 'medium', 'large')),
  label TEXT, -- Optional label like "Body" or "Sign-off" for UI display

  -- Vote options block fields
  -- Format: [{value: 5, label: "Nailed it", emoji: "star"}, ...]
  vote_options JSONB,

  -- Team photos block fields
  -- Format: [{name: "John", image_url: "...", title: "Editor"}]
  team_photos JSONB,

  -- General config for future extensibility
  config JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_blocks_module ON feedback_blocks(feedback_module_id);
CREATE INDEX IF NOT EXISTS idx_feedback_blocks_order ON feedback_blocks(feedback_module_id, display_order);
CREATE INDEX IF NOT EXISTS idx_feedback_blocks_type ON feedback_blocks(block_type);

-- ============================================
-- 2. Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_feedback_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_feedback_blocks_updated_at ON feedback_blocks;
CREATE TRIGGER set_feedback_blocks_updated_at
  BEFORE UPDATE ON feedback_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_blocks_updated_at();

-- ============================================
-- 3. Enable RLS
-- ============================================
ALTER TABLE feedback_blocks ENABLE ROW LEVEL SECURITY;

-- RLS policy for service role
DROP POLICY IF EXISTS feedback_blocks_service_role ON feedback_blocks;
CREATE POLICY feedback_blocks_service_role ON feedback_blocks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. Migrate existing feedback_modules data to blocks
-- ============================================
-- This creates default blocks for existing feedback modules
DO $$
DECLARE
  mod RECORD;
  block_order_arr TEXT[];
  block_item TEXT;
  block_position INTEGER;
BEGIN
  FOR mod IN SELECT * FROM feedback_modules LOOP
    -- Parse block_order JSONB to array
    block_position := 0;

    -- Create title block
    INSERT INTO feedback_blocks (
      feedback_module_id, block_type, display_order, is_enabled,
      title_text
    ) VALUES (
      mod.id, 'title', block_position, true,
      COALESCE(mod.title_text, 'That''s it for today!')
    );
    block_position := block_position + 1;

    -- Create body static_text block
    INSERT INTO feedback_blocks (
      feedback_module_id, block_type, display_order, is_enabled,
      static_content, is_italic, label
    ) VALUES (
      mod.id, 'static_text', block_position,
      mod.body_text IS NOT NULL,
      mod.body_text,
      COALESCE(mod.body_is_italic, false),
      'Body'
    );
    block_position := block_position + 1;

    -- Create vote_options block
    INSERT INTO feedback_blocks (
      feedback_module_id, block_type, display_order, is_enabled,
      vote_options
    ) VALUES (
      mod.id, 'vote_options', block_position, true,
      COALESCE(mod.vote_options, '[{"value": 5, "label": "Nailed it", "emoji": "star"}, {"value": 3, "label": "Average", "emoji": "star"}, {"value": 1, "label": "Fail", "emoji": "star"}]'::jsonb)
    );
    block_position := block_position + 1;

    -- Create sign-off static_text block
    INSERT INTO feedback_blocks (
      feedback_module_id, block_type, display_order, is_enabled,
      static_content, is_italic, label
    ) VALUES (
      mod.id, 'static_text', block_position, true,
      COALESCE(mod.sign_off_text, 'See you tomorrow!'),
      COALESCE(mod.sign_off_is_italic, true),
      'Sign-off'
    );
    block_position := block_position + 1;

    -- Create team_photos block
    INSERT INTO feedback_blocks (
      feedback_module_id, block_type, display_order, is_enabled,
      team_photos
    ) VALUES (
      mod.id, 'team_photos', block_position,
      mod.team_photos IS NOT NULL AND mod.team_photos != '[]'::jsonb,
      COALESCE(mod.team_photos, '[]'::jsonb)
    );

  END LOOP;
END $$;

-- ============================================
-- Summary
-- ============================================
-- Created:
--   - feedback_blocks table with block types: title, static_text, vote_options, team_photos
--   - Indexes for efficient queries
--   - Updated_at trigger
--   - RLS policy
--   - Migrated existing feedback_modules content to blocks
