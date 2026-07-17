-- Venue claim requests submitted from the Operators page

CREATE TABLE IF NOT EXISTS public.venue_claims (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_name    TEXT        NOT NULL,
  bar_name      TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  phone         TEXT,
  neighborhood  TEXT,
  website       TEXT,
  message       TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.venue_claims ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a claim (no auth required)
CREATE POLICY "venue_claims_insert_anon" ON public.venue_claims
  FOR INSERT WITH CHECK (TRUE);

-- Only authenticated users can read claims (you, viewing your dashboard)
CREATE POLICY "venue_claims_select_auth" ON public.venue_claims
  FOR SELECT USING (auth.role() = 'authenticated');
