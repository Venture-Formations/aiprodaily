-- Add trade image and ticker columns to module_articles
-- for RSS feed output and ticker-based deduplication

ALTER TABLE module_articles
  ADD COLUMN IF NOT EXISTS trade_image_url TEXT,
  ADD COLUMN IF NOT EXISTS trade_image_alt TEXT,
  ADD COLUMN IF NOT EXISTS ticker TEXT;
