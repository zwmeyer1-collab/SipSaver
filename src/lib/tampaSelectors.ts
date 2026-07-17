import { getStoredDeals, getStoredSources, getStoredVenues } from "./dataStore";
import importedPlacesFile from "../../data/ingestion/tampa-places.json";
import importedPlaceMatchesFile from "../../data/ingestion/tampa-place-matches.json";
import importedReviewFile from "../../data/ingestion/tampa-review.json";
import importedProspectReviewFile from "../../data/ingestion/tampa-prospect-review.json";
import importedInstagramReviewFile from "../../data/ingestion/tampa-instagram-review.json";
import type {
  Deal,
  ImportedPlace,
  ImportedPlaceMatchesFile,
  ImportedPlacesFile,
  ImportedReviewItem,
  ReviewQueueItem,
  SourceRecord,
  Venue,
  VenuePlaceMatch,
} from "../data/types";

export type DisplayDeal = Deal & {
  venue: Venue;
  source: SourceRecord;
  trustLabel: string;
  freshnessLabel: string;
  sourceLabel: string;
  sourceKindLabel: string;
  countdownLabel: string;
  priceLabel: string | null;
};

export type VenueProfile = {
  venue: Venue;
  deals: DisplayDeal[];
  sources: SourceRecord[];
};

function inferNeighborhoodFromPlace(place: ImportedPlace): string {
  const bucketText = place.sourceBuckets.join(" ").toLowerCase();
  const addressText = place.address.toLowerCase();
  const combined = `${bucketText} ${addressText}`;

  if (combined.includes("soho") || combined.includes("s howard")) {
    return "SoHo";
  }

  if (combined.includes("seminole heights")) {
    return "Seminole Heights";
  }

  if (combined.includes("armature") || combined.includes("tampa heights")) {
    return "Tampa Heights";
  }

  if (combined.includes("gasworx") || combined.includes("ybor")) {
    return "Ybor";
  }

  if (combined.includes("channel") || combined.includes("channelside")) {
    return "Channelside";
  }

  if (combined.includes("hyde park")) {
    return "Hyde Park";
  }

  if (combined.includes("westshore")) {
    return "Westshore";
  }

  if (combined.includes("downtown")) {
    return "Downtown Tampa";
  }

  return "Tampa";
}

export function getImportedPlacesFile(): ImportedPlacesFile {
  return importedPlacesFile as ImportedPlacesFile;
}

export function getImportedPlaceMatchesFile(): ImportedPlaceMatchesFile {
  return importedPlaceMatchesFile as ImportedPlaceMatchesFile;
}

function getImportedPlaceById(placeId: string): ImportedPlace | undefined {
  return getImportedPlacesFile().places.find((place) => place.id === placeId);
}

export function getImportedVenues(): Venue[] {
  const importedPlaces = getImportedPlacesFile().places;

  return importedPlaces
    .filter((place) => place.latitude !== null && place.longitude !== null)
    .map((place) => ({
      id: `place-${place.id}`,
      name: place.name,
      neighborhood: inferNeighborhoodFromPlace(place),
      city: "Tampa",
      address: place.address,
      website: place.website ?? "",
      instagramHandle: "",
      latitude: place.latitude ?? 0,
      longitude: place.longitude ?? 0,
      placeId: place.id,
    }));
}

function getVenueMatches(): VenuePlaceMatch[] {
  return getImportedPlaceMatchesFile().venueMatches;
}

function getMergedSeededVenues(): Venue[] {
  return getStoredVenues().map(mergeSeededVenueWithPlace);
}

function mergeSeededVenueWithPlace(venue: Venue): Venue {
  const matchedPlace = getVenueMatches().find(
    (item) => item.venueId === venue.id && item.status === "matched" && item.placeId
  );

  if (!matchedPlace?.placeId) {
    return venue;
  }

  const importedPlace = getImportedPlaceById(matchedPlace.placeId);

  if (!importedPlace || importedPlace.latitude === null || importedPlace.longitude === null) {
    return venue;
  }

  return {
    ...venue,
    address: importedPlace.address || venue.address,
    website: importedPlace.website ?? venue.website,
    latitude: importedPlace.latitude,
    longitude: importedPlace.longitude,
    placeId: importedPlace.id,
  };
}

export function getMatchedVenuePairs(): Array<{
  venue: Venue;
  match: VenuePlaceMatch;
  place: ImportedPlace;
}> {
  return getVenueMatches()
    .filter((item) => item.status === "matched" && item.placeId)
    .map((item) => {
      const venue = getStoredVenues().find((entry) => entry.id === item.venueId);
      const place = getImportedPlaceById(item.placeId as string);

      if (!venue || !place) {
        return null;
      }

      return {
        venue,
        match: item,
        place,
      };
    })
    .filter((item): item is { venue: Venue; match: VenuePlaceMatch; place: ImportedPlace } => item !== null);
}

export function getSuggestedVenueMatches(): VenuePlaceMatch[] {
  return getVenueMatches().filter((item) => item.status === "suggested");
}

export function getUnmatchedSeededVenueMatches(): VenuePlaceMatch[] {
  return getVenueMatches().filter((item) => item.status === "unmatched");
}

export function getMapVenues(): Venue[] {
  const linkedPlaceIds = new Set(
    getVenueMatches()
      .filter((item) => item.placeId)
      .map((item) => item.placeId as string)
  );
  const mergedSeededVenues = getMergedSeededVenues();
  const importedVenues = getImportedVenues().filter(
    (venue) => !venue.placeId || !linkedPlaceIds.has(venue.placeId)
  );

  return importedVenues.length > 0 ? [...mergedSeededVenues, ...importedVenues] : mergedSeededVenues;
}

export function getVenueById(venueId: string): Venue {
  const venue = getMapVenues().find((item) => item.id === venueId);

  if (!venue) {
    throw new Error(`Unknown venue: ${venueId}`);
  }

  return venue;
}

export function getSourceById(sourceId: string): SourceRecord {
  const source = getStoredSources().find((item) => item.id === sourceId);

  if (!source) {
    throw new Error(`Unknown source: ${sourceId}`);
  }

  return source;
}

export function getDisplayDeals(): DisplayDeal[] {
  const seededDeals = getStoredDeals().map((deal) => ({
    ...deal,
    venue: getVenueById(deal.venueId),
    source: getSourceById(deal.sourceId),
    trustLabel: deal.reviewStatus === "verified" ? "High trust" : "Seeded source",
    freshnessLabel: `Checked ${formatShortDate(deal.lastVerified)}`,
    sourceLabel: getSourceById(deal.sourceId).label,
    sourceKindLabel: getSourceById(deal.sourceId).kind === "website" ? "Website" : "Instagram",
    countdownLabel: getCountdownLabel(deal.day, deal.time),
    priceLabel: extractPriceLabel(deal.description),
  }));

  return [...getLiveImportedDeals(), ...seededDeals];
}

export function getVenueProfileById(venueId: string): VenueProfile {
  const venue = getVenueById(venueId);
  const venueDeals = getDisplayDeals().filter((deal) => deal.venueId === venueId);
  const seenSourceIds = new Set<string>();
  const dealSources = venueDeals.map((deal) => deal.source).filter((source) => {
    if (seenSourceIds.has(source.id)) {
      return false;
    }

    seenSourceIds.add(source.id);
    return true;
  });
  const baseSources = getStoredSources().filter(
    (source) => source.venueId === venueId && !seenSourceIds.has(source.id)
  );

  return {
    venue,
    deals: venueDeals,
    sources: [...dealSources, ...baseSources],
  };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function formatShortDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseDayLabel(snippet: string): string {
  const dayMatch = snippet.match(
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Tues|Wed|Weds|Thu|Thur|Thurs|Fri|Sat|Sun|Weekdays?|Weekend|Daily)\b/i
  );

  if (!dayMatch) {
    return "Today";
  }

  return toTitleCase(dayMatch[0].replace(/weds/i, "Wednesday").replace(/thurs?/i, "Thursday"));
}

function parseTimeLabel(snippet: string): string {
  const timeRangeMatch = snippet.match(
    /(\d{1,2}(?::\d{2})?\s?(?:am|pm|AM|PM))\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s?(?:am|pm|AM|PM))/i
  );

  if (timeRangeMatch) {
    return `${timeRangeMatch[1].toUpperCase()} - ${timeRangeMatch[2].toUpperCase()}`;
  }

  const singleTimeMatch = snippet.match(/(\d{1,2}(?::\d{2})?\s?(?:am|pm|AM|PM))/i);

  if (singleTimeMatch) {
    return `Starts ${singleTimeMatch[1].toUpperCase()}`;
  }

  return "Live from source";
}

function parseClockValue(value: string): number | null {
  const match = value.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);

  if (!match) {
    return null;
  }

  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2] ?? "0");

  if (match[3].toLowerCase() === "pm") {
    hours += 12;
  }

  return hours * 60 + minutes;
}

function getAllowedWeekdays(day: string): number[] | null {
  const normalized = day.toLowerCase();

  if (normalized === "today" || normalized === "daily") {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  if (normalized === "weekday" || normalized === "weekdays") {
    return [1, 2, 3, 4, 5];
  }

  if (normalized === "weekend") {
    return [0, 6];
  }

  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sun: 0,
    mon: 1,
    tue: 2,
    tues: 2,
    wed: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    fri: 5,
    sat: 6,
  };

  if (normalized in dayMap) return [dayMap[normalized]];

  // Handle day ranges like "Mon-Thu", "Tue-Sat", "Mon-Fri"
  const rangeMatch = normalized.match(/^(\w+)\s*[-–]\s*(\w+)$/);
  if (rangeMatch) {
    const start = dayMap[rangeMatch[1]];
    const end = dayMap[rangeMatch[2]];
    if (start !== undefined && end !== undefined) {
      const days: number[] = [];
      let d = start;
      while (d !== end) {
        days.push(d);
        d = (d + 1) % 7;
      }
      days.push(end);
      return days;
    }
  }

  return null;
}

function formatMinutesCountdown(totalMinutes: number): string {
  const safeMinutes = Math.max(totalMinutes, 0);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours === 0) {
    return `${minutes}m left`;
  }

  return `${hours}h ${minutes}m left`;
}

function getCountdownLabel(day: string, time: string): string {
  const rangeMatch = time.match(
    /(\d{1,2}(?::\d{2})?\s?(?:AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?\s?(?:AM|PM))/i
  );

  if (!rangeMatch) {
    return time.toLowerCase().includes("live") ? "Check source" : "Time posted";
  }

  const allowedWeekdays = getAllowedWeekdays(day);
  const now = new Date();

  if (allowedWeekdays && !allowedWeekdays.includes(now.getDay())) {
    return day === "Today" ? "Not live yet" : `Next ${day}`;
  }

  const startMinutes = parseClockValue(rangeMatch[1]);
  const endMinutes = parseClockValue(rangeMatch[2]);

  if (startMinutes === null || endMinutes === null) {
    return "Time posted";
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (currentMinutes < startMinutes) {
    return `Starts in ${formatMinutesCountdown(startMinutes - currentMinutes).replace(" left", "")}`;
  }

  if (currentMinutes > endMinutes) {
    return "Ended today";
  }

  return formatMinutesCountdown(endMinutes - currentMinutes);
}

function extractPriceLabel(description: string): string | null {
  const match = description.match(/\$\d+(?:\.\d{2})?/);
  return match ? match[0] : null;
}

function getReviewItems(): ImportedReviewItem[] {
  const seeded = (importedReviewFile.items ?? []) as ImportedReviewItem[];
  const prospects = (importedProspectReviewFile.items ?? []) as ImportedReviewItem[];
  const instagram = (importedInstagramReviewFile.items ?? []) as ImportedReviewItem[];

  return [...instagram, ...prospects, ...seeded];
}

function getConfidenceRank(value: ImportedReviewItem["confidence"]): number {
  if (value === "high") {
    return 3;
  }

  if (value === "medium") {
    return 2;
  }

  return 1;
}

function getReviewPriority(item: ImportedReviewItem): number {
  let score = getConfidenceRank(item.confidence) * 10;

  if (/\$\d/.test(item.snippet)) {
    score += 4;
  }

  if (/\b(am|pm)\b/i.test(item.snippet)) {
    score += 3;
  }

  if (/\bhappy hour\b/i.test(item.snippet)) {
    score += 3;
  }

  if (/\b(?:wings?|tacos?|burgers?|margaritas?|cocktails?|drafts?|beer|wine|shots?|seltzers?|sandwich(?:es)?|appetizers?)\b/i.test(item.snippet)) {
    score += 4;
  }

  if (/\b(?:doors?|show|concert|tickets?|minimum donation|at the door)\b/i.test(item.snippet)) {
    score -= 4;
  }

  if (item.sourceKind === "prospect") {
    score += 2;
  }

  if (item.sourceKind === "instagram") {
    score += 3;
  }

  return score;
}

function shouldPromoteReviewItem(item: ImportedReviewItem): boolean {
  const snippet = item.snippet.trim();

  if (snippet.length < 18) {
    return false;
  }

  if (/^[a-z]/.test(snippet) && !snippet.startsWith("$")) {
    return false;
  }

  if (
    /What are the daily specials|The daily specials|Join our program|opens daily|festive atmosphere/i.test(
      snippet
    )
  ) {
    return false;
  }

  if (
    /\b(?:doors?|show|concert|tickets?|minimum donation|at the door)\b/i.test(snippet) &&
    !/\b(?:happy hour|specials?|deal(?:s)?|wings?|tacos?|burgers?|margaritas?|cocktails?|drafts?|beer|wine|shots?|seltzers?|sandwich(?:es)?|appetizers?)\b/i.test(snippet)
  ) {
    return false;
  }

  if (item.confidence !== "low") {
    return true;
  }

  return /\$\d/.test(snippet) && /\b(am|pm)\b/i.test(snippet);
}

function createVenueFromReviewItem(item: ImportedReviewItem): Venue | null {
  if (item.sourceKind !== "prospect" && item.sourceKind !== "instagram") {
    return getVenueById(item.venueId);
  }

  try {
    return getVenueById(item.venueId);
  } catch {
    // Fall back to place-derived venue construction for new prospects or unmapped Instagram leads.
  }

  const importedPlace = item.placeId ? getImportedPlaceById(item.placeId) : undefined;

  if (!importedPlace || importedPlace.latitude === null || importedPlace.longitude === null) {
    return null;
  }

  // Strip parenthetical suffixes like "(Tampa Heights)" or "(Ybor City)"
  const cleanName = item.venueName.replace(/\s*\([^)]*\)\s*$/, "").trim();

  return {
    id: item.venueId,
    name: cleanName,
    neighborhood: item.neighborhood,
    city: "Tampa",
    address: importedPlace.address,
    website: importedPlace.website ?? item.sourceUrl,
    instagramHandle: "",
    latitude: importedPlace.latitude,
    longitude: importedPlace.longitude,
    placeId: importedPlace.id,
  };
}

function createSourceFromReviewItem(item: ImportedReviewItem): SourceRecord {
  return {
    id: `src-imported-${item.id}`,
    venueId: item.venueId,
    kind: item.sourceKind === "instagram" ? "instagram" : "website",
    label:
      item.sourceTitle ||
      (item.sourceKind === "instagram" ? "Imported Instagram source" : "Imported website source"),
    url: item.sourceUrl,
    lastChecked: item.importedAt.slice(0, 10),
    reliability: item.confidence === "high" ? "high" : "medium",
  };
}

function getLiveImportedDeals(): DisplayDeal[] {
  const selected = getReviewItems()
    .filter(shouldPromoteReviewItem)
    .sort((left, right) => getReviewPriority(right) - getReviewPriority(left))
    .filter((item, index, collection) => {
      const key = `${item.venueName.toLowerCase()}-${item.snippet.toLowerCase()}`;

      return collection.findIndex((entry) => {
        const entryKey = `${entry.venueName.toLowerCase()}-${entry.snippet.toLowerCase()}`;
        return entryKey === key;
      }) === index;
    })
    .slice(0, 200);

  const perVenueCounts = new Map<string, number>();

  return selected
    .map((item, index) => {
      const venue = createVenueFromReviewItem(item);

      if (!venue) {
        return null;
      }

      const source = createSourceFromReviewItem(item);

      return {
        id: `deal-live-${item.id}`,
        venueId: venue.id,
        tag: item.sourceKind === "prospect" ? "Live scrape" : "Source hit",
        day: parseDayLabel(item.snippet),
        time: parseTimeLabel(item.snippet),
        description: decodeHtmlEntities(item.snippet),
        category: item.suggestedCategory,
        sourceId: source.id,
        reviewStatus: item.confidence === "high" ? "verified" : "needs-review",
        lastVerified: item.importedAt.slice(0, 10),
        venue,
        source,
        trustLabel:
          item.confidence === "high"
            ? "High trust"
            : item.confidence === "medium"
              ? "Good signal"
              : "Needs review",
        freshnessLabel: `Scraped ${formatShortDate(item.importedAt)}`,
        sourceLabel: item.sourceTitle,
        sourceKindLabel:
          item.sourceKind === "instagram"
            ? "Instagram"
            : item.sourceKind === "prospect"
              ? "New place"
              : "Website",
        countdownLabel: getCountdownLabel(parseDayLabel(item.snippet), parseTimeLabel(item.snippet)),
        priceLabel: extractPriceLabel(item.snippet),
        _priority: getReviewPriority(item),
        _order: index,
      };
    })
    .filter(
      (
        item
      ): item is DisplayDeal & {
        _priority: number;
        _order: number;
      } => item !== null
    )
    .sort((left, right) => right._priority - left._priority || left._order - right._order)
    .filter((deal) => {
      const currentCount = perVenueCounts.get(deal.venueId) ?? 0;

      if (currentCount >= 4) {
        return false;
      }

      perVenueCounts.set(deal.venueId, currentCount + 1);
      return true;
    })
    .slice(0, 80)
    .map(({ _priority, _order, ...deal }) => deal);
}

export function summarizeQueueItem(item: ReviewQueueItem) {
  return {
    ...item,
    venue: getVenueById(item.venueId),
    source: getSourceById(item.sourceId),
  };
}
