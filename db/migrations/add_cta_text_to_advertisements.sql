-- Add cta_text column to advertisements table
-- This provides a dedicated Call to Action text field that renders as a linked element
-- below the ad body, replacing the fragile arrow/last-sentence link injection logic.

ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS cta_text TEXT DEFAULT NULL;

COMMENT ON COLUMN advertisements.cta_text IS 'Optional CTA text rendered as a linked element below the ad body. If NULL/empty, no CTA is shown.';
