-- Migration for Public Event Submission System
-- Run this in Supabase SQL Editor

-- Add pricing settings to app_settings table
-- These settings control public event submission pricing
INSERT INTO app_settings (key, value, updated_at)
VALUES
  ('public_event_paid_placement_price', '5', NOW()),
  ('public_event_featured_price', '15', NOW())
ON CONFLICT (key)
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Add columns to events table for public submission tracking
ALTER TABLE events
ADD COLUMN IF NOT EXISTS submitter_name TEXT,
ADD COLUMN IF NOT EXISTS submitter_email TEXT,
ADD COLUMN IF NOT EXISTS submitter_phone TEXT,
ADD COLUMN IF NOT EXISTS submission_status TEXT DEFAULT 'pending' CHECK (submission_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS payment_status TEXT,
ADD COLUMN IF NOT EXISTS original_image_url TEXT,
ADD COLUMN IF NOT EXISTS cropped_image_url TEXT;

-- Create index for faster queries on submission status
CREATE INDEX IF NOT EXISTS idx_events_submission_status ON events(submission_status);
CREATE INDEX IF NOT EXISTS idx_events_submitter_email ON events(submitter_email);
CREATE INDEX IF NOT EXISTS idx_events_payment_intent ON events(payment_intent_id);

-- Add comment for documentation
COMMENT ON COLUMN events.submission_status IS 'Status of public submission: pending (awaiting review), approved (accepted by admin), rejected (marked inactive by admin). NULL means internal submission.';
COMMENT ON COLUMN events.payment_intent_id IS 'Stripe Payment Intent ID for paid placement or featured event';
COMMENT ON COLUMN events.original_image_url IS 'URL of original uploaded image before cropping';
COMMENT ON COLUMN events.cropped_image_url IS 'URL of cropped image (5:4 ratio, max 900x720px)';
