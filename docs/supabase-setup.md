# Supabase Setup

## 1. Create a project

- Go to [Supabase](https://supabase.com/)
- Create a new project
- Wait for the database and auth services to finish provisioning

## 2. Copy these values

From Project Settings -> API:

- Project URL
- anon public key

## 3. Add them to `.env.local`

Use this format:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You already have `.env.local` in this project, so just add the two new lines there.

## 4. Turn on email auth

In Supabase:

- Authentication -> Providers
- Enable Email
- Keep magic link enabled

## 5. Local behavior

If Supabase keys are present:

- login page sends a magic link
- session state comes from Supabase auth

If Supabase keys are missing:

- the app falls back to local demo auth so the UI still works

## 6. Recommended next database tables

Create these first:

- `profiles`
- `saved_venues`
- `watchlists`

Then we can connect:

- real saved venues
- watchlist alerts
- claimed bars
- operator review actions
