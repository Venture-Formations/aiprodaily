-- ============================================
-- ADD TRACKING COLUMNS TO SENDGRID FIELD UPDATES
-- ============================================
-- Adds issue_id and link_click_id columns to match the
-- mailerlite_field_updates schema. These columns allow
-- tracking which issue/click triggered the field update.
-- ============================================

-- Add issue_id column (optional: link to issue for debugging)
ALTER TABLE sendgrid_field_updates
ADD COLUMN IF NOT EXISTS issue_id UUID;

-- Add link_click_id column (optional: reference to original click)
ALTER TABLE sendgrid_field_updates
ADD COLUMN IF NOT EXISTS link_click_id UUID;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_sendgrid_updates_issue
  ON sendgrid_field_updates(issue_id);

CREATE INDEX IF NOT EXISTS idx_sendgrid_updates_click
  ON sendgrid_field_updates(link_click_id);

-- Add comments for documentation
COMMENT ON COLUMN sendgrid_field_updates.issue_id IS 'Optional: link to publication issue for debugging';
COMMENT ON COLUMN sendgrid_field_updates.link_click_id IS 'Optional: reference to the link click that triggered this update';
