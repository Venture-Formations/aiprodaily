-- Add image_url field to advertisements table
ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment
COMMENT ON COLUMN advertisements.image_url IS 'Optional cropped image URL (5:4 ratio) for the advertisement';
