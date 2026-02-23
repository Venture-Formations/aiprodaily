-- Seed data for Supabase preview branches
-- This provides minimal test data so preview deployments are functional

-- Test publication
INSERT INTO publications (id, slug, name, subdomain, is_active, primary_color)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test-newsletter',
  'Test AI Newsletter',
  'test',
  true,
  '#3B82F6'
) ON CONFLICT (id) DO NOTHING;

-- Basic publication settings (needed for most features to work)
INSERT INTO publication_settings (publication_id, key, value)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'ai_apps_per_newsletter', '6'),
  ('00000000-0000-0000-0000-000000000001', 'affiliate_cooldown_days', '7')
ON CONFLICT (publication_id, key) DO NOTHING;
