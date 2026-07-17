-- SipSaver: Initial Schema
-- Paste this entire file into Supabase Dashboard > SQL Editor and click Run


-- 1. PROFILES
-- Auto-created when a user signs up (see trigger at bottom).

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 2. VENUES

CREATE TABLE IF NOT EXISTS public.venues (
  id               TEXT             PRIMARY KEY,
  name             TEXT             NOT NULL,
  neighborhood     TEXT             NOT NULL,
  city             TEXT             NOT NULL DEFAULT 'Tampa',
  address          TEXT             NOT NULL,
  website          TEXT,
  instagram_handle TEXT,
  latitude         DOUBLE PRECISION NOT NULL DEFAULT 0,
  longitude        DOUBLE PRECISION NOT NULL DEFAULT 0,
  place_id         TEXT,
  is_active        BOOLEAN          NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);


-- 3. SOURCES

CREATE TABLE IF NOT EXISTS public.sources (
  id           TEXT        PRIMARY KEY,
  venue_id     TEXT        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  kind         TEXT        NOT NULL,
  label        TEXT        NOT NULL,
  url          TEXT        NOT NULL,
  last_checked TEXT,
  reliability  TEXT        NOT NULL DEFAULT 'medium',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 4. DEALS

CREATE TABLE IF NOT EXISTS public.deals (
  id             TEXT        PRIMARY KEY,
  venue_id       TEXT        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  source_id      TEXT        REFERENCES public.sources(id) ON DELETE SET NULL,
  tag            TEXT,
  day            TEXT        NOT NULL,
  time           TEXT        NOT NULL,
  description    TEXT        NOT NULL,
  category       TEXT        NOT NULL,
  review_status  TEXT        NOT NULL DEFAULT 'seeded',
  last_verified  TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 5. EVENTS

CREATE TABLE IF NOT EXISTS public.events (
  id          TEXT        PRIMARY KEY,
  venue_id    TEXT        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  time        TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 6. SAVED_VENUES
-- Column names must match what useSavedVenues.ts expects.

CREATE TABLE IF NOT EXISTS public.saved_venues (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue_id    TEXT        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, venue_id)
);


-- 7. CHECK_INS

CREATE TABLE IF NOT EXISTS public.check_ins (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue_id       TEXT        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  venue_name     TEXT        NOT NULL,
  neighborhood   TEXT        NOT NULL,
  deal_desc      TEXT,
  points_earned  INT         NOT NULL DEFAULT 50,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 8. USER_REWARDS

CREATE TABLE IF NOT EXISTS public.user_rewards (
  profile_id    UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  points        INT         NOT NULL DEFAULT 0,
  deals_used    INT         NOT NULL DEFAULT 0,
  shared_plans  INT         NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- INDEXES

CREATE INDEX IF NOT EXISTS idx_deals_venue_id       ON public.deals(venue_id);
CREATE INDEX IF NOT EXISTS idx_deals_is_active      ON public.deals(is_active);
CREATE INDEX IF NOT EXISTS idx_sources_venue_id     ON public.sources(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_venue_id      ON public.events(venue_id);
CREATE INDEX IF NOT EXISTS idx_saved_profile        ON public.saved_venues(profile_id);
CREATE INDEX IF NOT EXISTS idx_checkins_profile     ON public.check_ins(profile_id);
CREATE INDEX IF NOT EXISTS idx_venues_neighborhood  ON public.venues(neighborhood);


-- UPDATED_AT TRIGGER

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- AUTO-CREATE PROFILE ON SIGN UP

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_rewards (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ROW LEVEL SECURITY

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "venues_select_all" ON public.venues
  FOR SELECT USING (TRUE);

CREATE POLICY "sources_select_all" ON public.sources
  FOR SELECT USING (TRUE);

CREATE POLICY "deals_select_active" ON public.deals
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "events_select_all" ON public.events
  FOR SELECT USING (TRUE);

CREATE POLICY "saved_venues_all_own" ON public.saved_venues
  FOR ALL USING (auth.uid() = profile_id);

CREATE POLICY "check_ins_insert_own" ON public.check_ins
  FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "check_ins_select_own" ON public.check_ins
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "user_rewards_all_own" ON public.user_rewards
  FOR ALL USING (auth.uid() = profile_id);
