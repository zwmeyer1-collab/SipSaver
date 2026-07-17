import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FilterBar } from "../components/FilterBar";
import { ReviewQueue } from "../components/ReviewQueue";
import { TampaMap } from "../components/TampaMap";
import reviewData from "../../data/ingestion/tampa-review.json";
import prospectReviewData from "../../data/ingestion/tampa-prospect-review.json";
import instagramReviewData from "../../data/ingestion/tampa-instagram-review.json";
import { dealCategories, events, tampaNeighborhoods } from "../data/tampa";
import type { DealCategory, ImportedReviewItem } from "../data/types";
import {
  getDisplayDeals,
  getImportedPlaceMatchesFile,
  getImportedPlacesFile,
  getMapVenues,
  getMatchedVenuePairs,
  getSuggestedVenueMatches,
  getUnmatchedSeededVenueMatches,
  getVenueById,
} from "../lib/tampaSelectors";
import { haversineKm } from "../lib/barCrawl";
import { getVibe, loadPlan, savePlan, generatePlanId } from "../lib/nightPlan";
import type { NightPlan } from "../lib/nightPlan";
import { useGeolocation } from "../hooks/useGeolocation";
import { useRewards } from "../hooks/useRewards";
import { useMinuteTick } from "../hooks/useMinuteTick";
import { getCountdownVariant, parseCountdownMinutes, parseLiveMinutes } from "../lib/countdownUtils";

function getCategoryEmoji(category: string): string {
  if (category === "Food") return "🍔";
  if (category === "Entertainment") return "🎉";
  return "🍹";
}


const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG: Record<string, string> = {
  Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday",
  Thu: "Thursday", Fri: "Friday", Sat: "Saturday",
};

type DiscoverTab = "deals" | "tonight" | "explore";

const MOCK_NAMES = ["Alex T.", "Jordan M.", "Casey B.", "Riley K.", "Sam W.", "Morgan F.", "Taylor S.", "Drew L.", "Quinn H.", "Jamie O.", "Chris V.", "Pat H."];
const MOCK_MINUTES = [4, 9, 16, 23, 34, 42, 55, 67, 71, 88, 94, 108];

function getDealMinPrice(description: string): number | null {
  const matches = [...description.matchAll(/\$(\d+(?:\.\d{1,2})?)/g)];
  const prices = matches.map((m) => parseFloat(m[1]));
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function DiscoverPage() {
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>("deals");
  const [activeFilter, setActiveFilter] = useState<DealCategory>("All deals");
  const [activeNeighborhood, setActiveNeighborhood] = useState("All Tampa");
  const [activeDay, setActiveDay] = useState<string>(ALL_DAYS[new Date().getDay()]);
  const dayRailRef = useRef<HTMLDivElement>(null);

  // Auto-scroll day rail so today's chip is visible on mount
  useEffect(() => {
    const rail = dayRailRef.current;
    if (!rail) return;
    const active = rail.querySelector(".day-chip-active") as HTMLElement | null;
    if (active) {
      rail.scrollLeft = active.offsetLeft - 12;
    }
  }, []);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geo = useGeolocation();
  const [activeBudget, setActiveBudget] = useState<null | 5 | 10 | 20>(null);
  const [liveOnlyFilter, setLiveOnlyFilter] = useState(false);
  const [planVenueIds, setPlanVenueIds] = useState<Set<string>>(() => {
    const plan = loadPlan();
    return new Set(plan?.stops.map((s) => s.venueId) ?? []);
  });
  const recentVenueIds = (() => {
    try {
      const raw = localStorage.getItem("sipsaver_recent_venues");
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  })();
  const [planFlashId, setPlanFlashId] = useState<string | null>(null);
  const { state: rewardsState, checkIn: rewardCheckIn, hasCheckedInRecently } = useRewards();
  const [checkInFlashId, setCheckInFlashId] = useState<string | null>(null);
  useMinuteTick(); // re-renders every minute so countdown labels stay current
  const displayDeals = getDisplayDeals();
  const importedReviewItems = reviewData.items as ImportedReviewItem[];
  const prospectReviewItems = prospectReviewData.items as ImportedReviewItem[];
  const instagramReviewItems = instagramReviewData.items as ImportedReviewItem[];
  const allReviewItems = [...instagramReviewItems, ...prospectReviewItems, ...importedReviewItems];
  const importedPlacesFile = getImportedPlacesFile();
  const importedPlaceMatchesFile = getImportedPlaceMatchesFile();
  const mapVenues = getMapVenues();
  const matchedVenuePairs = getMatchedVenuePairs();
  const suggestedVenueMatches = getSuggestedVenueMatches();
  const unmatchedSeededVenueMatches = getUnmatchedSeededVenueMatches();
  const normalizedQuery = query.trim().toLowerCase();

  // Search suggestions — venue names + neighborhoods + categories
  type Suggestion = { kind: "venue" | "neighborhood" | "category"; label: string; sub?: string; icon?: string };
  const searchSuggestions: Suggestion[] = (() => {
    const q = normalizedQuery;
    if (!searchFocused) return [];

    if (q.length === 0) {
      // Show quick-tap suggestions: top active venues + neighborhoods
      const topVenues = [...mapVenues]
        .map((v) => {
          const vd = displayDeals.filter((d) => d.venueId === v.id);
          const live = vd.filter((d) => d.countdownLabel.includes("left")).length;
          return { v, score: live * 4 + vd.length };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map(({ v }) => ({ kind: "venue" as const, label: v.name, sub: v.neighborhood }));
      const neighborhoods: Suggestion[] = ["SoHo", "Ybor", "Downtown Tampa", "Channelside"].map((n) => ({
        kind: "neighborhood" as const, label: n, icon: "📍",
      }));
      return [...topVenues, ...neighborhoods].slice(0, 7);
    }

    const results: Suggestion[] = [];
    // Venue matches
    mapVenues.forEach((v) => {
      if (v.name.toLowerCase().includes(q)) {
        results.push({ kind: "venue", label: v.name, sub: v.neighborhood });
      }
    });
    // Neighborhood matches
    ["SoHo", "Ybor", "Downtown Tampa", "Channelside", "Seminole Heights", "Tampa Heights", "Hyde Park", "Westshore"].forEach((n) => {
      if (n.toLowerCase().includes(q)) {
        results.push({ kind: "neighborhood", label: n, icon: "📍" });
      }
    });
    // Category / keyword matches
    const KEYWORDS = ["drinks", "food", "live music", "game night", "trivia", "karaoke", "brunch", "wings", "tacos", "margaritas", "beer", "cocktails", "happy hour"];
    KEYWORDS.forEach((kw) => {
      if (kw.includes(q)) {
        results.push({ kind: "category", label: kw, icon: "🔍" });
      }
    });

    return results.slice(0, 6);
  })();

  // Current day of week (short, e.g. "Wed")
  const todayShort = ALL_DAYS[new Date().getDay()];
  const todayLong = DAY_LONG[todayShort];

  const filteredDeals = displayDeals.filter((deal) => {
    const filterMatches = activeFilter === "All deals" || deal.category === activeFilter;
    const neighborhoodMatches =
      activeNeighborhood === "All Tampa" || deal.venue.neighborhood === activeNeighborhood;
    const isWeekend = activeDay === "Sat" || activeDay === "Sun";
    const dayMatches =
      activeDay === "All" ||
      deal.day === DAY_LONG[activeDay] ||
      deal.day === "Daily" ||
      (deal.day === "Weekdays" && !isWeekend) ||
      (deal.day === "Weekends" && isWeekend);
    const searchMatches =
      normalizedQuery.length === 0 ||
      [
        deal.venue.name,
        deal.venue.neighborhood,
        deal.description,
        deal.tag,
        deal.category,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    return filterMatches && neighborhoodMatches && dayMatches && searchMatches;
  });

  const tonightEvents = events
    .filter((event) => {
      const venue = getVenueById(event.venueId);

      return activeNeighborhood === "All Tampa" || venue.neighborhood === activeNeighborhood;
    })
    .slice(0, 2);

  const nearbyVenues = mapVenues.filter(
    (venue) => activeNeighborhood === "All Tampa" || venue.neighborhood === activeNeighborhood
  );

  // Activity data for map pins
  const nearbyVenueActivity = new Map(nearbyVenues.map((v) => {
    const vd = displayDeals.filter((d) => d.venueId === v.id);
    const liveCount = vd.filter((d) => d.countdownLabel.includes("left")).length;
    const startingSoon = vd.some((d) => {
      if (!d.countdownLabel.includes("Starts")) return false;
      const mins = parseCountdownMinutes(d.countdownLabel);
      return mins !== null && mins <= 90;
    });
    return [v.id, { liveCount, totalDeals: vd.length, startingSoon }];
  }));

  const liveNeighborhoods = ["All Tampa", ...tampaNeighborhoods.map((zone) => zone.name)];

  // Day-filtered pool for chip badge counts (respects day filter but not neighborhood/category)
  const dayFilteredForCounts = displayDeals.filter((deal) => {
    if (activeDay === "All") return true;
    const isWeekend = activeDay === "Sat" || activeDay === "Sun";
    return (
      deal.day === DAY_LONG[activeDay] ||
      deal.day === "Daily" ||
      (deal.day === "Weekdays" && !isWeekend) ||
      (deal.day === "Weekends" && isWeekend)
    );
  });

  // Per-neighborhood deal counts for badge display (reflect active day filter)
  const neighborhoodDealCounts = Object.fromEntries(
    liveNeighborhoods.map((name) => [
      name,
      name === "All Tampa"
        ? dayFilteredForCounts.length
        : dayFilteredForCounts.filter((d) => d.venue.neighborhood === name).length,
    ])
  );

  const visibleReviewItems = allReviewItems.filter((item) => {
    const neighborhoodMatches =
      activeNeighborhood === "All Tampa" || item.neighborhood === activeNeighborhood;
    const searchMatches =
      normalizedQuery.length === 0 ||
      [item.snippet, item.venueName, item.suggestedCategory]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    return neighborhoodMatches && searchMatches;
  });

  // Pre-compute per-venue vibe for use in deal cards
  const venueVibeMap = new Map(
    mapVenues.map((venue) => {
      const venueDeals = displayDeals.filter((d) => d.venueId === venue.id);
      const liveCount = venueDeals.filter((d) => d.countdownLabel.includes("left")).length;
      const hasEvents = events.some((e) => e.venueId === venue.id);
      return [venue.id, getVibe(venueDeals.length, liveCount, hasEvents)];
    })
  );

  const freshSourceDeals = filteredDeals
    .filter(
      (deal) =>
        deal.tag === "Live scrape" ||
        deal.sourceKindLabel === "Instagram" ||
        deal.sourceKindLabel === "New place"
    )
    .slice(0, 3);

  const sourceSpotlights = (freshSourceDeals.length > 0 ? freshSourceDeals : filteredDeals).slice(0, 3);

  const neighborhoodBoards = tampaNeighborhoods.map((zone) => {
    const allZoneDeals = displayDeals.filter((deal) => deal.venue.neighborhood === zone.name);
    const topDeals = allZoneDeals.slice(0, 3);
    const zoneVenues = mapVenues.filter((venue) => venue.neighborhood === zone.name);
    const liveCount = allZoneDeals.filter((d) => d.countdownLabel.includes("left")).length;

    return {
      ...zone,
      dealCount: allZoneDeals.length,
      liveCount,
      venueCount: zoneVenues.length,
      topDeals,
    };
  });

  const justAddedPlaces = Array.from(
    new Map(
      displayDeals
        .filter((deal) => deal.sourceKindLabel === "New place")
        .map((deal) => [deal.venue.id, deal])
    ).values()
  ).slice(0, 4);

  const specialsRail = [
    { label: "Drinks", icon: "🥤", filter: "Drinks" as DealCategory },
    { label: "Food", icon: "🍔", filter: "Food" as DealCategory },
    { label: "Live music", icon: "🎸", filter: "Live music" as DealCategory },
    { label: "Game night", icon: "🎮", filter: "Game night" as DealCategory },
  ];

  const eventRail: Array<{ label: string; icon: string; filter?: DealCategory; search?: string }> = [
    { label: "Live music", icon: "♪",  filter: "Live music" as DealCategory },
    { label: "Game night", icon: "🎮", filter: "Game night" as DealCategory },
    { label: "Trivia",     icon: "❓", search: "trivia" },
    { label: "Karaoke",   icon: "🎤", search: "karaoke" },
    { label: "Brunch",    icon: "🥂", search: "brunch" },
    { label: "Industry",  icon: "🍹", search: "industry" },
  ];

  const nearbyDeals = filteredDeals.slice(0, 3);

  const dealDistanceMi = geo.lat !== null && geo.lng !== null
    ? (lat: number, lng: number) => haversineKm(geo.lat!, geo.lng!, lat, lng) * 0.621371
    : null;

  const nearYouDeals = dealDistanceMi
    ? [...displayDeals]
        .filter((d) => {
          const neighborhoodOk = activeNeighborhood === "All Tampa" || d.venue.neighborhood === activeNeighborhood;
          const isWeekendToday = todayShort === "Sat" || todayShort === "Sun";
          const todayOk =
            d.day === todayLong ||
            d.day === "Daily" ||
            (d.day === "Weekdays" && !isWeekendToday) ||
            (d.day === "Weekends" && isWeekendToday);
          return neighborhoodOk && todayOk;
        })
        .sort((a, b) => dealDistanceMi(a.venue.latitude, a.venue.longitude) - dealDistanceMi(b.venue.latitude, b.venue.longitude))
        .slice(0, 5)
    : [];

  // Deals starting in the next 90 minutes (not currently live), filtered by active neighborhood + category
  const startingSoonRail = displayDeals
    .filter((d) => {
      if (!d.countdownLabel.startsWith("Starts in")) return false;
      const neighborhoodOk = activeNeighborhood === "All Tampa" || d.venue.neighborhood === activeNeighborhood;
      const categoryOk = activeFilter === "All deals" || d.category === activeFilter;
      if (!neighborhoodOk || !categoryOk) return false;
      const mins = parseCountdownMinutes(d.countdownLabel);
      return mins !== null && mins <= 90;
    })
    .sort((a, b) => {
      const ma = parseCountdownMinutes(a.countdownLabel) ?? 999;
      const mb = parseCountdownMinutes(b.countdownLabel) ?? 999;
      return ma - mb;
    })
    .slice(0, 6);

  function dealSortScore(deal: typeof displayDeals[number]): number {
    const label = deal.countdownLabel;
    if (label.includes("left")) return 0;       // live now → top
    if (label.startsWith("Starts in")) return 1; // starting soon
    return 2;                                     // rest
  }

  const sortedFeaturedDeals = dealDistanceMi
    ? [...(filteredDeals.length > 0 ? filteredDeals : displayDeals)]
        .sort((a, b) => dealDistanceMi(a.venue.latitude, a.venue.longitude) - dealDistanceMi(b.venue.latitude, b.venue.longitude))
    : [...(filteredDeals.length > 0 ? filteredDeals : displayDeals)]
        .sort((a, b) => dealSortScore(a) - dealSortScore(b));

  const budgetFiltered = activeBudget
    ? sortedFeaturedDeals.filter((deal) => {
        const price = getDealMinPrice(deal.description);
        return price !== null && price <= activeBudget;
      })
    : sortedFeaturedDeals;
  const liveFilteredDeals = liveOnlyFilter
    ? budgetFiltered.filter((d) => d.countdownLabel.includes("left"))
    : budgetFiltered;
  const mobileFeaturedDeals = liveFilteredDeals.slice(0, 12);
  const liveNowCount = sortedFeaturedDeals.filter((d) => d.countdownLabel.includes("left")).length;

  // Budget chip counts (from sortedFeaturedDeals before budget filter)
  const budgetCounts: Record<number, number> = {};
  for (const max of [5, 10, 20]) {
    budgetCounts[max] = sortedFeaturedDeals.filter((d) => {
      const p = getDealMinPrice(d.description);
      return p !== null && p <= max;
    }).length;
  }

  const liveNowDeals = displayDeals
    .filter((d) => {
      const label = d.countdownLabel;
      return label.includes("left") && (activeNeighborhood === "All Tampa" || d.venue.neighborhood === activeNeighborhood);
    })
    .slice(0, 4);

  const startingSoonDeals = displayDeals
    .filter((d) => {
      const label = d.countdownLabel;
      return label.startsWith("Starts in") && (activeNeighborhood === "All Tampa" || d.venue.neighborhood === activeNeighborhood);
    })
    .slice(0, 3);

  // Last call — live deals with ≤ 30 min remaining, sorted soonest-to-end first
  const lastCallDeals = displayDeals
    .filter((d) => {
      if (!d.countdownLabel.includes("left")) return false;
      if (activeNeighborhood !== "All Tampa" && d.venue.neighborhood !== activeNeighborhood) return false;
      const mins = parseLiveMinutes(d.countdownLabel);
      return mins !== null && mins <= 30;
    })
    .sort((a, b) => {
      const ma = parseLiveMinutes(a.countdownLabel) ?? 99;
      const mb = parseLiveMinutes(b.countdownLabel) ?? 99;
      return ma - mb;
    })
    .slice(0, 4);

  const now = new Date();
  const timeLabel = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dayLabel = now.toLocaleDateString("en-US", { weekday: "long" });

  // Group deals by start-hour window for "Tonight's windows"
  const tonightWindows = (() => {
    const windowMap = new Map<string, { label: string; venues: string[]; count: number }>();
    const neighborhoodFilter = (d: typeof displayDeals[number]) =>
      activeNeighborhood === "All Tampa" || d.venue.neighborhood === activeNeighborhood;

    // Normalize "10AM" → "10 AM" for consistent grouping
    const normTime = (t: string) => t.trim().replace(/(\d)(am|pm)/i, "$1 $2").toUpperCase().replace(/\s+/, " ");

    // Only show windows for today's deals
    const isWeekendToday = todayShort === "Sat" || todayShort === "Sun";
    const todayFilter = (d: typeof displayDeals[number]) =>
      d.day === todayLong ||
      d.day === "Daily" ||
      (d.day === "Weekdays" && !isWeekendToday) ||
      (d.day === "Weekends" && isWeekendToday);

    for (const deal of displayDeals) {
      if (!neighborhoodFilter(deal)) continue;
      if (!todayFilter(deal)) continue;
      const rangeMatch = deal.time.match(
        /(\d{1,2}(?::\d{2})?\s?(?:AM|PM))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s?(?:AM|PM))/i
      );
      if (!rangeMatch) continue;
      const key = `${normTime(rangeMatch[1])} – ${normTime(rangeMatch[2])}`;
      if (!windowMap.has(key)) {
        windowMap.set(key, { label: key, venues: [], count: 0 });
      }
      const entry = windowMap.get(key)!;
      if (!entry.venues.includes(deal.venue.name)) {
        entry.venues.push(deal.venue.name);
      }
      entry.count++;
    }
    return Array.from(windowMap.values())
      .filter((w) => w.venues.length > 0)
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 5);
  })();

  // Best window tonight — pick the time slot with the most venues, prefer future windows
  const bestTimeWindow = (() => {
    if (tonightWindows.length === 0) return null;
    const nowHour = new Date().getHours() + new Date().getMinutes() / 60;
    // Prefer windows that haven't ended yet (rough heuristic: parse end hour from label)
    const futureWindows = tonightWindows.filter((w) => {
      const endMatch = w.label.match(/–\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
      if (!endMatch) return true;
      let h = parseInt(endMatch[1]);
      const pm = endMatch[3].toUpperCase() === "PM";
      if (pm && h !== 12) h += 12;
      if (!pm && h === 12) h = 0;
      return h > nowHour;
    });
    const candidates = futureWindows.length > 0 ? futureWindows : tonightWindows;
    return [...candidates].sort((a, b) => b.venues.length - a.venues.length)[0];
  })();

  const budgetDeals = filteredDeals
    .filter((deal) => /\$[1-6](?:\.\d{2})?/.test(deal.description))
    .slice(0, 4);

  const budgetBoard = budgetDeals.length > 0 ? budgetDeals : filteredDeals.slice(0, 4);

  // ── Add venue to Hoppy Hour plan ────────────────────────────────────────────
  function addToPlan(deal: typeof displayDeals[number]) {
    if (planVenueIds.has(deal.venue.id)) return;
    const existing = loadPlan();
    const newStop = {
      venueId: deal.venue.id,
      venueName: deal.venue.name,
      neighborhood: deal.venue.neighborhood,
      dealDesc: deal.description,
      dealTime: deal.time,
      votes: 0,
    };
    const plan: NightPlan = existing
      ? { ...existing, stops: [...existing.stops, newStop] }
      : {
          id: generatePlanId(),
          name: "Tonight's Plan",
          startTime: deal.time,
          neighborhood: deal.venue.neighborhood,
          stops: [newStop],
          rsvps: [],
          createdAt: new Date().toISOString(),
        };
    savePlan(plan);
    setPlanVenueIds((prev) => new Set([...prev, deal.venue.id]));
    setPlanFlashId(deal.venue.id);
    setTimeout(() => setPlanFlashId(null), 1800);
  }

  // ── Check in from deal card ──────────────────────────────────────────────────
  function handleDealCheckIn(deal: typeof displayDeals[number]) {
    if (hasCheckedInRecently(deal.venue.id)) return;
    rewardCheckIn(
      { id: deal.venue.id, name: deal.venue.name, neighborhood: deal.venue.neighborhood },
      deal.description
    );
    setCheckInFlashId(deal.venue.id);
    setTimeout(() => setCheckInFlashId(null), 2500);
  }

  // ── "Hot right now" venue scores ────────────────────────────────────────────
  const hotVenues = mapVenues
    .map((venue) => {
      const venueDeals = displayDeals.filter((d) => d.venueId === venue.id);
      const liveCount = venueDeals.filter((d) => d.countdownLabel.includes("left")).length;
      const isWeekendToday = todayShort === "Sat" || todayShort === "Sun";
      const todayDeals = venueDeals.filter((d) =>
        d.day === todayLong || d.day === "Daily" ||
        (d.day === "Weekdays" && !isWeekendToday) ||
        (d.day === "Weekends" && isWeekendToday)
      );
      const hasEvents = events.some((e) => e.venueId === venue.id);
      const score = liveCount * 4 + todayDeals.length * 2 + (hasEvents ? 2 : 0) + venueDeals.length;
      const topDeal = todayDeals[0] ?? venueDeals[0];
      return { venue, liveCount, todayCount: todayDeals.length, hasEvents, score, topDeal, vibe: venueVibeMap.get(venue.id) };
    })
    .filter((v) => v.score > 0 && (activeNeighborhood === "All Tampa" || v.venue.neighborhood === activeNeighborhood))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // ── "What's Popping" activity feed ──────────────────────────────────────────
  const activePlan = loadPlan();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const realCheckinsToday = rewardsState.checkIns.filter((c) => new Date(c.timestamp) >= todayStart);
  const activeVenuesForFeed = mapVenues
    .filter((v) => {
      const vibe = venueVibeMap.get(v.id);
      return vibe && vibe.cls !== "vibe-chill";
    })
    .slice(0, 12);
  const mockFeedItems = activeVenuesForFeed.map((venue, i) => {
    const mins = MOCK_MINUTES[i % MOCK_MINUTES.length];
    const topDeal = displayDeals.find((d) => d.venueId === venue.id);
    return {
      id: `mock-${venue.id}`,
      venueName: venue.name,
      neighborhood: venue.neighborhood,
      dealDesc: topDeal
        ? topDeal.description.slice(0, 55) + (topDeal.description.length > 55 ? "…" : "")
        : undefined,
      ago: mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`,
      userName: MOCK_NAMES[i % MOCK_NAMES.length],
      isRealUser: false,
    };
  });
  const realFeedItems = realCheckinsToday.map((c) => {
    const ms = Date.now() - new Date(c.timestamp).getTime();
    const mins = Math.floor(ms / 60000);
    return {
      id: `real-${c.timestamp}`,
      venueName: c.venueName,
      neighborhood: c.neighborhood,
      dealDesc: c.dealDesc
        ? c.dealDesc.slice(0, 55) + (c.dealDesc.length > 55 ? "…" : "")
        : undefined,
      ago: mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`,
      userName: "You",
      isRealUser: true,
    };
  });
  const activityFeed = [...realFeedItems, ...mockFeedItems].slice(0, 8);
  const totalSipSaversOut = activeVenuesForFeed.length + realCheckinsToday.length;

  // ── "Tonight's Best Bet" smart recommendation ───────────────────────────────
  const bestBet = (() => {
    if (hotVenues.length === 0) return null;
    const top = hotVenues[0];

    // Count other active venues in the same neighborhood
    const sameNeighborhoodActive = hotVenues.filter(
      (v) => v.venue.neighborhood === top.venue.neighborhood
    ).length;

    // Build human-readable reason fragments
    const reasonParts: string[] = [];
    if (top.liveCount > 0) {
      reasonParts.push(`${top.liveCount} deal${top.liveCount !== 1 ? "s" : ""} live now`);
    } else if (top.todayCount > 0) {
      reasonParts.push(`${top.todayCount} deal${top.todayCount !== 1 ? "s" : ""} tonight`);
    }
    if (top.hasEvents) reasonParts.push("event tonight");
    if (sameNeighborhoodActive > 1) {
      reasonParts.push(`${sameNeighborhoodActive} venues popping in ${top.venue.neighborhood}`);
    }

    const topDealPrice = top.topDeal ? getDealMinPrice(top.topDeal.description) : null;

    return {
      venue: top.venue,
      vibe: top.vibe,
      topDeal: top.topDeal,
      liveCount: top.liveCount,
      sameNeighborhoodActive,
      reason: reasonParts.join(" · "),
      priceFrom: topDealPrice,
    };
  })();

  // ── Neighborhood Pulse — ranked areas by live + today activity ───────────────
  const neighborhoodPulse = (() => {
    if (activeNeighborhood !== "All Tampa") return []; // already filtered, no need
    const map = new Map<string, { liveCount: number; dealCount: number; venueIds: Set<string> }>();
    displayDeals.forEach((d) => {
      const n = d.venue.neighborhood;
      if (!map.has(n)) map.set(n, { liveCount: 0, dealCount: 0, venueIds: new Set() });
      const entry = map.get(n)!;
      entry.dealCount++;
      entry.venueIds.add(d.venueId);
      if (d.countdownLabel.includes("left")) entry.liveCount++;
    });
    return [...map.entries()]
      .map(([name, data]) => ({
        name,
        liveCount: data.liveCount,
        dealCount: data.dealCount,
        venueCount: data.venueIds.size,
        score: data.liveCount * 5 + data.dealCount,
      }))
      .filter((n) => n.dealCount > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  })();

  return (
    <main className="dashboard dashboard-mobile-app">

      {/* ── COMPACT HERO (always visible) ── */}
      <section className="discover-hero">
        <div className="discover-hero-filters">
          <div className="day-filter-rail" ref={dayRailRef}>
            <button
              className={`day-chip ${activeDay === "All" ? "day-chip-active" : ""}`}
              type="button"
              onClick={() => setActiveDay("All")}
            >
              All days
            </button>
            {ALL_DAYS.map((d) => (
              <button
                key={d}
                className={`day-chip ${activeDay === d ? "day-chip-active" : ""}`}
                type="button"
                onClick={() => setActiveDay(d)}
              >
                {d}
                {d === todayShort && <span className="day-chip-today-badge">today</span>}
              </button>
            ))}
          </div>
          <div className="chip-row promo-neighborhood-row">
            {liveNeighborhoods.map((zone) => (
              <button
                className={`location-chip ${zone === activeNeighborhood ? "location-chip-active" : ""}`}
                key={zone}
                type="button"
                onClick={() => setActiveNeighborhood(zone)}
              >
                {zone}
                <span className="nbhd-chip-count">{neighborhoodDealCounts[zone] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="discover-hero-search-wrap">
          <div className={`discover-hero-search ${searchFocused ? "discover-hero-search-focused" : ""}`}>
            <span className="discover-search-icon">⌕</span>
            <input
              className="discover-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bars, deals, neighborhoods…"
              onFocus={() => {
                if (searchBlurTimer.current) clearTimeout(searchBlurTimer.current);
                setSearchFocused(true);
              }}
              onBlur={() => {
                searchBlurTimer.current = setTimeout(() => setSearchFocused(false), 150);
              }}
            />
            {query && (
              <button className="discover-search-clear" type="button" onClick={() => { setQuery(""); setSearchFocused(false); }}>×</button>
            )}
          </div>
          {searchSuggestions.length > 0 && (
            <div className="search-suggestions">
              {!query && <p className="search-suggestions-label">Quick searches</p>}
              {searchSuggestions.map((s, i) => (
                <button
                  key={`${s.kind}-${s.label}-${i}`}
                  className="search-suggestion-item"
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // keep focus during click
                  onClick={() => {
                    if (s.kind === "neighborhood") {
                      setActiveNeighborhood(s.label);
                      setQuery("");
                    } else {
                      setQuery(s.label);
                    }
                    setSearchFocused(false);
                    setDiscoverTab("deals");
                  }}
                >
                  <span className="search-suggestion-icon">
                    {s.kind === "venue" ? "🏠" : s.icon ?? "🔍"}
                  </span>
                  <span className="search-suggestion-text">
                    <span className="search-suggestion-label">{s.label}</span>
                    {s.sub && <span className="search-suggestion-sub">{s.sub}</span>}
                  </span>
                  <span className="search-suggestion-kind">{s.kind}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── IN-PAGE TAB BAR ── */}
      <div className="discover-tab-bar">
        <button
          className={`discover-tab ${discoverTab === "deals" ? "discover-tab-active" : ""}`}
          type="button"
          onClick={() => setDiscoverTab("deals")}
        >
          🥤 Deals
          <span className="discover-tab-count">{filteredDeals.length}</span>
        </button>
        <button
          className={`discover-tab ${discoverTab === "tonight" ? "discover-tab-active" : ""}`}
          type="button"
          onClick={() => setDiscoverTab("tonight")}
        >
          🌙 Tonight
          {liveNowDeals.length > 0 && <span className="discover-tab-live" />}
          {planVenueIds.size > 0 && <span className="discover-tab-plan-count">{planVenueIds.size}</span>}
        </button>
        <button
          className={`discover-tab ${discoverTab === "explore" ? "discover-tab-active" : ""}`}
          type="button"
          onClick={() => setDiscoverTab("explore")}
        >
          🗺️ Explore
        </button>
      </div>

      {/* ── Live deal banner (shown on Deals + Explore tabs) ── */}
      {liveNowDeals.length > 0 && discoverTab !== "tonight" && (
        <button
          className="discover-live-banner"
          type="button"
          onClick={() => setDiscoverTab("tonight")}
        >
          <span className="live-now-pulse" />
          <span>{liveNowDeals.length} deal{liveNowDeals.length !== 1 ? "s" : ""} live right now in Tampa</span>
          <span className="discover-live-banner-arrow">See live →</span>
        </button>
      )}

      {/* ══════════════ DEALS TAB ══════════════ */}
      {discoverTab === "deals" && (
        <>
          {recentVenueIds.length >= 2 && (() => {
            const recentVenues = recentVenueIds
              .map((id) => {
                const venue = mapVenues.find((v) => v.id === id);
                if (!venue) return null;
                const venueDeals = displayDeals.filter((d) => d.venueId === id);
                const liveCount = venueDeals.filter((d) => d.countdownLabel.includes("left")).length;
                const vibe = venueVibeMap.get(id);
                return { venue, dealCount: venueDeals.length, liveCount, vibe };
              })
              .filter(Boolean)
              .slice(0, 5) as Array<{ venue: typeof mapVenues[number]; dealCount: number; liveCount: number; vibe: ReturnType<typeof venueVibeMap.get> }>;
            if (recentVenues.length === 0) return null;
            return (
              <section className="mobile-section-card recent-venues-section">
                <p className="section-label">Recently viewed</p>
                <div className="recent-venues-rail">
                  {recentVenues.map(({ venue, dealCount, liveCount, vibe }) => (
                    <Link key={venue.id} className="recent-venue-chip" to={`/venues/${venue.id}`}>
                      <span className="recent-venue-name">{venue.name}</span>
                      <span className="recent-venue-meta">
                        {dealCount} deal{dealCount !== 1 ? "s" : ""}
                        {liveCount > 0 && <span className="recent-venue-live"> · live</span>}
                        {vibe && vibe.cls !== "vibe-chill" && ` ${vibe.icon}`}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })()}
          {startingSoonRail.length > 0 && (
            <section className="mobile-section-card starting-soon-section">
              <div className="starting-soon-header">
                <span className="starting-soon-dot" />
                <p className="section-label starting-soon-label">Starting soon</p>
                <span className="starting-soon-count">{startingSoonRail.length}</span>
              </div>
              <div className="starting-soon-rail">
                {startingSoonRail.map((deal) => (
                  <Link key={deal.id} className="soon-chip" to={`/venues/${deal.venue.id}`}>
                    <span className="soon-chip-time">{deal.countdownLabel.replace("Starts in ", "")}</span>
                    <span className="soon-chip-name">{deal.venue.name}</span>
                    <span className="soon-chip-meta">{deal.venue.neighborhood} · {deal.time}</span>
                    {deal.priceLabel && <span className="soon-chip-price">{deal.priceLabel}</span>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {lastCallDeals.length > 0 && (
            <section className="mobile-section-card last-call-section">
              <div className="last-call-header">
                <span className="last-call-pulse" />
                <span className="last-call-title">🚨 Last call</span>
                <span className="last-call-sub">Ending in 30 min or less</span>
              </div>
              <div className="last-call-rail">
                {lastCallDeals.map((deal) => {
                  const mins = parseLiveMinutes(deal.countdownLabel)!;
                  return (
                    <Link key={`lc-${deal.id}`} className="last-call-card" to={`/venues/${deal.venue.id}`}>
                      <div className="last-call-card-top">
                        <span className="last-call-timer">{deal.countdownLabel}</span>
                        <span className="last-call-neighborhood">{deal.venue.neighborhood}</span>
                      </div>
                      <p className="last-call-venue">{deal.venue.name}</p>
                      <p className="last-call-deal">{deal.description.slice(0, 55)}{deal.description.length > 55 ? "…" : ""}</p>
                      {mins <= 10 && <span className="last-call-urgent-badge">⚡ {mins}m left!</span>}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <section className="mobile-section-card">
            <div className="deals-tab-context">
              <span className="deals-tab-count">
                {filteredDeals.length} deal{filteredDeals.length !== 1 ? "s" : ""}
              </span>
              <span className="deals-tab-filter">
                {activeDay !== "All" ? `${DAY_LONG[activeDay] ?? activeDay}` : "All days"}
                {activeNeighborhood !== "All Tampa" ? ` · ${activeNeighborhood}` : ""}
                {activeFilter !== "All deals" ? ` · ${activeFilter}` : ""}
                {activeBudget ? ` · Under $${activeBudget}` : ""}
              </span>
              {(activeDay !== todayShort || activeNeighborhood !== "All Tampa" || activeFilter !== "All deals" || activeBudget !== null || liveOnlyFilter) && (
                <button
                  className="deals-tab-reset"
                  type="button"
                  onClick={() => { setActiveDay(todayShort); setActiveNeighborhood("All Tampa"); setActiveFilter("All deals"); setActiveBudget(null); setQuery(""); setLiveOnlyFilter(false); }}
                >
                  Reset
                </button>
              )}
            </div>
            <div className="icon-rail">
              <button
                className={`icon-rail-card ${activeFilter === "All deals" ? "icon-rail-card-active" : ""}`}
                type="button"
                onClick={() => setActiveFilter("All deals")}
              >
                <span className="icon-rail-badge">✨</span>
                <span>All</span>
              </button>
              {specialsRail.map((item) => (
                <button
                  key={item.label}
                  className={`icon-rail-card ${activeFilter === item.filter ? "icon-rail-card-active" : ""}`}
                  type="button"
                  onClick={() => setActiveFilter(item.filter)}
                >
                  <span className="icon-rail-badge">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="budget-chip-row">
              <button
                className={`budget-chip ${activeBudget === null ? "budget-chip-active" : ""}`}
                type="button"
                onClick={() => setActiveBudget(null)}
              >
                Any price
              </button>
              {([5, 10, 20] as const).map((max) => (
                <button
                  key={max}
                  className={`budget-chip ${activeBudget === max ? "budget-chip-active" : ""}`}
                  type="button"
                  onClick={() => setActiveBudget(activeBudget === max ? null : max)}
                >
                  Under ${max}
                  {budgetCounts[max] > 0 && (
                    <span className="budget-chip-count">{budgetCounts[max]}</span>
                  )}
                </button>
              ))}
            </div>

            {liveNowCount > 0 && (
              <div className="live-filter-row">
                <button
                  className={`live-filter-btn ${liveOnlyFilter ? "live-filter-btn-active" : ""}`}
                  type="button"
                  onClick={() => setLiveOnlyFilter((v) => !v)}
                >
                  <span className="live-filter-dot" />
                  Live now
                  <span className="live-filter-count">{liveNowCount}</span>
                </button>
              </div>
            )}

            <div className="mobile-deal-stack">
              {mobileFeaturedDeals.length > 0 ? mobileFeaturedDeals.map((deal) => {
                const vibe = venueVibeMap.get(deal.venue.id);
                return (
                <article className="mobile-live-deal-card" key={`mobile-live-${deal.id}`}>
                  <div className="mobile-live-deal-head">
                    <div className="mobile-live-venue-info">
                      <div className="mobile-live-top-row">
                        <div className="mobile-live-top-left">
                          <span className="mobile-live-neighborhood">{deal.venue.neighborhood}</span>
                          {vibe && vibe.cls !== "vibe-chill" && (
                            <span className={`deal-vibe-badge ${vibe.cls}`}>{vibe.icon} {vibe.label}</span>
                          )}
                        </div>
                        <div className="mobile-live-top-right">
                          {dealDistanceMi && (
                            <span className="mobile-live-dist-badge">
                              {(() => { const mi = dealDistanceMi(deal.venue.latitude, deal.venue.longitude); return mi < 0.1 ? "< 0.1 mi" : `${mi.toFixed(1)} mi`; })()}
                            </span>
                          )}
                          <span className={`mobile-live-countdown-badge ${getCountdownVariant(deal.countdownLabel)}`}>
                            {deal.countdownLabel}
                          </span>
                        </div>
                      </div>
                      <Link className="deal-card-link mobile-live-name" to={`/venues/${deal.venue.id}`}>
                        <h4>{deal.venue.name}</h4>
                      </Link>
                    </div>
                  </div>
                  <div className="mobile-live-deal-body">
                    <span className="mobile-live-cat-icon">{getCategoryEmoji(deal.category)}</span>
                    <div className="mobile-live-deal-content">
                      <p className="mobile-live-meta">{deal.category} · {deal.day} · {deal.time}</p>
                      <p className="deal-copy">{deal.description}</p>
                    </div>
                  </div>
                  <div className="mobile-live-footer">
                    <div className="chip-row tight">
                      {deal.priceLabel ? <span className="micro-chip">{deal.priceLabel}</span> : null}
                      <span className="micro-chip">{deal.sourceKindLabel}</span>
                    </div>
                    <div className="mobile-live-footer-right">
                      <button
                        className={`deal-checkin-btn ${hasCheckedInRecently(deal.venue.id) ? "deal-checkin-done" : ""}`}
                        type="button"
                        onClick={(e) => { e.preventDefault(); handleDealCheckIn(deal); }}
                        disabled={hasCheckedInRecently(deal.venue.id)}
                        title={hasCheckedInRecently(deal.venue.id) ? "Already checked in" : "Check in here (+50 pts)"}
                      >
                        {checkInFlashId === deal.venue.id ? "✓ +50!" : hasCheckedInRecently(deal.venue.id) ? "✓" : "📍"}
                      </button>
                      <button
                        className={`deal-plan-btn ${planVenueIds.has(deal.venue.id) ? "deal-plan-btn-added" : ""}`}
                        type="button"
                        onClick={(e) => { e.preventDefault(); addToPlan(deal); }}
                        title={planVenueIds.has(deal.venue.id) ? "In tonight's plan" : "Add to tonight's plan"}
                      >
                        {planFlashId === deal.venue.id ? "✓ Added!" : planVenueIds.has(deal.venue.id) ? "🍻 In plan" : "+ Plan"}
                      </button>
                      <Link className="mobile-live-view-btn" to={`/venues/${deal.venue.id}`}>View →</Link>
                    </div>
                  </div>
                </article>
                );
              }) : (
                <div className="discover-empty-state">
                  <p>No deals match your filters.</p>
                  <button type="button" className="day-chip day-chip-active" onClick={() => { setActiveFilter("All deals"); setActiveDay("All"); setActiveNeighborhood("All Tampa"); setActiveBudget(null); setQuery(""); }}>
                    Clear filters
                  </button>
                </div>
              )}
              {filteredDeals.length > 12 && (
                <Link className="mobile-deals-see-all" to="/venues">
                  See all {filteredDeals.length} deals →
                </Link>
              )}
            </div>
          </section>
        </>
      )}

      {/* ══════════════ TONIGHT TAB ══════════════ */}
      {discoverTab === "tonight" && (
        <>
          {/* Tonight's Best Bet */}
          {bestBet && (
            <section className="mobile-section-card best-bet-section">
              <div className="best-bet-header">
                <span className="best-bet-kicker">✨ Tonight's best bet</span>
                {bestBet.priceFrom && (
                  <span className="best-bet-price">from ${bestBet.priceFrom}</span>
                )}
              </div>
              <div className="best-bet-card">
                <div className="best-bet-card-top">
                  <div className="best-bet-card-meta">
                    <span className="best-bet-neighborhood">{bestBet.venue.neighborhood}</span>
                    {bestBet.vibe && (
                      <span className={`best-bet-vibe-pill ${bestBet.vibe.cls}`}>
                        {bestBet.vibe.icon} {bestBet.vibe.label}
                      </span>
                    )}
                  </div>
                  <Link className="best-bet-venue-name" to={`/venues/${bestBet.venue.id}`}>
                    {bestBet.venue.name}
                  </Link>
                  {bestBet.topDeal && (
                    <p className="best-bet-deal-time">{bestBet.topDeal.time}</p>
                  )}
                </div>
                {bestBet.topDeal && (
                  <p className="best-bet-deal-desc">
                    {bestBet.topDeal.description.slice(0, 90)}{bestBet.topDeal.description.length > 90 ? "…" : ""}
                  </p>
                )}
                {bestBet.reason && (
                  <p className="best-bet-reason">
                    <span className="best-bet-reason-dot" />
                    {bestBet.reason}
                  </p>
                )}
                <div className="best-bet-actions">
                  <Link className="best-bet-view-btn" to={`/venues/${bestBet.venue.id}`}>
                    View venue →
                  </Link>
                  <button
                    className={`best-bet-plan-btn ${planVenueIds.has(bestBet.venue.id) ? "best-bet-plan-btn-added" : ""}`}
                    type="button"
                    onClick={() => bestBet.topDeal && addToPlan(bestBet.topDeal)}
                  >
                    {planVenueIds.has(bestBet.venue.id) ? "🍻 In plan" : "+ Add to plan"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Neighborhood Pulse */}
          {neighborhoodPulse.length > 0 && (
            <section className="mobile-section-card neighborhood-pulse-section">
              <div className="pulse-header">
                <div>
                  <p className="section-label">Neighborhood pulse</p>
                  <h3 className="pulse-title">Where's it popping?</h3>
                </div>
                <span className="pulse-sub">Tap to filter</span>
              </div>
              <div className="pulse-rail">
                {neighborhoodPulse.map(({ name, liveCount, dealCount, venueCount }) => (
                  <button
                    key={name}
                    className={`pulse-card ${liveCount > 0 ? "pulse-card-live" : ""}`}
                    type="button"
                    onClick={() => { setActiveNeighborhood(name); setDiscoverTab("deals"); }}
                  >
                    {liveCount > 0 ? (
                      <span className="pulse-card-live-row">
                        <span className="hoppy-live-dot" />{liveCount} live now
                      </span>
                    ) : (
                      <span className="pulse-card-quiet-row">{dealCount} deals</span>
                    )}
                    <p className="pulse-card-name">{name}</p>
                    <p className="pulse-card-stats">{venueCount} spot{venueCount !== 1 ? "s" : ""}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* What's Popping */}
          <section className="mobile-section-card whats-popping-section">
            <div className="popping-header">
              <div className="popping-title-row">
                <span className="live-now-pulse" />
                <p className="section-label">What&apos;s Popping</p>
              </div>
              <span className="popping-sipper-count">{totalSipSaversOut} out tonight</span>
            </div>
            <h3 className="popping-feed-title">Live activity in Tampa 🌆</h3>

            {activePlan && activePlan.stops.length > 0 && (
              <div className="popping-my-plan-banner">
                <span className="popping-plan-icon">🍻</span>
                <div>
                  <p className="popping-plan-label">Your plan: {activePlan.name}</p>
                  <p className="popping-plan-meta">{activePlan.stops.length} stop{activePlan.stops.length !== 1 ? "s" : ""} · {activePlan.startTime}</p>
                </div>
                <Link className="popping-plan-link" to="/hoppy">View →</Link>
              </div>
            )}

            <div className="activity-feed-list">
              {activityFeed.map((item) => {
                const linkedVenue = mapVenues.find((v) => v.name === item.venueName);
                const inner = (
                  <>
                    <div className="activity-avatar">
                      {item.isRealUser ? "⭐" : item.userName?.[0] ?? "?"}
                    </div>
                    <div className="activity-body">
                      <p className="activity-venue-name">
                        {item.venueName}
                        <span className="activity-neighborhood"> · {item.neighborhood}</span>
                      </p>
                      {item.dealDesc && <p className="activity-deal-desc">{item.dealDesc}</p>}
                      <p className="activity-meta">{item.isRealUser ? "You" : item.userName} checked in · {item.ago}</p>
                    </div>
                    <span className="activity-type-icon">›</span>
                  </>
                );
                return linkedVenue ? (
                  <Link
                    className={`activity-item activity-item-link ${item.isRealUser ? "activity-item-you" : ""}`}
                    key={item.id}
                    to={`/venues/${linkedVenue.id}`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className={`activity-item ${item.isRealUser ? "activity-item-you" : ""}`} key={item.id}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Hot right now */}
          {hotVenues.length > 0 && (
            <section className="mobile-section-card hot-venues-section">
              <div className="hot-venues-header">
                <p className="section-label">🔥 Hot right now</p>
                <span className="hot-venues-sub">Most active tonight</span>
              </div>
              <div className="hot-venues-rail">
                {hotVenues.map(({ venue, liveCount, todayCount, topDeal, vibe }) => (
                  <Link key={venue.id} className="hot-venue-card" to={`/venues/${venue.id}`}>
                    <div className="hot-venue-card-top">
                      <span className="hot-venue-neighborhood">{venue.neighborhood}</span>
                      {vibe && vibe.cls !== "vibe-chill" && (
                        <span className={`hot-venue-vibe ${vibe.cls}`}>{vibe.icon}</span>
                      )}
                    </div>
                    <p className="hot-venue-name">{venue.name}</p>
                    <p className="hot-venue-stats">
                      {todayCount > 0 ? `${todayCount} deal${todayCount !== 1 ? "s" : ""} today` : "Deals available"}
                      {liveCount > 0 && <span className="hot-venue-live"> · {liveCount} live</span>}
                    </p>
                    {topDeal && (
                      <p className="hot-venue-deal">{topDeal.description.slice(0, 52)}{topDeal.description.length > 52 ? "…" : ""}</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {nearYouDeals.length > 0 && dealDistanceMi && (
            <section className="mobile-section-card near-you-section">
              <div className="near-you-header">
                <span className="near-you-title">📍 Near you</span>
                <span className="near-you-sub">Closest venues with deals</span>
              </div>
              <div className="near-you-rail">
                {nearYouDeals.map((deal) => {
                  const mi = dealDistanceMi(deal.venue.latitude, deal.venue.longitude);
                  const miLabel = mi < 0.1 ? "< 0.1 mi" : `${mi.toFixed(1)} mi`;
                  return (
                    <Link key={`ny-${deal.id}`} className="near-you-card" to={`/venues/${deal.venue.id}`}>
                      <div className="near-you-card-top">
                        <span className="near-you-dist">{miLabel}</span>
                        <span className="near-you-neighborhood">{deal.venue.neighborhood}</span>
                      </div>
                      <p className="near-you-name">{deal.venue.name}</p>
                      <p className="near-you-deal">{deal.time} · {deal.description.slice(0, 48)}{deal.description.length > 48 ? "…" : ""}</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {(liveNowDeals.length > 0 || startingSoonDeals.length > 0) && (
            <section className="mobile-section-card live-now-section">
              <div className="live-now-header">
                <div className="live-now-pulse-wrap">
                  <span className="live-now-pulse" />
                  <span className="live-now-title">
                    {liveNowDeals.length > 0 ? "Live right now" : "Up next"}
                  </span>
                </div>
                <span className="live-now-time">{dayLabel} · {timeLabel}</span>
              </div>
              {(() => {
                const shownDeals = liveNowDeals.length > 0 ? liveNowDeals : startingSoonDeals;
                const totalLive = liveNowDeals.length > 0
                  ? displayDeals.filter(d => d.countdownLabel.includes("left") && (activeNeighborhood === "All Tampa" || d.venue.neighborhood === activeNeighborhood)).length
                  : startingSoonDeals.length;
                return (
                  <>
                    <div className="live-now-rail">
                      {shownDeals.map((deal) => (
                        <Link key={`live-${deal.id}`} className="live-now-card" to={`/venues/${deal.venue.id}`}>
                          <div className="live-now-card-top">
                            <span className="live-now-card-neighborhood">{deal.venue.neighborhood}</span>
                            <span className={`live-now-card-badge ${deal.countdownLabel.includes("left") ? "live-now-badge-green" : "live-now-badge-amber"}`}>
                              {deal.countdownLabel}
                            </span>
                          </div>
                          <p className="live-now-card-name">{deal.venue.name}</p>
                          <p className="live-now-card-deal">{deal.description}</p>
                        </Link>
                      ))}
                    </div>
                    {totalLive > 4 && (
                      <Link className="live-now-see-more" to="/venues">
                        +{totalLive - 4} more live right now →
                      </Link>
                    )}
                  </>
                );
              })()}
            </section>
          )}

          {tonightWindows.length > 0 && (
            <section className="mobile-section-card tonight-windows-section">
              <div className="panel-heading">
                <div>
                  <p className="section-label">Today's schedule</p>
                  <h3 className="panel-title">Deal windows for {todayLong}</h3>
                </div>
              </div>
              <div className="tonight-window-list">
                {tonightWindows.map((w) => (
                  <div className="tonight-window-row" key={w.label}>
                    <span className="tonight-window-time">{w.label}</span>
                    <span className="tonight-window-venues">
                      {w.venues.slice(0, 2).join(", ")}
                      {w.venues.length > 2 ? ` +${w.venues.length - 2} more` : ""}
                    </span>
                    <span className="tonight-window-count">{w.count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {bestTimeWindow && (
            <section className="mobile-section-card best-window-card">
              <div className="best-window-inner">
                <div className="best-window-left">
                  <p className="best-window-kicker">🕐 Best time to go out</p>
                  <p className="best-window-time">{bestTimeWindow.label}</p>
                  <p className="best-window-sub">
                    {bestTimeWindow.count} deal{bestTimeWindow.count !== 1 ? "s" : ""} active
                    {bestTimeWindow.venues.length > 0 && ` · ${bestTimeWindow.venues.slice(0, 2).join(", ")}${bestTimeWindow.venues.length > 2 ? ` +${bestTimeWindow.venues.length - 2}` : ""}`}
                  </p>
                </div>
                <button
                  className="best-window-cta"
                  type="button"
                  onClick={() => { setDiscoverTab("deals"); setActiveDay(todayShort); }}
                >
                  See deals →
                </button>
              </div>
            </section>
          )}

          {!(liveNowDeals.length > 0 || startingSoonDeals.length > 0) && tonightWindows.length === 0 && (
            <section className="mobile-section-card">
              <div className="discover-empty-state">
                <p>🌙 No active deals right now. Check back later or browse all deals.</p>
                <button type="button" className="day-chip day-chip-active" onClick={() => setDiscoverTab("deals")}>
                  Browse deals
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {/* ══════════════ EXPLORE TAB ══════════════ */}
      {discoverTab === "explore" && (
        <>
          <section className="mobile-section-card mobile-map-section">
            <div className="map-header">
              <p>Bars &amp; restaurants</p>
              <Link className="inline-panel-link" to="/venues">Show all →</Link>
            </div>
            <TampaMap venues={nearbyVenues} activeNeighborhood={activeNeighborhood} venueActivity={nearbyVenueActivity} />
            <div className="nearby-card-row">
              {nearbyDeals.map((deal) => (
                <article className="nearby-deal-card" key={`nearby-${deal.id}`}>
                  <div className="nearby-deal-cover">
                    <span className="nearby-deal-chip">{deal.venue.neighborhood}</span>
                  </div>
                  <div className="nearby-deal-body">
                    <Link className="deal-card-link" to={`/venues/${deal.venue.id}`}>
                      <h4>{deal.venue.name}</h4>
                    </Link>
                    <p className="nearby-deal-meta">{deal.category} · {deal.time}</p>
                    <p className="deal-copy">{deal.description}</p>
                    <div className="nearby-deal-footer">
                      <span className={deal.countdownLabel.includes("left") ? "nearby-countdown-live" : ""}>{deal.countdownLabel}</span>
                      <Link className="inline-panel-link" to={`/venues/${deal.venue.id}`}>View →</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mobile-section-card">
            <div className="panel-heading">
              <div>
                <p className="section-label">Events &amp; vibes</p>
                <h3 className="panel-title">What do you feel like?</h3>
              </div>
            </div>
            <div className="icon-rail icon-rail-events">
              {eventRail.map((item) => (
                <button
                  key={item.label}
                  className="icon-rail-card icon-rail-card-event"
                  type="button"
                  onClick={() => {
                    if (item.filter) {
                      setActiveFilter(item.filter);
                      setQuery("");
                    } else if (item.search) {
                      setQuery(item.search);
                      setActiveFilter("All deals");
                    }
                    setDiscoverTab("deals");
                  }}
                >
                  <span className="icon-rail-badge icon-rail-badge-event">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="mobile-section-card">
            <div className="panel-heading">
              <div>
                <p className="section-label">Neighborhoods</p>
                <h3 className="panel-title">Where the action is</h3>
              </div>
            </div>
            <div className="neighborhood-board-grid">
              {neighborhoodBoards.map((zone) => (
                <article className="neighborhood-board-card" key={zone.name}>
                  <div className="zone-card-top">
                    <button
                      className="neighborhood-board-name-btn"
                      type="button"
                      onClick={() => {
                        setActiveNeighborhood(zone.name);
                        setActiveFilter("All deals");
                        setDiscoverTab("deals");
                      }}
                    >
                      {zone.name} →
                    </button>
                    <span>{zone.vibe}</span>
                  </div>
                  <p className="board-meta">
                    {zone.venueCount} venues · {zone.dealCount} deals{zone.liveCount > 0 ? ` · ${zone.liveCount} live` : ""}
                  </p>
                  <div className="chip-row tight">
                    {zone.topDeals.length > 0 ? (
                      zone.topDeals.map((deal) => (
                        <Link className="micro-chip board-chip-link" key={deal.id} to={`/venues/${deal.venue.id}`}>
                          {deal.venue.name}
                        </Link>
                      ))
                    ) : (
                      <span className="micro-chip">Still filling in</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mobile-section-card">
            <div className="panel-heading">
              <div>
                <p className="section-label">Budget friendly</p>
                <h3 className="panel-title">Deals under $6</h3>
              </div>
            </div>
            <div className="budget-list">
              {budgetBoard.map((deal) => (
                <Link className="budget-card" key={`budget-${deal.id}`} to={`/venues/${deal.venue.id}`}>
                  <span className="budget-card-icon">{deal.category === "Food" ? "🍔" : "🍸"}</span>
                  <div className="budget-card-copy">
                    <strong>{deal.description}</strong>
                    <span>{deal.venue.name} • {deal.venue.neighborhood}</span>
                  </div>
                  <div className="budget-card-meta">
                    <strong>{deal.time}</strong>
                    <span>{deal.freshnessLabel}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="content-grid">
        <div className="main-column">
          <section className="panel desktop-only-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Featured deals</p>
                <h3 className="panel-title">What Tampa is drinking on right now</h3>
              </div>
              <p className="panel-caption">{filteredDeals.length} deals in view</p>
            </div>

            <FilterBar activeFilter={activeFilter} filters={dealCategories} onChange={setActiveFilter} />

            {filteredDeals.length > 0 ? (
              <div className="app-deal-grid">
                {filteredDeals.map((deal) => (
                  <article className="app-deal-card" key={deal.id}>
                    <div className="deal-card-header">
                      <span className="deal-tagline">{deal.tag}</span>
                      <span className="deal-neighborhood">{deal.venue.neighborhood}</span>
                    </div>
                    <Link className="deal-card-link" to={`/venues/${deal.venue.id}`}>
                      <h4>{deal.venue.name}</h4>
                    </Link>
                    <p className="deal-window">
                      {deal.day} • {deal.time}
                    </p>
                    <p className="deal-copy">{deal.description}</p>
                    <div className="deal-badge-row">
                      <span className="micro-chip">{deal.trustLabel}</span>
                      <span className="micro-chip">{deal.freshnessLabel}</span>
                      <span className="micro-chip">{deal.sourceKindLabel}</span>
                    </div>
                    <p className="deal-source-line">{deal.sourceLabel}</p>
                    <div className="deal-footer">
                      <span>{deal.category}</span>
                      <Link className="inline-panel-link" to={`/venues/${deal.venue.id}`}>
                        Open venue
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h4>No deals match that search yet</h4>
                <p>Try a different neighborhood or a broader term like happy hour, brunch, or trivia.</p>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Fresh from sources</p>
                <h3 className="panel-title">The newest hits worth checking first</h3>
              </div>
              <p className="panel-caption">{sourceSpotlights.length} source-backed cards</p>
            </div>

            <div className="source-spotlight-grid">
              {sourceSpotlights.map((deal) => (
                <article className="source-spotlight-card" key={`spotlight-${deal.id}`}>
                  <div className="deal-card-header">
                    <span className="deal-tagline">{deal.sourceKindLabel}</span>
                    <span className="deal-neighborhood">{deal.venue.neighborhood}</span>
                  </div>
                  <Link className="deal-card-link" to={`/venues/${deal.venue.id}`}>
                    <h4>{deal.venue.name}</h4>
                  </Link>
                  <p className="deal-window">
                    {deal.day} • {deal.time}
                  </p>
                  <p className="deal-copy">{deal.description}</p>
                  <p className="preview-source">{deal.sourceLabel}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Neighborhood boards</p>
                <h3 className="panel-title">Where the real density is building</h3>
              </div>
            </div>

            <div className="neighborhood-board-grid">
              {neighborhoodBoards.map((zone) => (
                <article className="neighborhood-board-card" key={zone.name}>
                  <div className="zone-card-top">
                    <h4>{zone.name}</h4>
                    <span>{zone.vibe}</span>
                  </div>
                  <p className="board-meta">
                    {zone.venueCount} venues • {zone.dealCount} deals{zone.liveCount > 0 ? ` • ${zone.liveCount} live now` : ""}
                  </p>
                  <div className="chip-row tight">
                    {zone.topDeals.length > 0 ? (
                      zone.topDeals.map((deal) => (
                        <Link className="micro-chip board-chip-link" key={deal.id} to={`/venues/${deal.venue.id}`}>
                          {deal.venue.name}
                        </Link>
                      ))
                    ) : (
                      <span className="micro-chip">Still filling in</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Tonight’s extras</p>
                <h3 className="panel-title">Events worth building a night around</h3>
              </div>
            </div>

            <div className="event-stack">
              {tonightEvents.map((event) => {
                const venue = getVenueById(event.venueId);

                return (
                  <article className="event-row" key={event.id}>
                    <div className="event-icon">{event.type === "Live music" ? "♪" : "?"}</div>
                    <div>
                      <p className="event-label">{event.type}</p>
                      <h4>{event.title}</h4>
                      <p className="event-copy">
                        {venue.name} • {venue.neighborhood} • {event.time}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Just added</p>
                <h3 className="panel-title">New places showing live deal potential</h3>
              </div>
              <p className="panel-caption">{justAddedPlaces.length} prospects surfaced</p>
            </div>

            <div className="zone-stack">
              {justAddedPlaces.length > 0 ? (
                justAddedPlaces.map((deal) => (
                  <article className="zone-card" key={`added-${deal.id}`}>
                    <div className="zone-card-top">
                      <h4>{deal.venue.name}</h4>
                      <span>{deal.venue.neighborhood}</span>
                    </div>
                    <p>{deal.description}</p>
                    <Link className="inline-panel-link" to={`/venues/${deal.venue.id}`}>
                      Open venue page
                    </Link>
                  </article>
                ))
              ) : (
                <article className="zone-card">
                  <p>Prospect deals will land here as we keep scraping and importing new Tampa spots.</p>
                </article>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Neighborhoods</p>
                <h3 className="panel-title">Start where the density is best</h3>
              </div>
              <p className="panel-caption">
                {importedPlacesFile.placeCount > 0
                  ? `${importedPlacesFile.placeCount} imported places`
                  : "Using seeded venues"}
              </p>
            </div>
            <div className="zone-stack">
              {tampaNeighborhoods.map((zone) => (
                <article className="zone-card" key={zone.name}>
                  <div className="zone-card-top">
                    <h4>{zone.name}</h4>
                    <span>{zone.vibe}</span>
                  </div>
                  <p>{zone.reason}</p>
                  <div className="chip-row tight">
                    {zone.quickHits.map((hit) => (
                      <span className="micro-chip" key={hit.venue}>
                        {hit.label}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <Link className="inline-panel-link" to="/venues">
              Browse all venues
            </Link>
          </section>

          <section className="panel panel-dark">
            <div className="panel-heading">
              <div>
                <p className="section-label section-label-light">For operators</p>
                <h3 className="panel-title panel-title-light">Review queue</h3>
              </div>
              <p className="panel-caption panel-caption-light">{visibleReviewItems.length} live signals waiting</p>
            </div>
            <p className="queue-footnote">
              {prospectReviewItems.length} from newly discovered places • {importedReviewItems.length} from seeded sites
            </p>
            <ReviewQueue items={visibleReviewItems.slice(0, 4)} />
            <Link className="inline-panel-link inline-panel-link-light" to="/operators">
              Open operator tools
            </Link>
          </section>

          <section className="panel compact-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Live data sync</p>
                <h3 className="panel-title">What we’ve linked so far</h3>
              </div>
              <p className="panel-caption">{importedPlaceMatchesFile.matchedCount} matched</p>
            </div>

            <div className="match-stat-grid">
              <article className="match-stat-card">
                <span>Confirmed</span>
                <strong>{importedPlaceMatchesFile.matchedCount}</strong>
                <p>Seed venues connected to real Google place records.</p>
              </article>
              <article className="match-stat-card">
                <span>Needs linking</span>
                <strong>{unmatchedSeededVenueMatches.length}</strong>
                <p>Seeded venues still waiting on a clean place match.</p>
              </article>
              <article className="match-stat-card">
                <span>Unclaimed places</span>
                <strong>{importedPlaceMatchesFile.unmatchedCount}</strong>
                <p>Imported Tampa spots we can turn into fresh listings next.</p>
              </article>
            </div>

            <div className="match-list">
              {matchedVenuePairs.slice(0, 3).map(({ venue, place, match }) => (
                <article className="match-row" key={match.venueId}>
                  <div>
                    <p className="match-label">Matched</p>
                    <h4>{venue.name}</h4>
                    <p className="match-copy">
                      Google listing: {place.name} • score {match.matchScore}
                    </p>
                  </div>
                  <span className="match-badge">Live</span>
                </article>
              ))}
            </div>

            <div className="unmatched-list">
              <p className="queue-footnote">Still unresolved</p>
              {unmatchedSeededVenueMatches.slice(0, 3).map((match) => (
                <article className="unmatched-row" key={match.venueId}>
                  <div>
                    <h4>{match.venueName}</h4>
                    <p>
                      Best auto-score: {match.matchScore}
                      {match.reasons.length > 0 ? ` • ${match.reasons.join(", ")}` : ""}
                    </p>
                  </div>
                </article>
              ))}
              {suggestedVenueMatches.length > 0 ? (
                <p className="queue-footnote">
                  {suggestedVenueMatches.length} suggested matches are ready for manual review.
                </p>
              ) : (
                <p className="queue-footnote">
                  No fuzzy suggestions were strong enough yet, which keeps the first pass clean.
                </p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
