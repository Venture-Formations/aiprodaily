-- Remove NOT NULL constraints from frequency and payment fields
-- These fields are being deprecated in favor of the new ordering system

-- 1. Make frequency nullable (since we're not using it anymore)
ALTER TABLE advertisements
ALTER COLUMN frequency DROP NOT NULL;

-- 2. Make times_paid nullable
ALTER TABLE advertisements
ALTER COLUMN times_paid DROP NOT NULL;

-- 3. Make preferred_start_date nullable (already should be, but ensuring)
ALTER TABLE advertisements
ALTER COLUMN preferred_start_date DROP NOT NULL;

-- 4. Set default values for existing NULL entries
UPDATE advertisements
SET frequency = 'single'
WHERE frequency IS NULL;

UPDATE advertisements
SET times_paid = 1
WHERE times_paid IS NULL;

-- Comments for documentation
COMMENT ON COLUMN advertisements.frequency IS 'DEPRECATED: Frequency field no longer used. Kept for historical data only.';
COMMENT ON COLUMN advertisements.times_paid IS 'DEPRECATED: Times paid field no longer used. Kept for historical data only.';
COMMENT ON COLUMN advertisements.preferred_start_date IS 'DEPRECATED: Preferred start date no longer used. Kept for historical data only.';
