-- Add multi-criteria columns to post_ratings table
-- This table stores AI evaluation scores for RSS posts

ALTER TABLE post_ratings
ADD COLUMN IF NOT EXISTS criteria_1_score INTEGER CHECK (criteria_1_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS criteria_1_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_1_weight DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS criteria_2_score INTEGER CHECK (criteria_2_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS criteria_2_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_2_weight DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS criteria_3_score INTEGER CHECK (criteria_3_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS criteria_3_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_3_weight DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS criteria_4_score INTEGER CHECK (criteria_4_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS criteria_4_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_4_weight DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS criteria_5_score INTEGER CHECK (criteria_5_score BETWEEN 0 AND 10),
ADD COLUMN IF NOT EXISTS criteria_5_reason TEXT,
ADD COLUMN IF NOT EXISTS criteria_5_weight DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS total_score DECIMAL(10,2);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_ratings_total_score ON post_ratings(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_post_ratings_post_id_score ON post_ratings(post_id, total_score DESC);

-- Comments for documentation
COMMENT ON COLUMN post_ratings.criteria_1_score IS 'Score 0-10 for first evaluation criteria';
COMMENT ON COLUMN post_ratings.criteria_1_reason IS 'AI reasoning for criteria 1 score';
COMMENT ON COLUMN post_ratings.criteria_1_weight IS 'Weight multiplier for criteria 1';
COMMENT ON COLUMN post_ratings.total_score IS 'Weighted normalized score 0-100: (sum of score×weight) / (sum of weight×10) × 100';
