-- Update images table to fix CDN URL generation for correct bucket path

-- First, drop the existing generated column
ALTER TABLE images DROP COLUMN IF EXISTS cdn_url;

-- Recreate with correct bucket path
ALTER TABLE images ADD COLUMN cdn_url TEXT GENERATED ALWAYS AS (
  'https://ktmuicyailtbcpmworxf.supabase.co/storage/v1/object/public/images/' || object_key
) STORED;

-- Update any existing object_key values that have the bucket prefix
UPDATE images
SET object_key = REPLACE(object_key, 'images/', '')
WHERE object_key LIKE 'images/%';