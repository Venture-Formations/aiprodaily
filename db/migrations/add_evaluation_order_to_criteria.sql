-- Add evaluation_order column to article_module_criteria
-- Controls the order in which criteria are evaluated during scoring.
-- Lower evaluation_order runs first, enabling early termination optimization.

ALTER TABLE article_module_criteria
  ADD COLUMN IF NOT EXISTS evaluation_order INTEGER DEFAULT 0;

-- Backfill: set evaluation_order = criteria_number for all existing rows
UPDATE article_module_criteria
  SET evaluation_order = criteria_number
  WHERE evaluation_order = 0;

-- Add index for scoring query ordering
CREATE INDEX IF NOT EXISTS idx_article_module_criteria_eval_order
  ON article_module_criteria(article_module_id, evaluation_order);

COMMENT ON COLUMN article_module_criteria.evaluation_order
  IS 'Order in which this criterion is evaluated during scoring (lower = first). Separate from criteria_number which controls storage column mapping.';
