-- Migration: Create Ad Modules System
-- Description: Tables for dynamic ad sections that can be created/configured via admin UI
-- Date: 2024-12-18

-- ============================================
-- 1. Block Types (seeded reference table)
-- ============================================
CREATE TABLE IF NOT EXISTS ad_block_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  default_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed block types
INSERT INTO ad_block_types (name, label, description) VALUES
  ('title', 'Title', 'Headline text for the ad'),
  ('image', 'Image', 'Featured image with optional link'),
  ('body', 'Body', 'Main content text (supports HTML)'),
  ('button', 'Button', 'Call-to-action button')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. Advertisers/Companies
-- ============================================
CREATE TABLE IF NOT EXISTS advertisers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_email TEXT,
  contact_name TEXT,
  logo_url TEXT,
  website_url TEXT,
  notes TEXT,
  last_used_date DATE,
  times_used INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for publication filtering
CREATE INDEX IF NOT EXISTS idx_advertisers_publication_id ON advertisers(publication_id);
CREATE INDEX IF NOT EXISTS idx_advertisers_is_active ON advertisers(publication_id, is_active);

-- ============================================
-- 3. Ad Modules/Sections
-- ============================================
CREATE TABLE IF NOT EXISTS ad_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  selection_mode TEXT DEFAULT 'sequential' CHECK (selection_mode IN ('sequential', 'random', 'priority', 'manual')),
  block_order JSONB DEFAULT '["title", "image", "body", "button"]',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for publication filtering and ordering
CREATE INDEX IF NOT EXISTS idx_ad_modules_publication_id ON ad_modules(publication_id);
CREATE INDEX IF NOT EXISTS idx_ad_modules_display_order ON ad_modules(publication_id, display_order);
CREATE INDEX IF NOT EXISTS idx_ad_modules_active ON ad_modules(publication_id, is_active);

-- ============================================
-- 4. Module Ads (individual advertisements)
-- ============================================
CREATE TABLE IF NOT EXISTS module_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_module_id UUID REFERENCES ad_modules(id) ON DELETE SET NULL,
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT,
  image_url TEXT,
  button_text TEXT DEFAULT 'Learn More',
  button_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  priority INTEGER DEFAULT 0,
  times_used INTEGER DEFAULT 0,
  last_used_date DATE,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ad selection queries
CREATE INDEX IF NOT EXISTS idx_module_ads_module_id ON module_ads(ad_module_id);
CREATE INDEX IF NOT EXISTS idx_module_ads_advertiser_id ON module_ads(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_module_ads_status ON module_ads(ad_module_id, status);
CREATE INDEX IF NOT EXISTS idx_module_ads_orphaned ON module_ads(ad_module_id) WHERE ad_module_id IS NULL;

-- ============================================
-- 5. Issue Module Ads (selections per issue)
-- ============================================
CREATE TABLE IF NOT EXISTS issue_module_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL,
  ad_module_id UUID NOT NULL REFERENCES ad_modules(id) ON DELETE CASCADE,
  selected_ad_id UUID REFERENCES module_ads(id) ON DELETE SET NULL,
  selection_mode TEXT,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  UNIQUE(issue_id, ad_module_id)
);

-- Indexes for issue queries
CREATE INDEX IF NOT EXISTS idx_issue_module_ads_issue_id ON issue_module_ads(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_module_ads_ad_module_id ON issue_module_ads(ad_module_id);

-- ============================================
-- 6. Add global cooldown setting if not exists
-- ============================================
-- This will be stored in publication_settings table
-- Key: 'ad_company_cooldown_days'
-- Value: '7' (default)

-- Insert default cooldown setting for existing publications (run once)
-- INSERT INTO publication_settings (publication_id, key, value)
-- SELECT id, 'ad_company_cooldown_days', '7'
-- FROM publications
-- WHERE NOT EXISTS (
--   SELECT 1 FROM publication_settings
--   WHERE publication_id = publications.id
--   AND key = 'ad_company_cooldown_days'
-- );

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE ad_block_types IS 'Reference table of available block types for ad modules';
COMMENT ON TABLE advertisers IS 'Companies/advertisers with global cooldown tracking';
COMMENT ON TABLE ad_modules IS 'Dynamic ad sections created via admin UI';
COMMENT ON TABLE module_ads IS 'Individual advertisements linked to sections and advertisers';
COMMENT ON TABLE issue_module_ads IS 'Tracks which ad was selected for each module per issue';

COMMENT ON COLUMN advertisers.last_used_date IS 'Last time ANY ad from this company appeared - used for cooldown';
COMMENT ON COLUMN ad_modules.selection_mode IS 'How ads are selected: sequential, random, priority, or manual';
COMMENT ON COLUMN ad_modules.block_order IS 'JSON array of block types in display order, e.g. ["title", "body", "image"]';
COMMENT ON COLUMN module_ads.ad_module_id IS 'NULL means orphaned (section was deleted)';
COMMENT ON COLUMN issue_module_ads.used_at IS 'Set when send-final runs - triggers cooldown';
