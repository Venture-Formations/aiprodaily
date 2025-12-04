-- ============================================
-- Add Stripe Subscription Tracking Fields
-- Migration: add_stripe_subscription_fields
-- Date: 2025-12-03
-- ============================================

-- Add stripe_subscription_id to track the Stripe subscription
ALTER TABLE tools_directory
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Add stripe_customer_id to link to Stripe customer
ALTER TABLE tools_directory
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add index for subscription lookups (used by webhooks)
CREATE INDEX IF NOT EXISTS idx_tools_directory_stripe_subscription
ON tools_directory(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;

-- Add index for customer lookups
CREATE INDEX IF NOT EXISTS idx_tools_directory_stripe_customer
ON tools_directory(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;
