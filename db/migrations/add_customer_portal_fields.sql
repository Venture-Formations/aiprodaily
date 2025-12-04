-- Migration: Add Customer Portal Fields
-- Date: 2024-12-03
-- Description: Add fields to support customer self-service portal for managing
--              directory listings and newsletter advertisements

-- =============================================================================
-- 1. Add clerk_user_id to tools_directory
-- =============================================================================

-- Add clerk_user_id column to link tools to customer accounts
ALTER TABLE tools_directory 
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

-- Create index for fast customer lookups
CREATE INDEX IF NOT EXISTS idx_tools_directory_clerk_user_id 
  ON tools_directory(clerk_user_id);

-- Add comment for documentation
COMMENT ON COLUMN tools_directory.clerk_user_id IS 
  'Clerk user ID linking this tool to a customer account';

-- =============================================================================
-- 2. Add customer portal fields to advertisements
-- =============================================================================

-- Add clerk_user_id to link ads to customer accounts
ALTER TABLE advertisements 
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

-- Add company_name for advertiser identification
ALTER TABLE advertisements 
  ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Add ad_type to distinguish between different ad placements
-- Current types: 'main_sponsor' (newsletter advertorial)
-- Future types: 'sidebar', 'footer', 'featured_profile', etc.
ALTER TABLE advertisements 
  ADD COLUMN IF NOT EXISTS ad_type TEXT DEFAULT 'main_sponsor';

-- Add preview_image_url for admin-created preview that customer approves
ALTER TABLE advertisements 
  ADD COLUMN IF NOT EXISTS preview_image_url TEXT;

-- Create index for customer lookups
CREATE INDEX IF NOT EXISTS idx_advertisements_clerk_user_id 
  ON advertisements(clerk_user_id);

-- Create index for ad type filtering
CREATE INDEX IF NOT EXISTS idx_advertisements_ad_type 
  ON advertisements(ad_type);

-- Add comments for documentation
COMMENT ON COLUMN advertisements.clerk_user_id IS 
  'Clerk user ID linking this ad to a customer account';
COMMENT ON COLUMN advertisements.company_name IS 
  'Company or product name of the advertiser';
COMMENT ON COLUMN advertisements.ad_type IS 
  'Type of ad placement: main_sponsor, sidebar, footer, etc.';
COMMENT ON COLUMN advertisements.preview_image_url IS 
  'URL to admin-created preview image for customer approval';

-- =============================================================================
-- 3. Note on status values
-- =============================================================================
-- The existing 'status' column already supports most workflow states.
-- We will use these statuses for customer portal workflow:
--
-- Customer submits:     'pending_review'
-- Admin working:        'pending_review' (or add 'in_progress' if needed)
-- Ready for approval:   'approved' with preview_image_url set (customer checks portal)
-- Customer approved:    'active' 
-- Sent:                 'completed'
-- Rejected:             'rejected'
--
-- If 'in_progress' and 'awaiting_approval' statuses are needed, 
-- run this (only if status is an enum):
-- ALTER TYPE ad_status ADD VALUE IF NOT EXISTS 'in_progress';
-- ALTER TYPE ad_status ADD VALUE IF NOT EXISTS 'awaiting_approval';

