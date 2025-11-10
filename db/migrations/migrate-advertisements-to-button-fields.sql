-- Migration: Update advertisements table to use button_text and button_url
-- Date: 2025-01-06
-- Description: Remove old business contact fields and add button fields for advertorials

-- Add new button fields (temporarily nullable)
ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS button_text TEXT,
ADD COLUMN IF NOT EXISTS button_url TEXT;

-- Drop old business contact fields
ALTER TABLE advertisements
DROP COLUMN IF EXISTS business_name,
DROP COLUMN IF EXISTS contact_name,
DROP COLUMN IF EXISTS contact_email,
DROP COLUMN IF EXISTS contact_phone,
DROP COLUMN IF EXISTS business_address,
DROP COLUMN IF EXISTS business_website;

-- Make button fields required (NOT NULL)
ALTER TABLE advertisements
ALTER COLUMN button_text SET NOT NULL,
ALTER COLUMN button_url SET NOT NULL;

-- Update newsletter_sections table to rename section
UPDATE newsletter_sections
SET name = 'Advertorial'
WHERE name = 'Community Business Spotlight';

-- Note: Since there are no existing ads in the database according to the user,
-- we don't need to handle data migration.
