-- Update criteria 4 weight from 1.5 to 1.0 and recalculate total scores
-- This updates all posts that have criteria 4 scores

UPDATE post_ratings
SET
  criteria_4_weight = 1.0,
  total_score =
    COALESCE(criteria_1_score * criteria_1_weight, 0) +
    COALESCE(criteria_2_score * criteria_2_weight, 0) +
    COALESCE(criteria_3_score * criteria_3_weight, 0) +
    COALESCE(criteria_4_score * 1.0, 0) +  -- New weight of 1.0
    COALESCE(criteria_5_score * criteria_5_weight, 0)
WHERE criteria_4_score IS NOT NULL
  AND criteria_4_weight IS NOT NULL;

-- Show summary of updates
SELECT
  'Updated' as status,
  COUNT(*) as total_records,
  AVG(total_score) as avg_total_score,
  MIN(total_score) as min_total_score,
  MAX(total_score) as max_total_score
FROM post_ratings
WHERE criteria_4_weight = 1.0
  AND criteria_4_score IS NOT NULL;
