-- SparkLoop Recommendation Newsletter Modules
-- Adds a module system for showing SparkLoop recommendations in the newsletter email body

-- 1a. Add eligible_for_module column to sparkloop_recommendations
ALTER TABLE sparkloop_recommendations
  ADD COLUMN IF NOT EXISTS eligible_for_module BOOLEAN DEFAULT false;

-- Partial index for efficient module-eligible queries
CREATE INDEX IF NOT EXISTS idx_sparkloop_recs_module_eligible
  ON sparkloop_recommendations (publication_id, eligible_for_module)
  WHERE eligible_for_module = true AND status = 'active' AND (excluded = false OR excluded IS NULL);

-- 1b. Create sparkloop_rec_modules table (module config)
CREATE TABLE IF NOT EXISTS sparkloop_rec_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Recommended Newsletters',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  selection_mode TEXT NOT NULL DEFAULT 'score_based'
    CHECK (selection_mode IN ('score_based', 'random', 'sequential', 'manual')),
  block_order JSONB DEFAULT '["logo", "name", "description", "button"]'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  recs_count INTEGER DEFAULT 3,
  next_position INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Updated_at trigger
CREATE OR REPLACE TRIGGER set_sparkloop_rec_modules_updated_at
  BEFORE UPDATE ON sparkloop_rec_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 1c. Create issue_sparkloop_rec_modules table (per-issue selections)
-- Note: issue_id is TEXT to match publication_issues.id
CREATE TABLE IF NOT EXISTS issue_sparkloop_rec_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id TEXT NOT NULL REFERENCES publication_issues(id) ON DELETE CASCADE,
  sparkloop_rec_module_id UUID NOT NULL REFERENCES sparkloop_rec_modules(id) ON DELETE CASCADE,
  ref_codes JSONB DEFAULT '[]'::jsonb,
  selection_mode TEXT,
  selected_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ,
  UNIQUE(issue_id, sparkloop_rec_module_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sparkloop_rec_modules_pub
  ON sparkloop_rec_modules (publication_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_issue_sl_rec_modules_issue
  ON issue_sparkloop_rec_modules (issue_id);

CREATE INDEX IF NOT EXISTS idx_issue_sl_rec_modules_module
  ON issue_sparkloop_rec_modules (sparkloop_rec_module_id);

-- 1d. Add sparkloop_recommendations to section_type enum
ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'sparkloop_recommendations';

-- 1e. Seed defaults - publication settings
INSERT INTO publication_settings (publication_id, key, value)
VALUES
  ('eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf', 'sparkloop_module_section_name', 'Recommended Newsletters'),
  ('eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf', 'sparkloop_module_count', '3'),
  ('eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf', 'sparkloop_module_selection_mode', 'score_based')
ON CONFLICT (publication_id, key) DO NOTHING;

-- Seed default module for AI Pros Daily
INSERT INTO sparkloop_rec_modules (publication_id, name, display_order, is_active, selection_mode, recs_count)
VALUES ('eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf', 'Recommended Newsletters', 50, true, 'score_based', 3);

-- 1f. RLS policies
ALTER TABLE sparkloop_rec_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_sparkloop_rec_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on sparkloop_rec_modules"
  ON sparkloop_rec_modules FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on issue_sparkloop_rec_modules"
  ON issue_sparkloop_rec_modules FOR ALL
  USING (true) WITH CHECK (true);
