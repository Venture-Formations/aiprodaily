-- Add deduplication configuration settings to app_settings

-- Setting 1: Historical lookback days (how many days of sent newsletters to check against)
INSERT INTO app_settings (key, value, description, updated_at)
VALUES (
  'dedup_historical_lookback_days',
  '3',
  'Number of days of sent newsletters to check for duplicate articles (prevents same story appearing multiple times)',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;

-- Setting 2: Deduplication strictness threshold (applies to all similarity checks)
INSERT INTO app_settings (key, value, description, updated_at)
VALUES (
  'dedup_strictness_threshold',
  '0.80',
  'Similarity threshold for all deduplication checks (0.0-1.0). Lower = more strict. Default 0.80 means 80% similar triggers duplicate.',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;

-- Add comment
COMMENT ON COLUMN app_settings.value IS 'Configuration value - can be string, number, or JSON. Parse based on key.';
