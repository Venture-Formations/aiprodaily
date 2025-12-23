-- Prompt Modules System Migration
-- Creates prompt_modules, issue_prompt_modules tables for block-based prompt sections
-- Date: 2024-12-23

-- ============================================
-- 1. Create prompt_modules table
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  selection_mode TEXT DEFAULT 'random' CHECK (selection_mode IN ('sequential', 'random', 'priority', 'manual')),
  block_order JSONB DEFAULT '["title", "body"]'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  next_position INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for prompt_modules
CREATE INDEX IF NOT EXISTS idx_prompt_modules_publication ON prompt_modules(publication_id);
CREATE INDEX IF NOT EXISTS idx_prompt_modules_active ON prompt_modules(publication_id, is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_modules_display_order ON prompt_modules(publication_id, display_order);

-- ============================================
-- 2. Create issue_prompt_modules table
-- ============================================
CREATE TABLE IF NOT EXISTS issue_prompt_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL,
  prompt_module_id UUID NOT NULL REFERENCES prompt_modules(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompt_ideas(id) ON DELETE SET NULL,
  selection_mode TEXT,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  UNIQUE(issue_id, prompt_module_id)
);

-- Indexes for issue_prompt_modules
CREATE INDEX IF NOT EXISTS idx_issue_prompt_modules_issue ON issue_prompt_modules(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_prompt_modules_module ON issue_prompt_modules(prompt_module_id);
CREATE INDEX IF NOT EXISTS idx_issue_prompt_modules_prompt ON issue_prompt_modules(prompt_id);

-- ============================================
-- 3. Extend prompt_ideas table for module system
-- ============================================
-- Add module assignment column (NULL = available to all modules)
ALTER TABLE prompt_ideas
ADD COLUMN IF NOT EXISTS prompt_module_id UUID REFERENCES prompt_modules(id) ON DELETE SET NULL;

-- Add priority field for priority-based selection
ALTER TABLE prompt_ideas
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Index for module queries
CREATE INDEX IF NOT EXISTS idx_prompt_ideas_module ON prompt_ideas(prompt_module_id);

-- ============================================
-- 4. Updated_at trigger for prompt_modules
-- ============================================
CREATE OR REPLACE FUNCTION update_prompt_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_prompt_modules_updated_at ON prompt_modules;
CREATE TRIGGER set_prompt_modules_updated_at
  BEFORE UPDATE ON prompt_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_modules_updated_at();

-- ============================================
-- 5. Enable RLS on new tables
-- ============================================
ALTER TABLE prompt_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_prompt_modules ENABLE ROW LEVEL SECURITY;

-- RLS policies for prompt_modules (service role full access)
DROP POLICY IF EXISTS prompt_modules_service_role ON prompt_modules;
CREATE POLICY prompt_modules_service_role ON prompt_modules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for issue_prompt_modules (service role full access)
DROP POLICY IF EXISTS issue_prompt_modules_service_role ON issue_prompt_modules;
CREATE POLICY issue_prompt_modules_service_role ON issue_prompt_modules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 6. Seed default prompt module for each publication
-- ============================================
INSERT INTO prompt_modules (publication_id, name, display_order, is_active, selection_mode, block_order)
SELECT id, 'Prompt of the Day', 0, true, 'random', '["title", "body"]'::jsonb
FROM publications
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_modules WHERE prompt_modules.publication_id = publications.id
);

-- ============================================
-- 7. Comments for documentation
-- ============================================
COMMENT ON TABLE prompt_modules IS 'Configurable prompt sections with block ordering';
COMMENT ON TABLE issue_prompt_modules IS 'Tracks which prompt was selected for each module per issue';

COMMENT ON COLUMN prompt_modules.selection_mode IS 'How prompts are selected: sequential, random, priority, or manual';
COMMENT ON COLUMN prompt_modules.block_order IS 'JSON array of block types in display order: title, body';
COMMENT ON COLUMN prompt_modules.next_position IS 'Tracks the next display_order position for sequential mode';
COMMENT ON COLUMN prompt_ideas.prompt_module_id IS 'Links prompt to a module. NULL = available to all modules';
COMMENT ON COLUMN prompt_ideas.priority IS 'Priority for selection mode (higher = shown first)';
COMMENT ON COLUMN issue_prompt_modules.used_at IS 'Set when send-final runs - triggers usage tracking';

-- ============================================
-- Summary
-- ============================================
-- Created:
--   - prompt_modules table (configurable prompt sections)
--   - issue_prompt_modules table (per-issue prompt selections)
--   - prompt_module_id and priority columns on prompt_ideas
--   - Indexes for efficient queries
--   - Updated_at trigger for prompt_modules
--   - RLS policies for service role access
--   - Default "Prompt of the Day" module seeded per publication
