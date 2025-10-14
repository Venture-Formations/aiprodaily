-- Multi-Criteria Scoring System Migration
-- This migration adds support for 1-5 customizable scoring criteria
-- Each criteria has: score (0-10), reason (text), and system tracks enabled count

-- Add criteria scoring columns to rss_posts table
ALTER TABLE rss_posts
ADD COLUMN IF NOT EXISTS criteria_1_score INTEGER CHECK (criteria_1_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS criteria_1_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_2_score INTEGER CHECK (criteria_2_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS criteria_2_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_3_score INTEGER CHECK (criteria_3_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS criteria_3_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_4_score INTEGER CHECK (criteria_4_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS criteria_4_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_5_score INTEGER CHECK (criteria_5_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS criteria_5_reason TEXT,
ADD COLUMN IF NOT EXISTS final_priority_score DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS criteria_enabled INTEGER DEFAULT 3 CHECK (criteria_enabled BETWEEN 1 AND 5);

-- Add criteria scoring columns to archived_rss_posts table (for historical data)
ALTER TABLE archived_rss_posts
ADD COLUMN IF NOT EXISTS criteria_1_score INTEGER,
ADD COLUMN IF NOT EXISTS criteria_1_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_2_score INTEGER,
ADD COLUMN IF NOT EXISTS criteria_2_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_3_score INTEGER,
ADD COLUMN IF NOT EXISTS criteria_3_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_4_score INTEGER,
ADD COLUMN IF NOT EXISTS criteria_4_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_5_score INTEGER,
ADD COLUMN IF NOT EXISTS criteria_5_reason TEXT,
ADD COLUMN IF NOT EXISTS final_priority_score DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS criteria_enabled INTEGER;

-- Add index on final_priority_score for faster sorting
CREATE INDEX IF NOT EXISTS idx_rss_posts_final_priority_score ON rss_posts(final_priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_rss_posts_campaign_priority ON rss_posts(campaign_id, final_priority_score DESC);

-- Comments for documentation
COMMENT ON COLUMN rss_posts.criteria_1_score IS 'Score 0-10 for first evaluation criteria';
COMMENT ON COLUMN rss_posts.criteria_1_reason IS 'AI reasoning for criteria 1 score';
COMMENT ON COLUMN rss_posts.final_priority_score IS 'Weighted sum: (criteria_1_score × weight_1) + (criteria_2_score × weight_2) + ...';
COMMENT ON COLUMN rss_posts.criteria_enabled IS 'Number of criteria currently enabled (1-5)';

-- Verification query
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'rss_posts'
  AND column_name LIKE 'criteria_%'
ORDER BY column_name;
