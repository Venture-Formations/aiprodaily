-- Migration: Subscribe page A/B testing system
-- Date: 2026-04-24
-- Purpose: Allow defining multiple /subscribe content variants ("pages"),
--          grouping them into time-bound tests with weighted random traffic
--          split, and tracking page_view + 4 conversion event types per
--          variant for comparison. Stats are scoped per test_id, so reusing
--          the same page in a new test starts fresh counters.

-- ============================================================
-- 1. subscribe_pages — reusable content presets
-- ============================================================
CREATE TABLE IF NOT EXISTS subscribe_pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id  UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  content         JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_archived     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscribe_pages_pub
  ON subscribe_pages(publication_id, is_archived);

ALTER TABLE subscribe_pages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. subscribe_ab_tests — test definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS subscribe_ab_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id  UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','active','ended')),
  start_date      TIMESTAMPTZ NULL,
  end_date        TIMESTAMPTZ NULL,
  started_at      TIMESTAMPTZ NULL,
  ended_at        TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscribe_ab_tests_pub_status
  ON subscribe_ab_tests(publication_id, status);

-- Enforce a single 'active' test per publication.
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscribe_ab_tests_one_active_per_pub
  ON subscribe_ab_tests(publication_id) WHERE status = 'active';

ALTER TABLE subscribe_ab_tests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. subscribe_ab_test_variants — pages-in-test, with weights
-- ============================================================
CREATE TABLE IF NOT EXISTS subscribe_ab_test_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id       UUID NOT NULL REFERENCES subscribe_ab_tests(id) ON DELETE CASCADE,
  page_id       UUID NOT NULL REFERENCES subscribe_pages(id),
  label         TEXT NOT NULL,
  weight        INT  NOT NULL DEFAULT 50 CHECK (weight >= 0 AND weight <= 1000),
  display_order INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscribe_ab_test_variants_test
  ON subscribe_ab_test_variants(test_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscribe_ab_test_variants_label
  ON subscribe_ab_test_variants(test_id, label);

ALTER TABLE subscribe_ab_test_variants ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. subscribe_ab_assignments — sticky per-visitor assignment + email link
-- ============================================================
CREATE TABLE IF NOT EXISTS subscribe_ab_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id          UUID NOT NULL REFERENCES subscribe_ab_tests(id) ON DELETE CASCADE,
  variant_id       UUID NOT NULL REFERENCES subscribe_ab_test_variants(id),
  publication_id   UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  visitor_id       TEXT NOT NULL,
  subscriber_email TEXT NULL,
  ip_address       TEXT NULL,
  user_agent       TEXT NULL,
  is_bot_ua        BOOLEAN NOT NULL DEFAULT false,
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscribe_ab_assignments_test_visitor
  ON subscribe_ab_assignments(test_id, visitor_id);

CREATE INDEX IF NOT EXISTS idx_subscribe_ab_assignments_email
  ON subscribe_ab_assignments(test_id, subscriber_email)
  WHERE subscriber_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscribe_ab_assignments_pub
  ON subscribe_ab_assignments(publication_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscribe_ab_assignments_pub_email
  ON subscribe_ab_assignments(publication_id, subscriber_email)
  WHERE subscriber_email IS NOT NULL;

ALTER TABLE subscribe_ab_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. subscribe_ab_events — granular event log (stats source)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscribe_ab_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id          UUID NOT NULL REFERENCES subscribe_ab_tests(id) ON DELETE CASCADE,
  variant_id       UUID NOT NULL REFERENCES subscribe_ab_test_variants(id),
  publication_id   UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  visitor_id       TEXT NULL,
  subscriber_email TEXT NULL,
  event_type       TEXT NOT NULL
                   CHECK (event_type IN
                     ('page_view','signup','reached_offers','completed_info','sparkloop_signup')),
  ip_address       TEXT NULL,
  is_bot_ua        BOOLEAN NOT NULL DEFAULT false,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscribe_ab_events_test_type
  ON subscribe_ab_events(test_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscribe_ab_events_test_variant
  ON subscribe_ab_events(test_id, variant_id, event_type);

CREATE INDEX IF NOT EXISTS idx_subscribe_ab_events_pub
  ON subscribe_ab_events(publication_id, occurred_at DESC);

ALTER TABLE subscribe_ab_events ENABLE ROW LEVEL SECURITY;
