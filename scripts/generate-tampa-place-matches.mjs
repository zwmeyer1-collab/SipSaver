import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

const placesPath = path.join(workspaceRoot, "data", "ingestion", "tampa-places.json");
const outputPath = path.join(workspaceRoot, "data", "ingestion", "tampa-place-matches.json");

const seededVenues = [
  {
    id: "macdintons",
    name: "MacDinton's",
    neighborhood: "SoHo",
    address: "405 S Howard Ave, Tampa, FL",
    website: "https://macdintons.com/",
    latitude: 27.9412,
    longitude: -82.4826,
  },
  {
    id: "green-lemon",
    name: "Green Lemon",
    neighborhood: "SoHo",
    address: "915 S Howard Ave, Tampa, FL",
    website: "https://greenlemon.com/",
    latitude: 27.9378,
    longitude: -82.4824,
  },
  {
    id: "malios",
    name: "Malio's",
    neighborhood: "Downtown Tampa",
    address: "400 N Ashley Dr, Tampa, FL",
    website: "https://maliosprime.com/",
    latitude: 27.9466,
    longitude: -82.4618,
  },
  {
    id: "yard-house",
    name: "Yard House",
    neighborhood: "Downtown Tampa",
    address: "901 Water St, Tampa, FL",
    website: "https://www.yardhouse.com/",
    latitude: 27.9426,
    longitude: -82.4514,
  },
  {
    id: "district-tavern",
    name: "District Tavern",
    neighborhood: "Channelside",
    address: "116 N 12th St, Tampa, FL",
    website: "https://www.districttaverntampa.com/",
    latitude: 27.9467,
    longitude: -82.4474,
  },
  {
    id: "ybormarket",
    name: "Ybor neighborhood leads",
    neighborhood: "Ybor",
    address: "7th Ave corridor, Tampa, FL",
    website: "https://visityborcity.com/",
    latitude: 27.9608,
    longitude: -82.4405,
  },
];

function normalizeText(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !["bar", "grill", "kitchen", "tampa"].includes(token));
}

function getDomain(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceInMeters(left, right) {
  const earthRadius = 6371000;
  const latDelta = toRadians(right.latitude - left.latitude);
  const lonDelta = toRadians(right.longitude - left.longitude);
  const leftLat = toRadians(left.latitude);
  const rightLat = toRadians(right.latitude);

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lonDelta / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(haversine));
}

function getNeighborhoodHint(place) {
  const combined = `${place.address} ${place.sourceBuckets.join(" ")}`.toLowerCase();

  if (combined.includes("ybor")) {
    return "Ybor";
  }

  if (combined.includes("channel")) {
    return "Channelside";
  }

  if (combined.includes("soho") || combined.includes("howard") || combined.includes("hyde park")) {
    return "SoHo";
  }

  if (combined.includes("downtown") || combined.includes("water st") || combined.includes("ashley")) {
    return "Downtown Tampa";
  }

  return "Tampa";
}

function scoreCandidate(venue, place) {
  const reasons = [];
  let score = 0;

  const venueName = normalizeText(venue.name);
  const placeName = normalizeText(place.name);
  const venueTokens = tokenize(venue.name);
  const placeTokens = tokenize(place.name);

  if (venueName === placeName) {
    score += 70;
    reasons.push("exact-name");
  } else if (placeName.includes(venueName) || venueName.includes(placeName)) {
    score += 58;
    reasons.push("contained-name");
  } else {
    const sharedTokens = venueTokens.filter((token) => placeTokens.includes(token));
    if (sharedTokens.length > 0) {
      score += Math.min(48, sharedTokens.length * 18);
      reasons.push(`shared-tokens:${sharedTokens.join(",")}`);
    }
  }

  const venueDomain = getDomain(venue.website);
  const placeDomain = getDomain(place.website);
  if (venueDomain && placeDomain && venueDomain === placeDomain) {
    score += 35;
    reasons.push("website-domain");
  }

  if (place.latitude !== null && place.longitude !== null) {
    const meters = distanceInMeters(venue, place);
    if (meters <= 60) {
      score += 30;
      reasons.push("very-close-location");
    } else if (meters <= 180) {
      score += 22;
      reasons.push("close-location");
    } else if (meters <= 400) {
      score += 12;
      reasons.push("same-block");
    }
  }

  const neighborhoodHint = getNeighborhoodHint(place);
  if (neighborhoodHint === venue.neighborhood) {
    score += 10;
    reasons.push("neighborhood");
  }

  return {
    score,
    reasons,
  };
}

function getConfidence(score) {
  if (score >= 85) {
    return "high";
  }

  if (score >= 60) {
    return "medium";
  }

  return "low";
}

function getStatus(score) {
  if (score >= 85) {
    return "matched";
  }

  if (score >= 60) {
    return "suggested";
  }

  return "unmatched";
}

async function main() {
  const placesText = await readFile(placesPath, "utf8");
  const placesFile = JSON.parse(placesText);
  const places = placesFile.places ?? [];

  const matchedPlaceIds = new Set();

  const venueMatches = seededVenues.map((venue) => {
    const ranked = places
      .map((place) => ({
        place,
        ...scoreCandidate(venue, place),
      }))
      .sort((left, right) => right.score - left.score);

    const best = ranked[0];

    if (!best || best.score < 60) {
      return {
        venueId: venue.id,
        venueName: venue.name,
        placeId: null,
        placeName: null,
        status: "unmatched",
        confidence: "low",
        matchScore: best?.score ?? 0,
        reasons: best?.reasons ?? [],
      };
    }

    if (best.score >= 85) {
      matchedPlaceIds.add(best.place.id);
    }

    return {
      venueId: venue.id,
      venueName: venue.name,
      placeId: best.place.id,
      placeName: best.place.name,
      status: getStatus(best.score),
      confidence: getConfidence(best.score),
      matchScore: best.score,
      reasons: best.reasons,
    };
  });

  const venueMatchByPlaceId = new Map(
    venueMatches
      .filter((item) => item.placeId)
      .map((item) => [item.placeId, item])
  );

  const placeReviews = places.map((place) => {
    const linkedVenue = venueMatchByPlaceId.get(place.id);

    if (!linkedVenue) {
      return {
        placeId: place.id,
        placeName: place.name,
        status: "unmatched",
        matchedVenueId: null,
        matchedVenueName: null,
        confidence: "low",
        matchScore: 0,
        reasons: [],
      };
    }

    return {
      placeId: place.id,
      placeName: place.name,
      status: linkedVenue.status,
      matchedVenueId: linkedVenue.venueId,
      matchedVenueName: linkedVenue.venueName,
      confidence: linkedVenue.confidence,
      matchScore: linkedVenue.matchScore,
      reasons: linkedVenue.reasons,
    };
  });

  const output = {
    generatedAt: new Date().toISOString(),
    city: "Tampa",
    seedVenueCount: seededVenues.length,
    importedPlaceCount: places.length,
    matchedCount: venueMatches.filter((item) => item.status === "matched").length,
    suggestedCount: venueMatches.filter((item) => item.status === "suggested").length,
    unmatchedCount: placeReviews.filter((item) => item.status === "unmatched").length,
    venueMatches,
    placeReviews,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        matchedCount: output.matchedCount,
        suggestedCount: output.suggestedCount,
        unmatchedCount: output.unmatchedCount,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
