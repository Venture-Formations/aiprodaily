-- Migration: Add submission and sponsorship fields to ai_applications table
-- This extends ai_applications to support the tools directory submission workflow

-- Submission info
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS submitter_email TEXT;
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS submitter_name TEXT;
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS submitter_image_url TEXT;

-- Status and moderation
-- Note: We already have is_active for approved/active state
-- Adding a status field for more granular control
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS submission_status TEXT DEFAULT 'pending' CHECK (submission_status IN ('pending', 'approved', 'rejected', 'edited'));
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Sponsorship/Payment
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'monthly', 'yearly'));
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS sponsor_start_date TIMESTAMPTZ;
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS sponsor_end_date TIMESTAMPTZ;

-- Analytics
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_applications_clerk_user_id ON ai_applications(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_applications_submission_status ON ai_applications(submission_status);
CREATE INDEX IF NOT EXISTS idx_ai_applications_submitter_email ON ai_applications(submitter_email);

-- Update existing records to have 'approved' status if they are active
UPDATE ai_applications
SET submission_status = 'approved'
WHERE is_active = true AND submission_status = 'pending';

COMMENT ON COLUMN ai_applications.clerk_user_id IS 'Clerk user ID of the submitter';
COMMENT ON COLUMN ai_applications.submitter_email IS 'Contact email for the tool submission';
COMMENT ON COLUMN ai_applications.submitter_name IS 'Name of the person who submitted the tool';
COMMENT ON COLUMN ai_applications.submitter_image_url IS 'Avatar/profile image URL of the submitter';
COMMENT ON COLUMN ai_applications.submission_status IS 'Status of the submission: pending, approved, rejected, edited';
COMMENT ON COLUMN ai_applications.rejection_reason IS 'Reason for rejection if status is rejected';
COMMENT ON COLUMN ai_applications.approved_by IS 'User ID of the admin who approved the submission';
COMMENT ON COLUMN ai_applications.approved_at IS 'Timestamp when the submission was approved';
COMMENT ON COLUMN ai_applications.plan IS 'Listing plan: free, monthly, yearly';
COMMENT ON COLUMN ai_applications.stripe_payment_id IS 'Stripe payment intent ID';
COMMENT ON COLUMN ai_applications.stripe_subscription_id IS 'Stripe subscription ID for recurring plans';
COMMENT ON COLUMN ai_applications.stripe_customer_id IS 'Stripe customer ID';
COMMENT ON COLUMN ai_applications.sponsor_start_date IS 'Start date of paid sponsorship';
COMMENT ON COLUMN ai_applications.sponsor_end_date IS 'End date of paid sponsorship';
COMMENT ON COLUMN ai_applications.view_count IS 'Number of times the tool detail page was viewed';
COMMENT ON COLUMN ai_applications.click_count IS 'Number of times the tool website link was clicked';
