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

-- Unique constraint for webhook replay deduplication
alter table public.afteroffers_events
  add constraint afteroffers_events_publication_click_event_unique
  unique (publication_id, click_id, event_type);

-- Index for email-based lookups (non-unique since email is optional)
create index if not exists afteroffers_events_publication_email_idx
  on public.afteroffers_events (publication_id, email);

-- Enable RLS and restrict access to service_role only
alter table public.afteroffers_events enable row level security;

-- Revoke default public access
revoke all on public.afteroffers_events from anon, authenticated;

-- Allow only service_role full access (used by backend supabaseAdmin)
create policy "Service role full access on afteroffers_events"
  on public.afteroffers_events
  for all
  using (true)
  with check (true);
