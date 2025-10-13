-- Fix CDN URLs for existing images with correct Supabase project URL
-- Run this in Supabase SQL Editor

-- First, drop the existing generated column
ALTER TABLE images DROP COLUMN IF EXISTS cdn_url;

-- Recreate with correct Supabase project URL
ALTER TABLE images ADD COLUMN cdn_url TEXT GENERATED ALWAYS AS (
  'https://ktmuicyailtbcpmworxf.supabase.co/storage/v1/object/public/images/' || object_key
) STORED;

-- Check if there are any existing images that need path fixing
UPDATE images
SET object_key = REPLACE(object_key, 'images/', '')
WHERE object_key LIKE 'images/%';

-- Verify the fix by showing all images with their new CDN URLs
SELECT id, object_key, cdn_url, created_at
FROM images
ORDER BY created_at DESC
LIMIT 5;