/**
 * Supabase database types for SipSaver.
 * Mirrors the schema in supabase/migrations/001_initial_schema.sql
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// ── Row shapes (what comes back from SELECT) ─────────────────────────────────

export type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
};

export type VenueRow = {
  id: string;
  name: string;
  neighborhood: string;
  city: string;
  address: string;
  website: string | null;
  instagram_handle: string | null;
  latitude: number;
  longitude: number;
  place_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SourceRow = {
  id: string;
  venue_id: string;
  kind: "website" | "instagram" | "manual";
  label: string;
  url: string;
  last_checked: string | null;
  reliability: "high" | "medium";
  created_at: string;
};

export type DealRow = {
  id: string;
  venue_id: string;
  source_id: string | null;
  tag: string | null;
  day: string;
  time: string;
  description: string;
  category: "Drinks" | "Food" | "Live music" | "Game night";
  review_status: "verified" | "needs-review" | "seeded";
  last_verified: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: string;
  venue_id: string;
  type: string;
  title: string;
  time: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type SavedVenueRow = {
  id: string;
  profile_id: string;
  venue_id: string;
  created_at: string;
};

export type CheckInRow = {
  id: string;
  profile_id: string;
  venue_id: string;
  venue_name: string;
  neighborhood: string;
  deal_desc: string | null;
  points_earned: number;
  created_at: string;
};

export type UserRewardsRow = {
  profile_id: string;
  points: number;
  deals_used: number;
  shared_plans: number;
  updated_at: string;
};

// ── Insert shapes (what you send on INSERT) ──────────────────────────────────

export type VenueInsert = Omit<VenueRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export type DealInsert = Omit<DealRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export type SourceInsert = Omit<SourceRow, "created_at"> & { created_at?: string };
export type EventInsert  = Omit<EventRow,  "created_at"> & { created_at?: string };

export type CheckInInsert = {
  profile_id: string;
  venue_id: string;
  venue_name: string;
  neighborhood: string;
  deal_desc?: string | null;
  points_earned?: number;
};

// ── Venue claim shape ────────────────────────────────────────────────────────

export type VenueClaimRow = {
  id: string;
  owner_name: string;
  bar_name: string;
  email: string;
  phone: string | null;
  neighborhood: string | null;
  website: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

export type VenueClaimInsert = {
  owner_name: string;
  bar_name: string;
  email: string;
  phone?: string | null;
  neighborhood?: string | null;
  website?: string | null;
  message?: string | null;
  status?: string;
};

// ── Database interface (for createClient<Database>()) ────────────────────────
// supabase-js v2.100+ (postgrest-js v1.18+) requires all five schema sections.
// Missing any of Views / Functions / Enums / CompositeTypes causes the schema
// to fall through to the { PostgrestVersion: "12" } sentinel, making all
// table Insert/Update types resolve to `never`.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row:           ProfileRow;
        Insert:        Omit<ProfileRow, "created_at">;
        Update:        Partial<Omit<ProfileRow, "id" | "created_at">>;
        Relationships: [];
      };
      venues: {
        Row:           VenueRow;
        Insert:        VenueInsert;
        Update:        Partial<VenueInsert>;
        Relationships: [];
      };
      sources: {
        Row:           SourceRow;
        Insert:        SourceInsert;
        Update:        Partial<SourceInsert>;
        Relationships: [];
      };
      deals: {
        Row:           DealRow;
        Insert:        DealInsert;
        Update:        Partial<DealInsert>;
        Relationships: [];
      };
      events: {
        Row:           EventRow;
        Insert:        EventInsert;
        Update:        Partial<EventInsert>;
        Relationships: [];
      };
      saved_venues: {
        Row:           SavedVenueRow;
        Insert:        Omit<SavedVenueRow, "id" | "created_at">;
        Update:        Partial<Omit<SavedVenueRow, "id" | "created_at">>;
        Relationships: [];
      };
      check_ins: {
        Row:           CheckInRow;
        Insert:        CheckInInsert;
        Update:        Partial<CheckInInsert>;
        Relationships: [];
      };
      user_rewards: {
        Row:           UserRewardsRow;
        Insert:        Omit<UserRewardsRow, "updated_at">;
        Update:        Partial<Omit<UserRewardsRow, "profile_id" | "updated_at">>;
        Relationships: [];
      };
      venue_claims: {
        Row:           VenueClaimRow;
        Insert:        VenueClaimInsert;
        Update:        Partial<VenueClaimInsert>;
        Relationships: [];
      };
    };
    Views:          Record<string, never>;
    Functions:      Record<string, never>;
    Enums:          Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
