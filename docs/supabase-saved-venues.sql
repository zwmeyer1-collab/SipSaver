create table if not exists public.saved_venues (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  venue_id text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists saved_venues_profile_venue_idx
  on public.saved_venues (profile_id, venue_id);

alter table public.saved_venues enable row level security;

create policy "Users can read their own saved venues"
  on public.saved_venues
  for select
  to authenticated
  using (auth.uid() = profile_id);

create policy "Users can insert their own saved venues"
  on public.saved_venues
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

create policy "Users can delete their own saved venues"
  on public.saved_venues
  for delete
  to authenticated
  using (auth.uid() = profile_id);
