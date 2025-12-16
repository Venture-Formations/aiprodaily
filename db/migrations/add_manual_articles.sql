-- Migration: Add manual articles system
-- Created: 2024-12-16
-- Description: Creates tables for manual article management with category support

-- Create article_categories table
CREATE TABLE IF NOT EXISTS article_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID REFERENCES publications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publication_id, slug)
);

-- Create manual_articles table
CREATE TABLE IF NOT EXISTS manual_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID REFERENCES publications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  section_type TEXT NOT NULL CHECK (section_type IN ('primary_articles', 'secondary_articles')),
  category_id UUID REFERENCES article_categories(id) ON DELETE SET NULL,
  publish_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'used')),
  used_in_issue_id TEXT REFERENCES publication_issues(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publication_id, slug)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_manual_articles_publication_id ON manual_articles(publication_id);
CREATE INDEX IF NOT EXISTS idx_manual_articles_status ON manual_articles(status);
CREATE INDEX IF NOT EXISTS idx_manual_articles_section_type ON manual_articles(section_type);
CREATE INDEX IF NOT EXISTS idx_manual_articles_publish_date ON manual_articles(publish_date);
CREATE INDEX IF NOT EXISTS idx_article_categories_publication_id ON article_categories(publication_id);

-- Enable RLS
ALTER TABLE article_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_articles ENABLE ROW LEVEL SECURITY;

-- RLS policies for article_categories
CREATE POLICY "Enable read access for all users" ON article_categories
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON article_categories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON article_categories
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON article_categories
  FOR DELETE USING (true);

-- RLS policies for manual_articles
CREATE POLICY "Enable read access for all users" ON manual_articles
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON manual_articles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON manual_articles
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON manual_articles
  FOR DELETE USING (true);

-- Add comment descriptions
COMMENT ON TABLE article_categories IS 'Categories for manual articles';
COMMENT ON TABLE manual_articles IS 'Manually created articles that can be used in newsletters';
COMMENT ON COLUMN manual_articles.section_type IS 'Which newsletter section this article belongs to: primary_articles or secondary_articles';
COMMENT ON COLUMN manual_articles.status IS 'Article status: draft (not ready), published (ready to use), used (already sent in newsletter)';
