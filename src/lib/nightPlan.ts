// ── Night Plan: local-first social layer ──────────────────────────────────────
// Plans are stored in localStorage and can be shared via base64-encoded URLs.
// No backend needed — the plan is self-contained in the share link.

export interface NightPlanStop {
  venueId: string;
  venueName: string;
  neighborhood: string;
  dealDesc: string;
  dealTime: string;
  votes: number;
}

export interface PlanRsvp {
  name: string;
  status: "going" | "maybe";
}

export interface NightPlan {
  id: string;
  name: string;
  startTime: string;
  neighborhood: string;
  stops: NightPlanStop[];
  rsvps: PlanRsvp[];
  createdAt: string;
}

// ── Encode/decode for shareable URLs ──────────────────────────────────────────

export function encodePlan(plan: NightPlan): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(plan))));
}

export function decodePlan(encoded: string): NightPlan | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(encoded)))) as NightPlan;
  } catch {
    return null;
  }
}

// ── LocalStorage persistence ───────────────────────────────────────────────────

const STORAGE_KEY = "sipsaver_night_plan";
const VOTES_KEY = "sipsaver_plan_votes";

export function savePlan(plan: NightPlan): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

export function loadPlan(): NightPlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NightPlan) : null;
  } catch {
    return null;
  }
}

export function clearPlan(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getVotedVenueIds(): Set<string> {
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

export function markVoted(venueId: string): void {
  const ids = getVotedVenueIds();
  ids.add(venueId);
  localStorage.setItem(VOTES_KEY, JSON.stringify(Array.from(ids)));
}

// ── ID generation ──────────────────────────────────────────────────────────────

export function generatePlanId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Vibe computation ──────────────────────────────────────────────────────────
// Given deal + event data for a venue, returns a "vibe" label used across the app.

export interface VibeResult {
  label: string;
  icon: string;
  cls: string;
}

export function getVibe(dealCount: number, liveCount: number, hasEvents: boolean): VibeResult {
  if (liveCount >= 2 || (liveCount >= 1 && hasEvents)) {
    return { label: "Packed", icon: "🔥", cls: "vibe-packed" };
  }
  if (liveCount >= 1) {
    return { label: "Heating up", icon: "⚡", cls: "vibe-heating" };
  }
  if (hasEvents) {
    return { label: "Events tonight", icon: "🎉", cls: "vibe-events" };
  }
  if (dealCount >= 3) {
    return { label: "Active", icon: "🟢", cls: "vibe-active" };
  }
  if (dealCount >= 1) {
    return { label: "Deals live", icon: "🍺", cls: "vibe-deals" };
  }
  return { label: "Chill", icon: "🌙", cls: "vibe-chill" };
}
