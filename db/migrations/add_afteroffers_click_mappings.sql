-- Maps AfterOffers click_id to subscriber email at subscribe time.
-- Used to attribute postback conversions when email is not included.

create table if not exists public.afteroffers_click_mappings (
  id uuid primary key default gen_random_uuid(),
  publication_id text not null,
  click_id text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- One mapping per click_id per publication
alter table public.afteroffers_click_mappings
  add constraint afteroffers_click_mappings_pub_click_unique
  unique (publication_id, click_id);

-- Fast lookup by email (e.g. find all click_ids for a subscriber)
create index if not exists afteroffers_click_mappings_pub_email_idx
  on public.afteroffers_click_mappings (publication_id, email);

-- RLS: service role only
alter table public.afteroffers_click_mappings enable row level security;

revoke all on public.afteroffers_click_mappings from anon, authenticated;

create policy "Service role full access on afteroffers_click_mappings"
  on public.afteroffers_click_mappings
  for all
  using (true)
  with check (true);
