import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

const inputPath = path.join(workspaceRoot, "data", "ingestion", "tampa-instagram-input.json");
const reviewPath = path.join(workspaceRoot, "data", "ingestion", "tampa-instagram-review.json");
const seedPath = path.join(workspaceRoot, "data", "venues", "tampa-seed.json");
const prospectsPath = path.join(workspaceRoot, "data", "venues", "tampa-prospects.json");

const categoryMatchers = [
  { category: "Live music", pattern: /\blive music\b|\bdj\b|\bband\b|\brelease party\b/i },
  { category: "Game night", pattern: /\btrivia\b|\bgame night\b|\bwatch party\b/i },
  { category: "Food", pattern: /\bwing(?:s)?\b|\btaco(?:s)?\b|\bburger\b|\bbrunch\b|\bapps?\b|\bpizza\b/i },
  {
    category: "Drinks",
    pattern: /\bhappy hour\b|\bdrafts?\b|\bmargarita(?:s)?\b|\bwells?\b|\bseltzers?\b|\bcocktails?\b|\bmimosas?\b/i,
  },
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferCategory(snippet) {
  for (const matcher of categoryMatchers) {
    if (matcher.pattern.test(snippet)) {
      return matcher.category;
    }
  }

  return "Drinks";
}

function inferConfidence(snippet) {
  let score = 0;

  if (/\$\d/.test(snippet)) {
    score += 3;
  }

  if (/\b(mon|tues|wednes|thurs|fri|satur|sun|daily|weekdays?)\b/i.test(snippet)) {
    score += 2;
  }

  if (/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i.test(snippet)) {
    score += 2;
  }

  if (/\bhappy hour\b|\bspecials?\b|\bdeal(?:s)?\b/i.test(snippet)) {
    score += 2;
  }

  if (score >= 7) {
    return "high";
  }

  if (score >= 4) {
    return "medium";
  }

  return "low";
}

function getDefaultSourceTitle(entry, venue) {
  if (entry.sourceTitle) {
    return entry.sourceTitle;
  }

  if (venue?.instagramHandle) {
    return `Instagram ${venue.instagramHandle}`;
  }

  return "Instagram post";
}

async function main() {
  const [inputText, seedText, prospectsText] = await Promise.all([
    readFile(inputPath, "utf8"),
    readFile(seedPath, "utf8"),
    readFile(prospectsPath, "utf8"),
  ]);

  const input = JSON.parse(inputText);
  const seeds = JSON.parse(seedText);
  const prospects = JSON.parse(prospectsText);
  const venueLookup = new Map([...seeds, ...prospects].map((venue) => [venue.id, venue]));

  const reviewItems = (input.items ?? []).map((entry, index) => {
    const venue = venueLookup.get(entry.venueId);

    if (!venue && (!entry.venueName || !entry.neighborhood)) {
      throw new Error(
        `Instagram item ${index + 1} is missing venue metadata. Add venueName and neighborhood or use a known venueId.`
      );
    }

    const snippet = entry.snippet.trim();
    const importedAt = entry.capturedAt ?? input.generatedAt ?? new Date().toISOString();

    return {
      id: entry.id ?? `instagram-${entry.venueId}-${index + 1}-${slugify(snippet).slice(0, 32)}`,
      venueId: entry.venueId,
      venueName: entry.venueName ?? venue.name,
      neighborhood: entry.neighborhood ?? venue.neighborhood,
      sourceKind: "instagram",
      placeId: entry.placeId ?? venue.placeId ?? null,
      status: "pending",
      sourceUrl: entry.sourceUrl,
      sourceTitle: getDefaultSourceTitle(entry, venue),
      snippet,
      suggestedCategory: entry.suggestedCategory ?? inferCategory(snippet),
      confidence: entry.confidence ?? inferConfidence(snippet),
      matchedKeywords: entry.matchedKeywords ?? [],
      importedAt,
    };
  });

  const output = {
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: input.generatedAt ?? null,
    city: input.city ?? "Tampa",
    reviewCount: reviewItems.length,
    items: reviewItems,
  };

  await mkdir(path.dirname(reviewPath), { recursive: true });
  await writeFile(reviewPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Wrote ${reviewPath}`);
  console.log(
    JSON.stringify(
      {
        reviewCount: output.reviewCount,
        highConfidence: reviewItems.filter((item) => item.confidence === "high").length,
        mediumConfidence: reviewItems.filter((item) => item.confidence === "medium").length,
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
