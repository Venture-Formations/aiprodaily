-- Add override_slip column to sparkloop_recommendations
-- Used by the admin dashboard to manually override the all-time slippage rate
-- for score calculation: Score = CR x CPA x RCR x (1 - effectiveSlip/100)
ALTER TABLE sparkloop_recommendations
  ADD COLUMN IF NOT EXISTS override_slip numeric;
