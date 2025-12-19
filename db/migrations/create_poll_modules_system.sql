-- Poll Modules System Migration
-- Creates poll_modules, issue_poll_modules tables and adds image_url to polls

-- ============================================
-- 1. Create poll_modules table
-- ============================================
CREATE TABLE IF NOT EXISTS poll_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  block_order JSONB DEFAULT '["title", "question", "image", "options"]'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for poll_modules
CREATE INDEX IF NOT EXISTS idx_poll_modules_publication ON poll_modules(publication_id);
CREATE INDEX IF NOT EXISTS idx_poll_modules_active ON poll_modules(publication_id, is_active);
CREATE INDEX IF NOT EXISTS idx_poll_modules_display_order ON poll_modules(publication_id, display_order);

-- ============================================
-- 2. Create issue_poll_modules table
-- ============================================
CREATE TABLE IF NOT EXISTS issue_poll_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL,
  poll_module_id UUID NOT NULL REFERENCES poll_modules(id) ON DELETE CASCADE,
  poll_id UUID REFERENCES polls(id) ON DELETE SET NULL,
  poll_snapshot JSONB,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  UNIQUE(issue_id, poll_module_id)
);

-- Indexes for issue_poll_modules
CREATE INDEX IF NOT EXISTS idx_issue_poll_modules_issue ON issue_poll_modules(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_poll_modules_module ON issue_poll_modules(poll_module_id);
CREATE INDEX IF NOT EXISTS idx_issue_poll_modules_poll ON issue_poll_modules(poll_id);

-- ============================================
-- 3. Add image_url to polls table
-- ============================================
ALTER TABLE polls ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ============================================
-- 4. Updated_at trigger for poll_modules
-- ============================================
CREATE OR REPLACE FUNCTION update_poll_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_poll_modules_updated_at ON poll_modules;
CREATE TRIGGER set_poll_modules_updated_at
  BEFORE UPDATE ON poll_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_poll_modules_updated_at();

-- ============================================
-- 5. Enable RLS on new tables
-- ============================================
ALTER TABLE poll_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_poll_modules ENABLE ROW LEVEL SECURITY;

-- RLS policies for poll_modules (service role full access)
DROP POLICY IF EXISTS poll_modules_service_role ON poll_modules;
CREATE POLICY poll_modules_service_role ON poll_modules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for issue_poll_modules (service role full access)
DROP POLICY IF EXISTS issue_poll_modules_service_role ON issue_poll_modules;
CREATE POLICY issue_poll_modules_service_role ON issue_poll_modules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Summary
-- ============================================
-- Created:
--   - poll_modules table (configurable poll sections)
--   - issue_poll_modules table (per-issue poll selections)
--   - image_url column on polls table
--   - Indexes for efficient queries
--   - Updated_at trigger for poll_modules
--   - RLS policies for service role access
