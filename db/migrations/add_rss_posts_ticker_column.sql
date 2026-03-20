-- Add ticker column to rss_posts for company-level dedup
-- Populated from combined feed's custom RSS extensions during ingestion

ALTER TABLE rss_posts ADD COLUMN IF NOT EXISTS ticker TEXT;
