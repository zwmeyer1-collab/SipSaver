// ── Rewards: local-first gamification layer ───────────────────────────────────
// Points, levels, badges, and check-ins stored in localStorage.
// Designed to sync to Supabase once the backend is wired.

export interface CheckIn {
  venueId: string;
  venueName: string;
  neighborhood: string;
  dealDesc?: string;
  timestamp: string; // ISO
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt?: string;
}

export interface RewardsState {
  points: number;
  checkIns: CheckIn[];
  badges: string[]; // badge ids earned
  sharedPlans: number;
  invitesSent: number;
  dealsUsed: number;
}

// ── Badge definitions ──────────────────────────────────────────────────────────

export const ALL_BADGES: Badge[] = [
  { id: "first_sip",      icon: "🍺", name: "First Sip",       description: "Your first check-in. The journey begins." },
  { id: "regular",        icon: "🔥", name: "Regular",         description: "Check in 5 times. You're a local now." },
  { id: "explorer",       icon: "🗺️", name: "Explorer",        description: "Check into 3 different neighborhoods." },
  { id: "night_owl",      icon: "🌙", name: "Night Owl",       description: "Check in after 10 PM." },
  { id: "bargain_hunter", icon: "💰", name: "Bargain Hunter",  description: "Use a deal under $5." },
  { id: "social_butterfly",icon: "🦋", name: "Social Butterfly","description": "Share a Hoppy Hour plan with friends." },
  { id: "crawl_master",   icon: "🍻", name: "Crawl Master",    description: "Complete a bar crawl with 4+ stops." },
  { id: "deal_hunter",    icon: "🎯", name: "Deal Hunter",     description: "Use 5 deals total." },
  { id: "platinum_sipper",icon: "💎", name: "Platinum Sipper", description: "Reach Platinum level (3000+ points)." },
];

// ── Level system ───────────────────────────────────────────────────────────────

export interface Level {
  name: string;
  icon: string;
  minPoints: number;
  maxPoints: number;
  color: string;
}

export const LEVELS: Level[] = [
  { name: "Bronze",   icon: "🥉", minPoints: 0,    maxPoints: 499,  color: "#cd7f32" },
  { name: "Silver",   icon: "🥈", minPoints: 500,  maxPoints: 1499, color: "#9ca3af" },
  { name: "Gold",     icon: "🥇", minPoints: 1500, maxPoints: 2999, color: "#f59e0b" },
  { name: "Platinum", icon: "💎", minPoints: 3000, maxPoints: 99999, color: "#6366f1" },
];

export function getLevel(points: number): Level & { progress: number } {
  const level = LEVELS.findLast((l) => points >= l.minPoints) ?? LEVELS[0];
  const range = level.maxPoints - level.minPoints;
  const progress = range >= 99999 ? 100 : Math.round(((points - level.minPoints) / range) * 100);
  return { ...level, progress };
}

// ── Redemption rewards ─────────────────────────────────────────────────────────

export interface Reward {
  id: string;
  icon: string;
  name: string;
  description: string;
  cost: number;
  tag: string;
}

export const REWARDS: Reward[] = [
  { id: "free_drink",   icon: "🍹", name: "Free Well Drink",    description: "Redeem at any partner bar on your next visit.", cost: 300,  tag: "Drinks" },
  { id: "free_app",     icon: "🧀", name: "Free Appetizer",     description: "Valid with any food purchase.", cost: 400,  tag: "Food" },
  { id: "discount_15",  icon: "💸", name: "15% Off Your Tab",   description: "One-time discount at any SipSaver venue.", cost: 600,  tag: "Popular" },
  { id: "vip_entry",    icon: "⭐", name: "VIP Entry",          description: "Skip the line at select venues.", cost: 1000, tag: "Premium" },
  { id: "free_round",   icon: "🥂", name: "Round on the House", description: "One round of drinks for up to 4 people.", cost: 1500, tag: "Premium" },
];

// ── Point actions ──────────────────────────────────────────────────────────────

export const POINT_VALUES = {
  checkIn: 50,
  useDeal: 25,
  saveVenue: 10,
  sharePlan: 100,
  inviteFriend: 150,
};

// ── Storage ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "sipsaver_rewards";

function defaultState(): RewardsState {
  return { points: 0, checkIns: [], badges: [], sharedPlans: 0, invitesSent: 0, dealsUsed: 0 };
}

function loadState(): RewardsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState(), ...(JSON.parse(raw) as RewardsState) } : defaultState();
  } catch {
    return defaultState();
  }
}

function saveState(state: RewardsState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ── Badge unlock logic ─────────────────────────────────────────────────────────

function computeNewBadges(state: RewardsState, checkIn?: CheckIn): string[] {
  const earned = new Set(state.checkIns.length > 0 || checkIn ? state.badges : []);
  const allCheckIns = checkIn ? [...state.checkIns, checkIn] : state.checkIns;
  const uniqueNeighborhoods = new Set(allCheckIns.map((c) => c.neighborhood));

  if (allCheckIns.length >= 1) earned.add("first_sip");
  if (allCheckIns.length >= 5) earned.add("regular");
  if (uniqueNeighborhoods.size >= 3) earned.add("explorer");
  if (state.sharedPlans >= 1 || (checkIn && state.sharedPlans >= 1)) earned.add("social_butterfly");
  if (state.dealsUsed >= 5) earned.add("deal_hunter");
  if (state.points + (checkIn ? POINT_VALUES.checkIn : 0) >= 3000) earned.add("platinum_sipper");

  // night owl: check in after 10 PM
  const nightCheckIn = allCheckIns.find((c) => {
    const h = new Date(c.timestamp).getHours();
    return h >= 22 || h < 3;
  });
  if (nightCheckIn) earned.add("night_owl");

  return Array.from(earned);
}

// ── Streak computation ─────────────────────────────────────────────────────────

export function computeStreak(checkIns: CheckIn[]): number {
  if (checkIns.length === 0) return 0;
  // Build a set of unique days that had a check-in (YYYY-MM-DD)
  const days = new Set(checkIns.map((c) => c.timestamp.slice(0, 10)));
  const sorted = Array.from(days).sort().reverse(); // newest first

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Streak must include today or yesterday to be "active"
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ── React hook ─────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

function isSupabaseUser(userId: string) {
  return isSupabaseConfigured && supabase && !userId.startsWith("local-");
}

/** Load rewards state from Supabase (check_ins + user_rewards rows). */
async function loadFromSupabase(userId: string): Promise<RewardsState | null> {
  if (!supabase) return null;
  const [rewardsRes, checkInsRes] = await Promise.all([
    supabase.from("user_rewards").select("*").eq("profile_id", userId).single(),
    supabase.from("check_ins").select("*").eq("profile_id", userId).order("created_at", { ascending: false }),
  ]);

  if (rewardsRes.error && rewardsRes.error.code !== "PGRST116") return null; // PGRST116 = no row

  const row = rewardsRes.data;
  const dbCheckIns: CheckIn[] = (checkInsRes.data ?? []).map((c) => ({
    venueId:      c.venue_id as string,
    venueName:    c.venue_name as string,
    neighborhood: c.neighborhood as string,
    dealDesc:     (c.deal_desc as string | null) ?? undefined,
    timestamp:    c.created_at as string,
  }));

  const points      = (row?.points      as number) ?? 0;
  const dealsUsed   = (row?.deals_used  as number) ?? 0;
  const sharedPlans = (row?.shared_plans as number) ?? 0;

  const partialState: RewardsState = {
    points, dealsUsed, sharedPlans,
    checkIns: dbCheckIns,
    badges: [],
    invitesSent: 0,
  };
  // Recompute badges from loaded data
  partialState.badges = computeNewBadges(partialState);
  return partialState;
}

/** Upsert points/counters into user_rewards. */
async function syncRewardsRow(userId: string, state: RewardsState) {
  if (!supabase) return;
  await supabase.from("user_rewards").upsert({
    profile_id:   userId,
    points:       state.points,
    deals_used:   state.dealsUsed,
    shared_plans: state.sharedPlans,
  }, { onConflict: "profile_id" });
}

export function useRewards() {
  const { user } = useAuth();
  const [state, setState] = useState<RewardsState>(loadState);
  const syncedRef = useRef(false);

  // Load from Supabase when user changes
  useEffect(() => {
    syncedRef.current = false;
    if (!user || !isSupabaseUser(user.id)) {
      // Fall back to localStorage state
      setState(loadState());
      return;
    }
    loadFromSupabase(user.id).then((dbState) => {
      if (dbState) {
        setState(dbState);
        saveState(dbState); // keep local cache in sync
      } else {
        // No DB row yet (e.g., new user before trigger fires) — use local
        setState(loadState());
      }
      syncedRef.current = true;
    }).catch(() => { setState(loadState()); syncedRef.current = true; });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkIn = useCallback((venue: { id: string; name: string; neighborhood: string }, dealDesc?: string) => {
    setState((prev) => {
      // Prevent double check-in at same venue within 2h
      const recent = prev.checkIns.find((c) => {
        return c.venueId === venue.id && Date.now() - new Date(c.timestamp).getTime() < 2 * 60 * 60 * 1000;
      });
      if (recent) return prev;

      const newCheckIn: CheckIn = {
        venueId: venue.id,
        venueName: venue.name,
        neighborhood: venue.neighborhood,
        dealDesc,
        timestamp: new Date().toISOString(),
      };
      const updated: RewardsState = {
        ...prev,
        points: prev.points + POINT_VALUES.checkIn,
        checkIns: [newCheckIn, ...prev.checkIns],
        badges: computeNewBadges(prev, newCheckIn),
      };
      saveState(updated);

      // Persist to Supabase in background
      if (user && isSupabaseUser(user.id) && supabase) {
        void supabase.from("check_ins").insert({
          profile_id:   user.id,
          venue_id:     venue.id,
          venue_name:   venue.name,
          neighborhood: venue.neighborhood,
          deal_desc:    dealDesc ?? null,
          points_earned: POINT_VALUES.checkIn,
        }).then(() => syncRewardsRow(user.id, updated));
      }

      return updated;
    });
  }, [user]);

  const addPoints = useCallback((amount: number) => {
    setState((prev) => {
      const updated = { ...prev, points: prev.points + amount };
      saveState(updated);
      if (user && isSupabaseUser(user.id)) void syncRewardsRow(user.id, updated);
      return updated;
    });
  }, [user]);

  const redeemReward = useCallback((reward: Reward): boolean => {
    let success = false;
    setState((prev) => {
      if (prev.points < reward.cost) return prev;
      const updated = { ...prev, points: prev.points - reward.cost };
      saveState(updated);
      if (user && isSupabaseUser(user.id)) void syncRewardsRow(user.id, updated);
      success = true;
      return updated;
    });
    return success;
  }, [user]);

  const recordShare = useCallback(() => {
    setState((prev) => {
      const updated = {
        ...prev,
        sharedPlans: prev.sharedPlans + 1,
        points: prev.points + POINT_VALUES.sharePlan,
        badges: computeNewBadges({ ...prev, sharedPlans: prev.sharedPlans + 1 }),
      };
      saveState(updated);
      if (user && isSupabaseUser(user.id)) void syncRewardsRow(user.id, updated);
      return updated;
    });
  }, [user]);

  const hasCheckedInRecently = useCallback((venueId: string): boolean => {
    return state.checkIns.some((c) => {
      return c.venueId === venueId && Date.now() - new Date(c.timestamp).getTime() < 2 * 60 * 60 * 1000;
    });
  }, [state.checkIns]);

  const earnedBadges = ALL_BADGES.filter((b) => state.badges.includes(b.id));
  const unearnedBadges = ALL_BADGES.filter((b) => !state.badges.includes(b.id));
  const level = getLevel(state.points);
  const streak = computeStreak(state.checkIns);

  return {
    state,
    level,
    streak,
    earnedBadges,
    unearnedBadges,
    checkIn,
    addPoints,
    redeemReward,
    recordShare,
    hasCheckedInRecently,
  };
}
