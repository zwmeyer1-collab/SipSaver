import type { DisplayDeal } from "./tampaSelectors";
import type { Venue } from "../data/types";

export type CrawlStop = {
  venue: Venue;
  deal: DisplayDeal;
  walkMinutesFromPrev: number | null;
  distanceKmFromPrev: number | null;
};

export type BarCrawl = {
  stops: CrawlStop[];
  totalWalkMinutes: number;
  neighborhood: string;
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function walkMinutes(km: number): number {
  return Math.round((km / 5) * 60);
}

function parseDealStartMinutes(time: string): number {
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!match) return 18 * 60; // default 6pm

  let hours = Number(match[1]) % 12;
  const mins = Number(match[2] ?? "0");
  if (match[3].toUpperCase() === "PM") hours += 12;
  return hours * 60 + mins;
}

export function generateCrawl(
  deals: DisplayDeal[],
  neighborhood: string,
  stopCount: number
): BarCrawl {
  // One best deal per venue, filtered by neighborhood
  const venueMap = new Map<string, DisplayDeal>();
  for (const deal of deals) {
    const neighborhoodMatch = neighborhood === "All Tampa" || deal.venue.neighborhood === neighborhood;
    if (!neighborhoodMatch) continue;
    if (!venueMap.has(deal.venueId)) {
      venueMap.set(deal.venueId, deal);
    }
  }

  let candidates = Array.from(venueMap.values()).filter(
    (d) => d.venue.latitude !== 0 && d.venue.longitude !== 0
  );

  if (candidates.length === 0) return { stops: [], totalWalkMinutes: 0, neighborhood };

  // Sort by deal start time so the route flows chronologically
  candidates.sort(
    (a, b) => parseDealStartMinutes(a.time) - parseDealStartMinutes(b.time)
  );

  // Greedy nearest-neighbor from the first (earliest) venue
  const selected: DisplayDeal[] = [candidates[0]];
  const remaining = candidates.slice(1);

  while (selected.length < stopCount && remaining.length > 0) {
    const last = selected[selected.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(
        last.venue.latitude,
        last.venue.longitude,
        remaining[i].venue.latitude,
        remaining[i].venue.longitude
      );
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  const stops: CrawlStop[] = selected.map((deal, i) => {
    if (i === 0) return { venue: deal.venue, deal, walkMinutesFromPrev: null, distanceKmFromPrev: null };
    const prev = selected[i - 1];
    const km = haversineKm(prev.venue.latitude, prev.venue.longitude, deal.venue.latitude, deal.venue.longitude);
    return { venue: deal.venue, deal, walkMinutesFromPrev: walkMinutes(km), distanceKmFromPrev: km };
  });

  const totalWalkMinutes = stops.reduce((sum, s) => sum + (s.walkMinutesFromPrev ?? 0), 0);

  return { stops, totalWalkMinutes, neighborhood };
}
