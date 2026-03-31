-- Phase 4: Add module-specific fields and publication_id to archived_articles
-- CRITICAL (DBA review): archived_articles has no publication_id — cross-tenant reads possible

-- Add publication_id for tenant scoping
ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS publication_id UUID REFERENCES publications(id) ON DELETE CASCADE;

-- Add module-specific columns
ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS article_module_id UUID REFERENCES article_modules(id) ON DELETE SET NULL;
ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS ai_image_url TEXT;
ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS image_alt TEXT;
ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS trade_image_url TEXT;
ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS trade_image_alt TEXT;
ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS ticker TEXT;
ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS member_name TEXT;
ALTER TABLE archived_articles ADD COLUMN IF NOT EXISTS transaction_type TEXT;

-- Indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_archived_articles_publication ON archived_articles(publication_id);
CREATE INDEX IF NOT EXISTS idx_archived_articles_pub_date ON archived_articles(publication_id, issue_date);

-- Backfill publication_id from publication_issues
UPDATE archived_articles aa
SET publication_id = pi.publication_id
FROM publication_issues pi
WHERE aa.issue_id = pi.id
  AND aa.publication_id IS NULL;
