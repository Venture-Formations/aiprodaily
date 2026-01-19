-- Add minimum score enforcement columns to article_module_criteria
-- Allows each criterion to have an optional minimum score threshold
-- Articles failing ANY enforced minimum are excluded from selection

ALTER TABLE article_module_criteria
ADD COLUMN IF NOT EXISTS enforce_minimum BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS minimum_score INTEGER CHECK (minimum_score IS NULL OR (minimum_score BETWEEN 0 AND 10));

-- Comments for documentation
COMMENT ON COLUMN article_module_criteria.enforce_minimum IS 'Whether to enforce a minimum score for this criterion';
COMMENT ON COLUMN article_module_criteria.minimum_score IS 'Minimum score (0-10) required for this criterion to pass';
