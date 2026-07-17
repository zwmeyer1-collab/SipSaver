export type DealCategory = "All deals" | "Drinks" | "Food" | "Live music" | "Game night";

export type SourceKind = "website" | "instagram" | "manual";

export type ReviewStatus = "verified" | "needs-review" | "seeded";

export type Venue = {
  id: string;
  name: string;
  neighborhood: string;
  city: string;
  address: string;
  website: string;
  instagramHandle: string;
  latitude: number;
  longitude: number;
  placeId?: string;
};

export type SourceRecord = {
  id: string;
  venueId: string;
  kind: SourceKind;
  label: string;
  url: string;
  lastChecked: string;
  reliability: "high" | "medium";
};

export type Deal = {
  id: string;
  venueId: string;
  tag: string;
  day: string;
  time: string;
  description: string;
  category: Exclude<DealCategory, "All deals">;
  sourceId: string;
  reviewStatus: ReviewStatus;
  lastVerified: string;
};

export type EventCard = {
  id: string;
  venueId: string;
  type: string;
  title: string;
  time: string;
  description: string;
};

export type ReviewQueueItem = {
  id: string;
  venueId: string;
  sourceId: string;
  title: string;
  capturedFrom: string;
  observedAt: string;
  status: "needs-review" | "approved";
  notes: string;
};

export type ImportedReviewItem = {
  id: string;
  venueId: string;
  venueName: string;
  neighborhood: string;
  sourceKind?: "seed" | "prospect" | "instagram";
  placeId?: string;
  status: "pending" | "approved";
  sourceUrl: string;
  sourceTitle: string;
  snippet: string;
  suggestedCategory: Exclude<DealCategory, "All deals">;
  confidence: "high" | "medium" | "low";
  matchedKeywords: string[];
  importedAt: string;
};

export type ImportedPlace = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  googleMapsUri: string | null;
  primaryType: string | null;
  types: string[];
  sourceBuckets: string[];
};

export type ImportedPlacesFile = {
  generatedAt: string;
  provider: string;
  city: string;
  searchCount: number;
  placeCount: number;
  searches: Array<{
    label: string;
    resultCount: number;
  }>;
  places: ImportedPlace[];
};

export type PlaceMatchStatus = "matched" | "suggested" | "unmatched";

export type VenuePlaceMatch = {
  venueId: string;
  venueName: string;
  placeId: string | null;
  placeName: string | null;
  status: PlaceMatchStatus;
  confidence: "high" | "medium" | "low";
  matchScore: number;
  reasons: string[];
};

export type ImportedPlaceMatchReview = {
  placeId: string;
  placeName: string;
  status: PlaceMatchStatus;
  matchedVenueId: string | null;
  matchedVenueName: string | null;
  confidence: "high" | "medium" | "low";
  matchScore: number;
  reasons: string[];
};

export type ImportedPlaceMatchesFile = {
  generatedAt: string;
  city: string;
  seedVenueCount: number;
  importedPlaceCount: number;
  matchedCount: number;
  suggestedCount: number;
  unmatchedCount: number;
  venueMatches: VenuePlaceMatch[];
  placeReviews: ImportedPlaceMatchReview[];
};

export type QuickHit = {
  venue: string;
  detail: string;
  label: string;
};

export type TampaNeighborhood = {
  name: string;
  vibe: string;
  reason: string;
  quickHits: QuickHit[];
};

export type RoadmapCard = {
  title: string;
  body: string;
};

export type LaunchPhase = {
  phase: string;
  title: string;
  body: string;
};
