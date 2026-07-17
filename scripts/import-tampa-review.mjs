import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

const rawPath = path.join(workspaceRoot, "data", "ingestion", "tampa-raw.json");
const reviewPath = path.join(workspaceRoot, "data", "ingestion", "tampa-review.json");

const categoryMatchers = [
  { category: "Live music", pattern: /\blive music\b|\bdj\b/i },
  { category: "Game night", pattern: /\btrivia\b|\bgame night\b/i },
  { category: "Food", pattern: /\bwing(?:s)?\b|\btaco(?:s)?\b|\bburger\b|\bbrunch\b|\bapps?\b/i },
  { category: "Drinks", pattern: /\bhappy hour\b|\bdrafts?\b|\bmargarita(?:s)?\b|\bwells?\b|\bseltzers?\b|\bcocktails?\b/i },
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

function inferConfidence(score) {
  if (score >= 8) {
    return "high";
  }

  if (score >= 5) {
    return "medium";
  }

  return "low";
}

async function main() {
  const rawText = await readFile(rawPath, "utf8");
  const raw = JSON.parse(rawText);

  const reviewItems = raw.results.flatMap((venue) =>
    venue.extractedCandidates.map((candidate, index) => ({
      id: `${venue.id}-${index + 1}-${slugify(candidate.snippet).slice(0, 32)}`,
      venueId: venue.id,
      venueName: venue.name,
      neighborhood: venue.neighborhood,
      status: "pending",
      sourceUrl: candidate.sourceUrl,
      sourceTitle: candidate.title,
      snippet: candidate.snippet,
      suggestedCategory: inferCategory(candidate.snippet),
      confidence: inferConfidence(candidate.score),
      matchedKeywords: candidate.matchedKeywords,
      importedAt: raw.generatedAt,
    }))
  );

  const output = {
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: raw.generatedAt,
    city: raw.city,
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
