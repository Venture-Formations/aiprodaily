-- Pre-populate subscribe page settings for all active publications
-- so the Website settings tab shows filled fields instead of empty placeholders.
-- Uses INSERT ... ON CONFLICT DO NOTHING to avoid overwriting any already-saved values.

INSERT INTO publication_settings (publication_id, key, value, updated_at)
SELECT p.id, s.key, s.value, now()
FROM publications p
CROSS JOIN (VALUES
  ('subscribe_heading', 'Master AI Tools, Prompts & News'),
  ('subscribe_heading_styled', 'in Just 3 Minutes a Day'),
  ('subscribe_subheading', 'Join 10,000+ accounting professionals staying current as AI reshapes bookkeeping, tax, and advisory work.'),
  ('subscribe_tagline', 'FREE FOREVER'),
  ('subscribe_info_heading', 'One Last Step!'),
  ('subscribe_info_heading_styled', 'Personalize Your Experience'),
  ('subscribe_info_subheading', 'Help us tailor your newsletter to your needs.\nThis only takes 30 seconds!'),
  ('subscribe_info_job_label', 'What best describes your role?'),
  ('subscribe_info_job_options', '[{"value":"Partner/Owner","label":"Partner/Owner"},{"value":"CFO","label":"CFO"},{"value":"Accountant","label":"Accountant"},{"value":"Bookkeeper","label":"Bookkeeper"},{"value":"Other","label":"Other"}]'),
  ('subscribe_info_clients_label', 'How many clients'' books/tax returns/financials do you handle yearly?'),
  ('subscribe_info_clients_options', '[{"value":"1 (just my employer''s or my own company)","label":"1 (just my employer''s or my own company)"},{"value":"2-20","label":"2-20"},{"value":"21-100","label":"21-100"},{"value":"101-299","label":"101-299"},{"value":"300+","label":"300+"}]'),
  ('subscribe_info_submit_text', 'Complete Sign Up')
) AS s(key, value)
WHERE p.is_active = true
ON CONFLICT (publication_id, key) DO NOTHING;
