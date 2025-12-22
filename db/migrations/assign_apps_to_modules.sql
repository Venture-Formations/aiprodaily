-- ============================================
-- ASSIGN EXISTING APPS TO AI APP MODULES
-- ============================================
-- Date: 2024-12-22
-- Purpose: Link existing ai_applications to their publication's AI App module

-- Update all apps to link to their publication's AI App module
UPDATE ai_applications a
SET ai_app_module_id = m.id
FROM ai_app_modules m
WHERE a.publication_id = m.publication_id
  AND a.ai_app_module_id IS NULL;

-- Verify the update
-- SELECT
--   COUNT(*) as total_apps,
--   COUNT(ai_app_module_id) as apps_with_module
-- FROM ai_applications;
