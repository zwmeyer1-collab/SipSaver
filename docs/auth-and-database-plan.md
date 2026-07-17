# Auth And Database Plan

## Do we need a database?

Yes, for real login and user features we should use a database.

We can fake login on the frontend for design and flow testing, but real features require persistence:

- user accounts
- saved venues
- watchlists
- notification preferences
- claimed bar accounts
- approved deals
- venue ownership and staff roles

## Best stack for SipSaver right now

Recommended first backend:

- Supabase Auth
- Supabase Postgres
- Supabase Storage later if we need venue images or uploads

Why this is the best fit:

- fastest path to email login
- Postgres under the hood
- easy local-to-real migration path
- row level security later
- works well with a React frontend

## Minimum tables

### profiles

- id
- email
- display_name
- created_at

### venues

- id
- name
- neighborhood
- city
- address
- website
- instagram_handle
- latitude
- longitude
- google_place_id
- claimed_by_profile_id nullable

### deals

- id
- venue_id
- category
- title
- description
- day_label
- time_label
- source_url
- source_kind
- confidence
- freshness_checked_at
- status

### saved_venues

- id
- profile_id
- venue_id
- created_at

### watchlists

- id
- profile_id
- venue_id
- alert_type
- created_at

### operator_reviews

- id
- venue_id
- source_url
- snippet
- confidence
- decision
- reviewed_by_profile_id
- reviewed_at

## Build order

1. Keep frontend-only login while we shape the UX.
2. Add Supabase project.
3. Replace mock auth with real auth.
4. Save user profile after login.
5. Add saved venues and watchlists.
6. Add operator roles and bar claims.

## Product rule

Do not wait for the full backend before improving the frontend.

We can keep shipping:

- pages
- venue views
- save buttons
- login flow UI

Then connect each one to the database in sequence.
