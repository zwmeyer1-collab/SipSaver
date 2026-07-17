import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

const placesPath = path.join(workspaceRoot, "data", "ingestion", "tampa-places.json");
const matchesPath = path.join(workspaceRoot, "data", "ingestion", "tampa-place-matches.json");
const outputPath = path.join(workspaceRoot, "data", "venues", "tampa-prospects.json");

function parseArgs(argv) {
  const options = {
    max: 60,
    minScore: 8,
  };

  for (const arg of argv) {
    if (arg.startsWith("--max=")) {
      options.max = Number.parseInt(arg.slice("--max=".length), 10);
    }

    if (arg.startsWith("--min-score=")) {
      options.minScore = Number.parseInt(arg.slice("--min-score=".length), 10);
    }
  }

  return options;
}

const includedTypes = new Set([
  "bar",
  "sports_bar",
  "bar_and_grill",
  "cocktail_bar",
  "lounge_bar",
  "night_club",
  "brewpub",
  "brewery",
  "pub",
  "irish_pub",
  "live_music_venue",
  "restaurant",
  "american_restaurant",
  "brunch_restaurant",
  "taco_restaurant",
  "greek_restaurant",
  "mediterranean_restaurant",
  "family_restaurant",
  "wine_bar",
  "tapas_restaurant",
  "steak_house",
  "seafood_restaurant",
  "spanish_restaurant",
  "italian_restaurant",
  "barbecue_restaurant",
  "diner",
  "eastern_european_restaurant",
  "tex_mex_restaurant",
]);

const excludedTypes = new Set([
  "convenience_store",
  "liquor_store",
  "food_store",
  "bakery",
  "coffee_shop",
  "cafe",
  "pizza_restaurant",
  "fast_food_restaurant",
  "chicken_restaurant",
  "movie_theater",
]);

const excludedNamePatterns = [
  /\b7-eleven\b/i,
  /\bmcdonald'?s\b/i,
  /\bchipotle\b/i,
  /\bfirst watch\b/i,
  /\bnaked farmer\b/i,
  /\bhotel\b/i,
  /\bvillage\b/i,
  /\bchick-fil-a\b/i,
  /\bdave'?s hot chicken\b/i,
  /\bchipotle\b/i,
  /\bcava\b/i,
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferNeighborhood(place) {
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

function scorePlace(place) {
  let score = 0;
  const name = place.name.toLowerCase();
  const types = place.types ?? [];

  if (
    place.primaryType &&
    ["bar", "sports_bar", "bar_and_grill", "cocktail_bar", "lounge_bar", "night_club", "brewpub", "brewery", "pub", "irish_pub", "live_music_venue"].includes(
      place.primaryType
    )
  ) {
    score += 10;
  } else if (place.primaryType && includedTypes.has(place.primaryType)) {
    score += 6;
  }

  if (place.types.some((type) => includedTypes.has(type))) {
    score += 5;
  }

  if (
    types.some((type) =>
      ["bar", "sports_bar", "cocktail_bar", "lounge_bar", "night_club", "brewpub", "brewery", "pub", "live_music_venue"].includes(type)
    )
  ) {
    score += 4;
  }

  if (types.some((type) => ["cocktail_bar", "wine_bar", "sports_bar", "brewpub", "brewery", "pub"].includes(type))) {
    score += 4;
  }

  if (types.some((type) => ["brunch_restaurant", "tapas_restaurant", "seafood_restaurant", "steak_house"].includes(type))) {
    score += 2;
  }

  if (types.includes("event_venue") && !types.some((type) => ["bar", "restaurant", "brewery", "pub", "cocktail_bar"].includes(type))) {
    score -= 5;
  }

  if (place.primaryType === "live_music_venue" && !types.some((type) => ["bar", "restaurant", "pub", "brewery"].includes(type))) {
    score -= 4;
  }

  if (place.sourceBuckets.some((bucket) => bucket.includes("SoHo"))) {
    score += 2;
  }

  if (place.sourceBuckets.some((bucket) => bucket.includes("Downtown"))) {
    score += 2;
  }

  if (place.sourceBuckets.some((bucket) => bucket.includes("Ybor"))) {
    score += 2;
  }

  if (place.website) {
    score += 3;
  }

  if (/\bbrewing|brewery|tavern|public|social|cantina|kitchen|gastro|house|rooftop|taproom|ale works|pub\b/i.test(name)) {
    score += 2;
  }

  return score;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [placesText, matchesText] = await Promise.all([
    readFile(placesPath, "utf8"),
    readFile(matchesPath, "utf8"),
  ]);

  const placesFile = JSON.parse(placesText);
  const matchesFile = JSON.parse(matchesText);
  const claimedPlaceIds = new Set(
    (matchesFile.venueMatches ?? [])
      .filter((item) => item.placeId)
      .map((item) => item.placeId)
  );

  const prospects = (placesFile.places ?? [])
    .filter((place) => !claimedPlaceIds.has(place.id))
    .filter((place) => Boolean(place.website))
    .filter((place) => !excludedNamePatterns.some((pattern) => pattern.test(place.name)))
    .filter(
      (place) =>
        (place.primaryType && !excludedTypes.has(place.primaryType) && includedTypes.has(place.primaryType)) ||
        place.types.some((type) => includedTypes.has(type))
    )
    .map((place) => ({
      id: `prospect-${slugify(place.name) || place.id.toLowerCase()}`,
      placeId: place.id,
      name: place.name,
      neighborhood: inferNeighborhood(place),
      address: place.address,
      website: place.website,
      googleMapsUri: place.googleMapsUri,
      latitude: place.latitude,
      longitude: place.longitude,
      primaryType: place.primaryType,
      types: place.types,
      sourceBuckets: place.sourceBuckets,
      crawlTargets: [place.website],
      priorityScore: scorePlace(place),
    }))
    .filter((place) => place.priorityScore >= options.minScore)
    .sort((left, right) => right.priorityScore - left.priorityScore || left.name.localeCompare(right.name))
    .slice(0, options.max);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(prospects, null, 2)}\n`, "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(
    JSON.stringify(
        {
          prospectCount: prospects.length,
          max: options.max,
          minScore: options.minScore,
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
