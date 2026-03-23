-- Add member_name and transaction_type to rss_posts
-- Populated from custom RSS feed elements (<member>, <transaction>) during ingestion
-- Flows through to module_articles for trade image matching
ALTER TABLE rss_posts ADD COLUMN IF NOT EXISTS member_name TEXT;
ALTER TABLE rss_posts ADD COLUMN IF NOT EXISTS transaction_type TEXT;
