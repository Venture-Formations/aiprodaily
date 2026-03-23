-- Add member_name and transaction_type to module_articles
-- Populated from congress_trades at article creation time via ticker lookup
-- Used for direct image matching against article_images table
ALTER TABLE module_articles ADD COLUMN IF NOT EXISTS member_name TEXT;
ALTER TABLE module_articles ADD COLUMN IF NOT EXISTS transaction_type TEXT;
