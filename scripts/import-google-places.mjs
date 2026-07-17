import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

const outputPath = path.join(workspaceRoot, "data", "ingestion", "tampa-places.json");
const envPath = path.join(workspaceRoot, ".env.local");

async function getApiKey() {
  if (process.env.GOOGLE_MAPS_API_KEY) {
    return process.env.GOOGLE_MAPS_API_KEY;
  }

  try {
    const envFile = await readFile(envPath, "utf8");
    const line = envFile
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("GOOGLE_MAPS_API_KEY="));

    if (!line) {
      return undefined;
    }

    return line.slice("GOOGLE_MAPS_API_KEY=".length).trim();
  } catch {
    return undefined;
  }
}

const searches = [
  {
    label: "SoHo bars",
    includedTypes: ["bar", "restaurant", "night_club"],
    center: { latitude: 27.9414, longitude: -82.4825 },
    radius: 1500,
  },
  {
    label: "Downtown Tampa bars",
    includedTypes: ["bar", "restaurant", "night_club"],
    center: { latitude: 27.9475, longitude: -82.4584 },
    radius: 1700,
  },
  {
    label: "Ybor nightlife",
    includedTypes: ["bar", "restaurant", "night_club"],
    center: { latitude: 27.9609, longitude: -82.4397 },
    radius: 1600,
  },
  {
    label: "Channelside bars",
    includedTypes: ["bar", "restaurant", "night_club"],
    center: { latitude: 27.9437, longitude: -82.4494 },
    radius: 1200,
  },
  {
    label: "Hyde Park bars",
    includedTypes: ["bar", "restaurant"],
    center: { latitude: 27.9354, longitude: -82.4725 },
    radius: 1000,
  },
  {
    label: "Seminole Heights bars",
    includedTypes: ["bar", "restaurant", "brewpub", "brewery"],
    center: { latitude: 27.9837, longitude: -82.4640 },
    radius: 1400,
  },
  {
    label: "Armature Works Tampa Heights",
    includedTypes: ["bar", "restaurant", "night_club"],
    center: { latitude: 27.9623, longitude: -82.4680 },
    radius: 1000,
  },
  {
    label: "Westshore bars",
    includedTypes: ["bar", "restaurant"],
    center: { latitude: 27.9603, longitude: -82.5098 },
    radius: 1500,
  },
  {
    label: "Gasworx Ybor",
    includedTypes: ["bar", "restaurant", "night_club"],
    center: { latitude: 27.9560, longitude: -82.4440 },
    radius: 900,
  },
  {
    label: "Tampa sports bars",
    includedTypes: ["sports_bar", "bar"],
    center: { latitude: 27.9428, longitude: -82.4588 },
    radius: 5000,
  },
];

async function searchNearby(search, apiKey) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.websiteUri",
          "places.googleMapsUri",
          "places.types",
          "places.primaryType",
          "places.regularOpeningHours",
          "places.priceLevel",
          "places.rating",
        ].join(","),
    },
    body: JSON.stringify({
      includedTypes: search.includedTypes,
      maxResultCount: 20,
      rankPreference: "POPULARITY",
      locationRestriction: {
        circle: {
          center: search.center,
          radius: search.radius,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Places request failed for ${search.label}: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();

  return {
    label: search.label,
    ...data,
  };
}

function normalizePlaces(searchResults) {
  const byId = new Map();

  searchResults.forEach((result) => {
    (result.places ?? []).forEach((place) => {
      if (!byId.has(place.id)) {
        byId.set(place.id, {
          id: place.id,
          name: place.displayName?.text ?? "Unknown place",
          address: place.formattedAddress ?? "",
          latitude: place.location?.latitude ?? null,
          longitude: place.location?.longitude ?? null,
          website: place.websiteUri ?? null,
          googleMapsUri: place.googleMapsUri ?? null,
          primaryType: place.primaryType ?? null,
          types: place.types ?? [],
          priceLevel: place.priceLevel ?? null,
          rating: place.rating ?? null,
          openingHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
          sourceBuckets: [result.label],
        });
        return;
      }

      byId.get(place.id).sourceBuckets.push(result.label);
    });
  });

  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function main() {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error("Missing GOOGLE_MAPS_API_KEY environment variable.");
  }

  const searchResults = [];
  for (const search of searches) {
    searchResults.push(await searchNearby(search, apiKey));
  }

  const normalizedPlaces = normalizePlaces(searchResults);
  const output = {
    generatedAt: new Date().toISOString(),
    provider: "google-places",
    city: "Tampa",
    searchCount: searchResults.length,
    placeCount: normalizedPlaces.length,
    searches: searchResults.map((result) => ({
      label: result.label,
      resultCount: (result.places ?? []).length,
    })),
    places: normalizedPlaces,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        placeCount: output.placeCount,
        searchCount: output.searchCount,
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
