-- Add 'paid' boolean column to advertisements table
-- This tracks whether the ad has been paid for (bypassing Stripe for now)

-- 1. Add the paid column
ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false;

-- 2. Set existing ads to paid if they have payment_status = 'paid' or 'manual'
UPDATE advertisements
SET paid = true
WHERE payment_status IN ('paid', 'manual');

-- 3. Set ads with approved/active status to paid
UPDATE advertisements
SET paid = true
WHERE status IN ('approved', 'active');

-- 4. Add comment for documentation
COMMENT ON COLUMN advertisements.paid IS 'Whether the advertisement has been paid for. True bypasses payment processing.';
