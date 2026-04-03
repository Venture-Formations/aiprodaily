-- Add image_url column to congress_trades and congress_trades_staged
-- Stores the public URL of the auto-generated trade card image

ALTER TABLE congress_trades ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE congress_trades_staged ADD COLUMN IF NOT EXISTS image_url TEXT;
