-- Create table to store After Offers events (conversions, impressions, etc.)
-- Follows multi-tenant pattern with explicit publication_id.

create table if not exists public.afteroffers_events (
  id uuid primary key default gen_random_uuid(),
  publication_id text not null,
  click_id text not null,
  email text,
  revenue numeric,
  event_type text not null default 'conversion',
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists afteroffers_events_publication_click_idx
  on public.afteroffers_events (publication_id, click_id);

create index if not exists afteroffers_events_publication_email_idx
  on public.afteroffers_events (publication_id, email);

