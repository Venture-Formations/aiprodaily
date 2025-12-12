-- Migration: Create sponsorship packages and customer entitlements tables
-- This enables custom sponsorship packages that bundle newsletter ads with featured listings

-- ============================================
-- 1. Sponsorship Packages Table
-- ============================================
-- Defines the packages that admins can create and sell

CREATE TABLE IF NOT EXISTS sponsorship_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,

  -- Package Info
  name TEXT NOT NULL,
  description TEXT,

  -- Included Benefits
  newsletter_ad_spots INTEGER NOT NULL DEFAULT 0,  -- Number of newsletter ad placements included
  featured_listing_included BOOLEAN NOT NULL DEFAULT FALSE,
  featured_listing_months INTEGER DEFAULT 0,  -- Duration of featured listing if included

  -- Pricing
  price_monthly INTEGER,  -- Price in dollars (NULL if not available monthly)
  price_yearly INTEGER,   -- Price in dollars (NULL if not available yearly)

  -- Stripe Integration
  stripe_product_id TEXT,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,

  -- Display & Status
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,  -- Highlight this package in UI

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_publication
  ON sponsorship_packages(publication_id);

CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_active
  ON sponsorship_packages(publication_id, is_active);

-- Comments
COMMENT ON TABLE sponsorship_packages IS
  'Defines sponsorship packages that bundle newsletter ads with featured listings';

COMMENT ON COLUMN sponsorship_packages.newsletter_ad_spots IS
  'Number of newsletter ad placements included in this package';

COMMENT ON COLUMN sponsorship_packages.featured_listing_included IS
  'Whether this package includes a featured listing in the tools directory';

COMMENT ON COLUMN sponsorship_packages.featured_listing_months IS
  'Duration in months for the featured listing (if included)';

COMMENT ON COLUMN sponsorship_packages.price_monthly IS
  'Monthly subscription price in dollars. NULL if only yearly is available.';

COMMENT ON COLUMN sponsorship_packages.price_yearly IS
  'Yearly subscription price in dollars. NULL if only monthly is available.';


-- ============================================
-- 2. Customer Entitlements Table
-- ============================================
-- Tracks what each customer has access to (ad spots, featured listings, etc.)

CREATE TABLE IF NOT EXISTS customer_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,  -- Links to customer account

  -- Source of entitlement
  package_id UUID REFERENCES sponsorship_packages(id) ON DELETE SET NULL,  -- NULL for manual grants

  -- Entitlement Details
  entitlement_type TEXT NOT NULL CHECK (entitlement_type IN ('newsletter_ad', 'featured_listing')),
  quantity_total INTEGER NOT NULL DEFAULT 1,  -- Total granted
  quantity_used INTEGER NOT NULL DEFAULT 0,   -- How many have been used

  -- Validity Period
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,  -- NULL for non-expiring

  -- Stripe Integration
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'paused')),

  -- Admin/Audit
  notes TEXT,  -- Admin notes for manual grants or special arrangements
  granted_by TEXT,  -- Clerk user ID of admin who granted (for manual grants)

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_entitlements_publication
  ON customer_entitlements(publication_id);

CREATE INDEX IF NOT EXISTS idx_customer_entitlements_user
  ON customer_entitlements(clerk_user_id);

CREATE INDEX IF NOT EXISTS idx_customer_entitlements_package
  ON customer_entitlements(package_id);

CREATE INDEX IF NOT EXISTS idx_customer_entitlements_status
  ON customer_entitlements(publication_id, clerk_user_id, status);

CREATE INDEX IF NOT EXISTS idx_customer_entitlements_type
  ON customer_entitlements(publication_id, clerk_user_id, entitlement_type, status);

-- Comments
COMMENT ON TABLE customer_entitlements IS
  'Tracks customer entitlements for newsletter ads, featured listings, etc.';

COMMENT ON COLUMN customer_entitlements.package_id IS
  'Reference to the package this entitlement came from. NULL for manual grants.';

COMMENT ON COLUMN customer_entitlements.entitlement_type IS
  'Type of entitlement: newsletter_ad (ad spots) or featured_listing (directory feature)';

COMMENT ON COLUMN customer_entitlements.quantity_total IS
  'Total quantity granted (e.g., 5 ad spots)';

COMMENT ON COLUMN customer_entitlements.quantity_used IS
  'Quantity used so far (e.g., 2 of 5 ad spots used)';

COMMENT ON COLUMN customer_entitlements.valid_until IS
  'Expiration date. NULL means no expiration.';

COMMENT ON COLUMN customer_entitlements.granted_by IS
  'Clerk user ID of admin who manually granted this entitlement';


-- ============================================
-- 3. Helper Functions
-- ============================================

-- Function to get remaining entitlements for a user
CREATE OR REPLACE FUNCTION get_remaining_entitlements(
  p_publication_id UUID,
  p_clerk_user_id TEXT,
  p_entitlement_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT COALESCE(SUM(quantity_total - quantity_used), 0)
  INTO remaining
  FROM customer_entitlements
  WHERE publication_id = p_publication_id
    AND clerk_user_id = p_clerk_user_id
    AND entitlement_type = p_entitlement_type
    AND status = 'active'
    AND (valid_until IS NULL OR valid_until > NOW());

  RETURN remaining;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_remaining_entitlements IS
  'Returns the total remaining entitlements of a specific type for a user';


-- Function to use an entitlement (decrements quantity_used)
CREATE OR REPLACE FUNCTION use_entitlement(
  p_publication_id UUID,
  p_clerk_user_id TEXT,
  p_entitlement_type TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  entitlement_record RECORD;
  remaining_to_use INTEGER;
BEGIN
  remaining_to_use := p_quantity;

  -- Loop through active entitlements with available quantity, oldest first
  FOR entitlement_record IN
    SELECT id, quantity_total, quantity_used
    FROM customer_entitlements
    WHERE publication_id = p_publication_id
      AND clerk_user_id = p_clerk_user_id
      AND entitlement_type = p_entitlement_type
      AND status = 'active'
      AND (valid_until IS NULL OR valid_until > NOW())
      AND quantity_used < quantity_total
    ORDER BY valid_until NULLS LAST, created_at ASC
  LOOP
    -- Calculate how much we can use from this entitlement
    DECLARE
      available INTEGER;
      to_use INTEGER;
    BEGIN
      available := entitlement_record.quantity_total - entitlement_record.quantity_used;
      to_use := LEAST(available, remaining_to_use);

      -- Update the entitlement
      UPDATE customer_entitlements
      SET quantity_used = quantity_used + to_use,
          updated_at = NOW()
      WHERE id = entitlement_record.id;

      remaining_to_use := remaining_to_use - to_use;

      -- If we've used all we need, exit
      IF remaining_to_use <= 0 THEN
        RETURN TRUE;
      END IF;
    END;
  END LOOP;

  -- If we still have remaining_to_use > 0, we didn't have enough entitlements
  RETURN remaining_to_use <= 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION use_entitlement IS
  'Decrements entitlement quantity. Returns TRUE if successful, FALSE if insufficient entitlements.';


-- ============================================
-- 4. Seed Default Packages (Optional)
-- ============================================
-- Uncomment and modify to create default packages for your publication

-- INSERT INTO sponsorship_packages (
--   publication_id,
--   name,
--   description,
--   newsletter_ad_spots,
--   featured_listing_included,
--   featured_listing_months,
--   price_monthly,
--   display_order,
--   is_featured
-- ) VALUES
-- (
--   'your-publication-id-here',
--   'Starter',
--   'Get your tool listed with 2 newsletter features',
--   2,
--   false,
--   0,
--   49,
--   1,
--   false
-- ),
-- (
--   'your-publication-id-here',
--   'Professional',
--   'Featured listing + 4 newsletter ad spots per month',
--   4,
--   true,
--   1,
--   149,
--   2,
--   true
-- ),
-- (
--   'your-publication-id-here',
--   'Enterprise',
--   'Premium featured listing + 8 newsletter ad spots per month',
--   8,
--   true,
--   1,
--   299,
--   3,
--   false
-- );
