-- ============================================
-- AI APP MODULES SYSTEM MIGRATION
-- ============================================
-- Date: 2024-12-22
-- Purpose: Block-based AI app sections with configurable selection modes
-- Pattern: Follows ad_modules and poll_modules structure

-- ============================================
-- 1. AI APP BLOCK TYPES (Reference table)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_app_block_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  default_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed block types for AI Apps
INSERT INTO ai_app_block_types (name, label, description) VALUES
  ('title', 'Title', 'App name with emoji'),
  ('logo', 'Logo', 'App logo/icon image'),
  ('image', 'Image', 'App screenshot or promotional image'),
  ('tagline', 'Tagline', 'Short tagline text'),
  ('description', 'Description', 'Full app description'),
  ('button', 'Button', 'Call-to-action button/link')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. AI APP MODULES/SECTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS ai_app_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  selection_mode TEXT DEFAULT 'affiliate_priority'
    CHECK (selection_mode IN ('affiliate_priority', 'random', 'manual')),
  block_order JSONB DEFAULT '["title", "description", "button"]'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  -- Module-specific settings (migrated from publication_settings)
  apps_count INTEGER DEFAULT 6,
  max_per_category INTEGER DEFAULT 3,
  affiliate_cooldown_days INTEGER DEFAULT 7,
  next_position INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ai_app_modules
CREATE INDEX IF NOT EXISTS idx_ai_app_modules_publication
  ON ai_app_modules(publication_id);
CREATE INDEX IF NOT EXISTS idx_ai_app_modules_active
  ON ai_app_modules(publication_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_app_modules_display_order
  ON ai_app_modules(publication_id, display_order);

-- ============================================
-- 3. EXTEND ai_applications TABLE
-- ============================================
-- Add column to link apps to specific modules (NULL = available for any module)
ALTER TABLE ai_applications
ADD COLUMN IF NOT EXISTS ai_app_module_id UUID REFERENCES ai_app_modules(id) ON DELETE SET NULL;

-- Add priority field for priority-based selection within affiliate_priority mode
ALTER TABLE ai_applications
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Indexes for module queries
CREATE INDEX IF NOT EXISTS idx_ai_applications_module_id
  ON ai_applications(ai_app_module_id);
CREATE INDEX IF NOT EXISTS idx_ai_applications_module_active
  ON ai_applications(ai_app_module_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_applications_priority
  ON ai_applications(priority DESC);

-- ============================================
-- 4. ISSUE AI APP MODULES (Per-issue selections)
-- ============================================
CREATE TABLE IF NOT EXISTS issue_ai_app_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL,
  ai_app_module_id UUID NOT NULL REFERENCES ai_app_modules(id) ON DELETE CASCADE,
  app_ids JSONB DEFAULT '[]'::jsonb,  -- Array of selected app IDs for this module
  selection_mode TEXT,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  UNIQUE(issue_id, ai_app_module_id)
);

-- Indexes for issue queries
CREATE INDEX IF NOT EXISTS idx_issue_ai_app_modules_issue
  ON issue_ai_app_modules(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_ai_app_modules_module
  ON issue_ai_app_modules(ai_app_module_id);

-- ============================================
-- 5. UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_ai_app_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_ai_app_modules_updated_at ON ai_app_modules;
CREATE TRIGGER set_ai_app_modules_updated_at
  BEFORE UPDATE ON ai_app_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_app_modules_updated_at();

-- ============================================
-- 6. ENABLE RLS
-- ============================================
ALTER TABLE ai_app_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_ai_app_modules ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_app_modules (service role full access)
DROP POLICY IF EXISTS ai_app_modules_service_role ON ai_app_modules;
CREATE POLICY ai_app_modules_service_role ON ai_app_modules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for issue_ai_app_modules (service role full access)
DROP POLICY IF EXISTS issue_ai_app_modules_service_role ON issue_ai_app_modules;
CREATE POLICY issue_ai_app_modules_service_role ON issue_ai_app_modules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 7. DATA MIGRATION: Create default module per publication
-- ============================================
-- For each publication, create a default AI Apps module with migrated settings
INSERT INTO ai_app_modules (
  publication_id,
  name,
  display_order,
  is_active,
  selection_mode,
  block_order,
  apps_count,
  max_per_category,
  affiliate_cooldown_days
)
SELECT DISTINCT
  p.id,
  'AI Applications',
  10, -- Default display order
  true,
  'affiliate_priority',
  '["title", "description", "button"]'::jsonb,
  COALESCE(
    (SELECT CAST(value AS INTEGER) FROM publication_settings
     WHERE publication_id = p.id AND key = 'ai_apps_per_newsletter' LIMIT 1),
    6
  ),
  COALESCE(
    (SELECT CAST(value AS INTEGER) FROM publication_settings
     WHERE publication_id = p.id AND key = 'ai_apps_max_per_category' LIMIT 1),
    3
  ),
  COALESCE(
    (SELECT CAST(value AS INTEGER) FROM publication_settings
     WHERE publication_id = p.id AND key = 'affiliate_cooldown_days' LIMIT 1),
    7
  )
FROM publications p
WHERE NOT EXISTS (
  SELECT 1 FROM ai_app_modules WHERE publication_id = p.id
);

-- ============================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE ai_app_block_types IS 'Reference table of available block types for AI app modules';
COMMENT ON TABLE ai_app_modules IS 'Dynamic AI app sections with block ordering and selection modes';
COMMENT ON TABLE issue_ai_app_modules IS 'Tracks which apps were selected for each module per issue';

COMMENT ON COLUMN ai_app_modules.selection_mode IS 'affiliate_priority (affiliates first with cooldown), random, or manual';
COMMENT ON COLUMN ai_app_modules.block_order IS 'JSON array of block types in display order';
COMMENT ON COLUMN ai_app_modules.apps_count IS 'Number of apps to select for this module';
COMMENT ON COLUMN ai_app_modules.max_per_category IS 'Maximum apps from any single category';
COMMENT ON COLUMN ai_app_modules.affiliate_cooldown_days IS 'Days before affiliate can repeat';
COMMENT ON COLUMN ai_app_modules.next_position IS 'Position tracking for future sequential mode';
COMMENT ON COLUMN ai_applications.ai_app_module_id IS 'Links app to a module. NULL = available for any module';
COMMENT ON COLUMN ai_applications.priority IS 'Priority for affiliate_priority mode (higher = selected first)';
COMMENT ON COLUMN issue_ai_app_modules.app_ids IS 'JSON array of selected app IDs for this module';
COMMENT ON COLUMN issue_ai_app_modules.used_at IS 'Set when send-final runs - triggers cooldown';

-- ============================================
-- MIGRATION SUMMARY
-- ============================================
-- Created:
--   - ai_app_block_types table (reference)
--   - ai_app_modules table (section definitions)
--   - issue_ai_app_modules table (per-issue selections)
--   - ai_app_module_id, priority columns on ai_applications
--   - Indexes for efficient queries
--   - Updated_at trigger for ai_app_modules
--   - RLS policies for service role access
--   - Default module per publication with migrated settings
