-- ============================================
-- AFFILIATE APPS MIGRATION
-- ============================================
-- Date: 2025-01-24
-- Purpose: Add affiliate tracking and cooldown functionality

-- ============================================
-- 1. ADD is_affiliate COLUMN
-- ============================================

ALTER TABLE ai_applications
ADD COLUMN is_affiliate BOOLEAN DEFAULT false;

-- Create index for affiliate filtering
CREATE INDEX idx_ai_apps_is_affiliate ON ai_applications(is_affiliate);

-- ============================================
-- 2. ADD AFFILIATE COOLDOWN SETTING
-- ============================================

INSERT INTO app_settings (key, value, description)
VALUES ('affiliate_cooldown_days', '7', 'Days before same affiliate app can repeat in newsletters')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 3. VERIFY MIGRATION
-- ============================================

-- Check is_affiliate column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'ai_applications'
  AND column_name = 'is_affiliate';

-- Check affiliate cooldown setting added
SELECT key, value, description
FROM app_settings
WHERE key = 'affiliate_cooldown_days';

-- Check current apps and their affiliate status
SELECT id, app_name, is_affiliate, last_used_date, times_used
FROM ai_applications
ORDER BY is_affiliate DESC, app_name;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Mark existing affiliate apps: UPDATE ai_applications SET is_affiliate = true WHERE app_name IN ('App1', 'App2');
-- 3. Configure cooldown in settings UI
-- 4. Test app selection with new affiliate priority logic
