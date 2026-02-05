-- Migration: Add layout settings to ai_app_modules for Product Cards
-- Adds configurable layout options: layout mode, logo style, title size, description size

-- Add layout_mode column (stacked vs inline)
ALTER TABLE ai_app_modules
ADD COLUMN IF NOT EXISTS layout_mode TEXT DEFAULT 'inline';

-- Add logo_style column (round vs square)
ALTER TABLE ai_app_modules
ADD COLUMN IF NOT EXISTS logo_style TEXT DEFAULT 'square';

-- Add title_size column
ALTER TABLE ai_app_modules
ADD COLUMN IF NOT EXISTS title_size TEXT DEFAULT 'medium';

-- Add description_size column
ALTER TABLE ai_app_modules
ADD COLUMN IF NOT EXISTS description_size TEXT DEFAULT 'medium';

-- Add constraints for valid values
DO $$
BEGIN
  -- layout_mode constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_app_modules_layout_mode_check'
  ) THEN
    ALTER TABLE ai_app_modules
    ADD CONSTRAINT ai_app_modules_layout_mode_check
    CHECK (layout_mode IN ('stacked', 'inline'));
  END IF;

  -- logo_style constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_app_modules_logo_style_check'
  ) THEN
    ALTER TABLE ai_app_modules
    ADD CONSTRAINT ai_app_modules_logo_style_check
    CHECK (logo_style IN ('round', 'square'));
  END IF;

  -- title_size constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_app_modules_title_size_check'
  ) THEN
    ALTER TABLE ai_app_modules
    ADD CONSTRAINT ai_app_modules_title_size_check
    CHECK (title_size IN ('small', 'medium', 'large'));
  END IF;

  -- description_size constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_app_modules_description_size_check'
  ) THEN
    ALTER TABLE ai_app_modules
    ADD CONSTRAINT ai_app_modules_description_size_check
    CHECK (description_size IN ('small', 'medium', 'large'));
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN ai_app_modules.layout_mode IS 'Layout mode: stacked (title above description) or inline (title with description on same line)';
COMMENT ON COLUMN ai_app_modules.logo_style IS 'Logo display style: round (circular) or square (rounded corners)';
COMMENT ON COLUMN ai_app_modules.title_size IS 'Title font size: small (14px), medium (16px), large (18px)';
COMMENT ON COLUMN ai_app_modules.description_size IS 'Description font size: small (12px), medium (14px), large (16px)';
