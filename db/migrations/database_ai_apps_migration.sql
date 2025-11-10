-- ============================================
-- AI APPLICATIONS DATABASE MIGRATION
-- ============================================
-- Date: 2025-10-17
-- Purpose: Update AI Applications schema for tool type and new categories

-- ============================================
-- 1. RENAME pricing TO tool_type
-- ============================================

-- Add new tool_type column
ALTER TABLE ai_applications
ADD COLUMN tool_type TEXT;

-- Copy existing pricing data to tool_type (optional - if you want to preserve data)
-- UPDATE ai_applications SET tool_type = 'Client' WHERE pricing IS NOT NULL;

-- Set default for new rows
ALTER TABLE ai_applications
ALTER COLUMN tool_type SET DEFAULT 'Client';

-- Drop old pricing column
ALTER TABLE ai_applications
DROP COLUMN pricing;

-- ============================================
-- 2. ADD CATEGORY PRIORITY FIELD
-- ============================================

-- Add priority field for category selection weighting
ALTER TABLE ai_applications
ADD COLUMN category_priority INTEGER DEFAULT 0;

-- Create index for category priority sorting
CREATE INDEX idx_ai_apps_category_priority ON ai_applications(category_priority DESC);

-- ============================================
-- 3. UPDATE EXISTING CATEGORIES (OPTIONAL)
-- ============================================

-- Map old categories to new ones if needed
-- Old: Automation, Analysis, Writing, Research, Communication, Documentation
-- New: Payroll, HR, Accounting System, Finance, Productivity, Client Management, Banking

-- Example mapping (uncomment and adjust as needed):
-- UPDATE ai_applications SET category = 'Finance' WHERE category = 'Analysis';
-- UPDATE ai_applications SET category = 'Productivity' WHERE category = 'Automation';
-- UPDATE ai_applications SET category = 'Client Management' WHERE category = 'Communication';

-- ============================================
-- 4. ADD APP SETTINGS TO app_settings TABLE
-- ============================================

-- Insert default settings for AI app selection
INSERT INTO app_settings (key, value, description)
VALUES
  ('ai_apps_per_newsletter', '6', 'Number of AI applications to show per newsletter'),
  ('ai_apps_payroll_count', '2', 'Number of Payroll apps to include per newsletter'),
  ('ai_apps_hr_count', '1', 'Number of HR apps to include per newsletter'),
  ('ai_apps_accounting_count', '2', 'Number of Accounting System apps to include per newsletter'),
  ('ai_apps_finance_count', '0', 'Number of Finance apps to include per newsletter (0 = filler)'),
  ('ai_apps_productivity_count', '0', 'Number of Productivity apps to include per newsletter (0 = filler)'),
  ('ai_apps_client_mgmt_count', '0', 'Number of Client Management apps to include per newsletter (0 = filler)'),
  ('ai_apps_banking_count', '1', 'Number of Banking apps to include per newsletter')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 5. VERIFY MIGRATION
-- ============================================

-- Check column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'ai_applications'
  AND column_name IN ('tool_type', 'category_priority');

-- Check settings added
SELECT key, value, description
FROM app_settings
WHERE key LIKE 'ai_apps_%';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Update existing app records with new categories
-- 3. Set tool_type values (Client/Firm)
-- 4. Test CSV upload with new schema
-- 5. Verify app selection works with new category counts
