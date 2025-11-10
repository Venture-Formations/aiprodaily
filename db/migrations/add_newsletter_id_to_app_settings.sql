-- Migration: Add newsletter_id to app_settings table
-- Purpose: Enable multi-tenant settings where each newsletter has its own configuration
-- Date: 2025-11-05

-- Step 1: Add newsletter_id column (nullable initially)
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS newsletter_id UUID REFERENCES newsletters(id);

-- Step 2: Get the first active newsletter to use as default
-- (You'll need to replace this with the correct newsletter_id)
DO $$
DECLARE
  default_newsletter_id UUID;
BEGIN
  -- Get the first active newsletter
  SELECT id INTO default_newsletter_id
  FROM newsletters
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no active newsletter found, use the first newsletter
  IF default_newsletter_id IS NULL THEN
    SELECT id INTO default_newsletter_id
    FROM newsletters
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Update existing settings to belong to the default newsletter
  IF default_newsletter_id IS NOT NULL THEN
    UPDATE app_settings
    SET newsletter_id = default_newsletter_id
    WHERE newsletter_id IS NULL;

    RAISE NOTICE 'Updated all existing app_settings to newsletter_id: %', default_newsletter_id;
  ELSE
    RAISE NOTICE 'No newsletters found! You need to create a newsletter first.';
  END IF;
END $$;

-- Step 3: Make newsletter_id NOT NULL
ALTER TABLE app_settings
  ALTER COLUMN newsletter_id SET NOT NULL;

-- Step 4: Drop old unique constraint on key
ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_key_key;

-- Step 5: Create new composite unique constraint (newsletter_id + key)
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_newsletter_key
  ON app_settings(newsletter_id, key);

-- Step 6: Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_app_settings_newsletter_id
  ON app_settings(newsletter_id);

-- Step 7: Add comment
COMMENT ON COLUMN app_settings.newsletter_id IS 'Newsletter this setting belongs to (multi-tenant isolation)';

-- Verification query (run this after migration)
-- SELECT
--   n.name as newsletter_name,
--   COUNT(s.*) as settings_count
-- FROM newsletters n
-- LEFT JOIN app_settings s ON s.newsletter_id = n.id
-- GROUP BY n.id, n.name
-- ORDER BY n.name;
