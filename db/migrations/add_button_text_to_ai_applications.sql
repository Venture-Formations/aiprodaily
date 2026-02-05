-- Migration: Add button_text to ai_applications for custom button labels
-- This allows each product to have its own custom button text

ALTER TABLE ai_applications
ADD COLUMN IF NOT EXISTS button_text TEXT DEFAULT NULL;

COMMENT ON COLUMN ai_applications.button_text IS 'Custom button text for this product. NULL uses module default.';
