-- Article Modules System Migration
-- Creates article_modules, article_module_criteria, article_module_prompts,
-- module_articles, and issue_article_modules tables for block-based article sections
-- Date: 2025-01-05

-- ============================================
-- 1. Create article_modules table
-- ============================================
CREATE TABLE IF NOT EXISTS article_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  selection_mode TEXT DEFAULT 'top_score' CHECK (selection_mode IN ('top_score', 'manual')),
  block_order JSONB DEFAULT '["source_image", "title", "body"]'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,

  -- Article-specific settings
  articles_count INTEGER DEFAULT 3,
  lookback_hours INTEGER DEFAULT 72,

  -- AI Image prompt (per-section)
  ai_image_prompt TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for article_modules
CREATE INDEX IF NOT EXISTS idx_article_modules_publication ON article_modules(publication_id);
CREATE INDEX IF NOT EXISTS idx_article_modules_active ON article_modules(publication_id, is_active);
CREATE INDEX IF NOT EXISTS idx_article_modules_display_order ON article_modules(publication_id, display_order);

-- ============================================
-- 2. Create article_module_criteria table
-- ============================================
CREATE TABLE IF NOT EXISTS article_module_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_module_id UUID NOT NULL REFERENCES article_modules(id) ON DELETE CASCADE,
  criteria_number INTEGER NOT NULL CHECK (criteria_number BETWEEN 1 AND 5),
  name TEXT NOT NULL,
  weight NUMERIC(5,4) DEFAULT 0.2000,
  ai_prompt TEXT,
  ai_model TEXT DEFAULT 'gpt-4o',
  ai_provider TEXT DEFAULT 'openai',
  temperature NUMERIC(2,1) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 500,
  expected_output TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_module_id, criteria_number)
);

-- Indexes for article_module_criteria
CREATE INDEX IF NOT EXISTS idx_article_module_criteria_module ON article_module_criteria(article_module_id);
CREATE INDEX IF NOT EXISTS idx_article_module_criteria_active ON article_module_criteria(article_module_id, is_active);

-- ============================================
-- 3. Create article_module_prompts table
-- ============================================
CREATE TABLE IF NOT EXISTS article_module_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_module_id UUID NOT NULL REFERENCES article_modules(id) ON DELETE CASCADE,
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('article_title', 'article_body')),
  ai_prompt TEXT NOT NULL,
  ai_model TEXT DEFAULT 'gpt-4o',
  ai_provider TEXT DEFAULT 'openai',
  temperature NUMERIC(2,1) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2000,
  expected_output TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_module_id, prompt_type)
);

-- Indexes for article_module_prompts
CREATE INDEX IF NOT EXISTS idx_article_module_prompts_module ON article_module_prompts(article_module_id);
CREATE INDEX IF NOT EXISTS idx_article_module_prompts_type ON article_module_prompts(article_module_id, prompt_type);

-- ============================================
-- 4. Create module_articles table (replaces articles + secondary_articles)
-- ============================================
CREATE TABLE IF NOT EXISTS module_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES rss_posts(id) ON DELETE CASCADE,
  issue_id UUID NOT NULL,
  article_module_id UUID NOT NULL REFERENCES article_modules(id) ON DELETE CASCADE,

  -- Generated content
  headline TEXT,
  content TEXT,

  -- Selection/ranking
  rank INTEGER,
  is_active BOOLEAN DEFAULT false,
  skipped BOOLEAN DEFAULT false,

  -- Quality metrics
  fact_check_score NUMERIC(3,1),
  fact_check_details TEXT,
  word_count INTEGER,

  -- Display positions
  review_position INTEGER,
  final_position INTEGER,

  -- Breaking news (if applicable)
  breaking_news_score NUMERIC(3,1),
  breaking_news_category TEXT,

  -- AI enhancements
  ai_summary TEXT,
  ai_title TEXT,
  ai_image_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, issue_id, article_module_id)
);

-- Indexes for module_articles
CREATE INDEX IF NOT EXISTS idx_module_articles_issue ON module_articles(issue_id);
CREATE INDEX IF NOT EXISTS idx_module_articles_module ON module_articles(article_module_id);
CREATE INDEX IF NOT EXISTS idx_module_articles_post ON module_articles(post_id);
CREATE INDEX IF NOT EXISTS idx_module_articles_active ON module_articles(issue_id, article_module_id, is_active);
CREATE INDEX IF NOT EXISTS idx_module_articles_issue_module ON module_articles(issue_id, article_module_id);

-- ============================================
-- 5. Create issue_article_modules table
-- ============================================
CREATE TABLE IF NOT EXISTS issue_article_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL,
  article_module_id UUID NOT NULL REFERENCES article_modules(id) ON DELETE CASCADE,
  article_ids JSONB DEFAULT '[]'::jsonb,
  selection_mode TEXT,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  UNIQUE(issue_id, article_module_id)
);

-- Indexes for issue_article_modules
CREATE INDEX IF NOT EXISTS idx_issue_article_modules_issue ON issue_article_modules(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_article_modules_module ON issue_article_modules(article_module_id);

-- ============================================
-- 6. Extend rss_feeds table with article_module_id
-- ============================================
ALTER TABLE rss_feeds
ADD COLUMN IF NOT EXISTS article_module_id UUID REFERENCES article_modules(id) ON DELETE SET NULL;

-- Index for module queries on feeds
CREATE INDEX IF NOT EXISTS idx_rss_feeds_module ON rss_feeds(article_module_id);

-- ============================================
-- 7. Extend rss_posts table with article_module_id
-- ============================================
ALTER TABLE rss_posts
ADD COLUMN IF NOT EXISTS article_module_id UUID REFERENCES article_modules(id) ON DELETE SET NULL;

-- Index for module queries on posts
CREATE INDEX IF NOT EXISTS idx_rss_posts_module ON rss_posts(article_module_id);

-- ============================================
-- 8. Updated_at triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_article_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_article_modules_updated_at ON article_modules;
CREATE TRIGGER set_article_modules_updated_at
  BEFORE UPDATE ON article_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_article_modules_updated_at();

CREATE OR REPLACE FUNCTION update_article_module_criteria_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_article_module_criteria_updated_at ON article_module_criteria;
CREATE TRIGGER set_article_module_criteria_updated_at
  BEFORE UPDATE ON article_module_criteria
  FOR EACH ROW
  EXECUTE FUNCTION update_article_module_criteria_updated_at();

CREATE OR REPLACE FUNCTION update_article_module_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_article_module_prompts_updated_at ON article_module_prompts;
CREATE TRIGGER set_article_module_prompts_updated_at
  BEFORE UPDATE ON article_module_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_article_module_prompts_updated_at();

CREATE OR REPLACE FUNCTION update_module_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_module_articles_updated_at ON module_articles;
CREATE TRIGGER set_module_articles_updated_at
  BEFORE UPDATE ON module_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_module_articles_updated_at();

-- ============================================
-- 9. Enable RLS on new tables
-- ============================================
ALTER TABLE article_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_module_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_module_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_article_modules ENABLE ROW LEVEL SECURITY;

-- RLS policies for article_modules (service role full access)
DROP POLICY IF EXISTS article_modules_service_role ON article_modules;
CREATE POLICY article_modules_service_role ON article_modules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for article_module_criteria
DROP POLICY IF EXISTS article_module_criteria_service_role ON article_module_criteria;
CREATE POLICY article_module_criteria_service_role ON article_module_criteria
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for article_module_prompts
DROP POLICY IF EXISTS article_module_prompts_service_role ON article_module_prompts;
CREATE POLICY article_module_prompts_service_role ON article_module_prompts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for module_articles
DROP POLICY IF EXISTS module_articles_service_role ON module_articles;
CREATE POLICY module_articles_service_role ON module_articles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for issue_article_modules
DROP POLICY IF EXISTS issue_article_modules_service_role ON issue_article_modules;
CREATE POLICY issue_article_modules_service_role ON issue_article_modules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 10. Comments for documentation
-- ============================================
COMMENT ON TABLE article_modules IS 'Configurable article sections with block ordering and per-section settings';
COMMENT ON TABLE article_module_criteria IS 'Scoring criteria for each article module (1-5 criteria per module)';
COMMENT ON TABLE article_module_prompts IS 'AI prompts for article title and body generation per module';
COMMENT ON TABLE module_articles IS 'Generated articles linked to article modules (replaces articles and secondary_articles)';
COMMENT ON TABLE issue_article_modules IS 'Tracks which articles are selected for each module per issue';

COMMENT ON COLUMN article_modules.selection_mode IS 'How articles are selected: top_score (auto) or manual';
COMMENT ON COLUMN article_modules.block_order IS 'JSON array of block types in display order: source_image, ai_image, title, body';
COMMENT ON COLUMN article_modules.articles_count IS 'Number of articles to select for this section (default 3)';
COMMENT ON COLUMN article_modules.lookback_hours IS 'Hours to look back for RSS posts (default 72)';
COMMENT ON COLUMN article_modules.ai_image_prompt IS 'AI prompt for generating images for articles in this section';

COMMENT ON COLUMN article_module_criteria.criteria_number IS 'Position of this criterion (1-5)';
COMMENT ON COLUMN article_module_criteria.weight IS 'Weight for this criterion in scoring (0-1, all weights should sum to 1)';
COMMENT ON COLUMN article_module_criteria.ai_prompt IS 'Full AI prompt for evaluating this criterion';

COMMENT ON COLUMN article_module_prompts.prompt_type IS 'Type of prompt: article_title or article_body';

COMMENT ON COLUMN module_articles.ai_image_url IS 'URL of AI-generated image for this article';
COMMENT ON COLUMN issue_article_modules.article_ids IS 'JSONB array of selected article IDs for this module in this issue';
COMMENT ON COLUMN issue_article_modules.used_at IS 'Set when send-final runs - triggers usage tracking';

COMMENT ON COLUMN rss_feeds.article_module_id IS 'The article module this feed is assigned to (exclusive assignment)';
COMMENT ON COLUMN rss_posts.article_module_id IS 'The article module this post is associated with (inherited from feed)';

-- ============================================
-- Summary
-- ============================================
-- Created:
--   - article_modules table (configurable article sections)
--   - article_module_criteria table (per-section scoring criteria, 1-5)
--   - article_module_prompts table (per-section title/body prompts)
--   - module_articles table (unified article storage)
--   - issue_article_modules table (per-issue article selections)
--   - article_module_id columns on rss_feeds and rss_posts
--   - Indexes for efficient queries
--   - Updated_at triggers for all new tables
--   - RLS policies for service role access
