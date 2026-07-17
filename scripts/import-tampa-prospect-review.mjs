import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

const rawPath = path.join(workspaceRoot, "data", "ingestion", "tampa-prospects-raw.json");
const reviewPath = path.join(workspaceRoot, "data", "ingestion", "tampa-prospect-review.json");

const categoryMatchers = [
  { category: "Live music", pattern: /\blive music\b|\bdj\b/i },
  { category: "Game night", pattern: /\btrivia\b|\bgame night\b|\bkaraoke\b|\bopen mic\b/i },
  {
    category: "Food",
    pattern:
      /\bwing(?:s)?\b|\btaco(?:s)?\b|\bburger(?:s)?\b|\bbrunch\b|\bapps?\b|\bappetizers?\b|\bsliders?\b|\bsandwich(?:es)?\b|\bflatbread(?:s)?\b|\bpatatas\b|\bcroquetas\b/i,
  },
  {
    category: "Drinks",
    pattern:
      /\bhappy hour\b|\bdrafts?\b|\bmargarita(?:s)?\b|\bwells?\b|\bseltzers?\b|\bcocktails?\b|\bmimosa(?:s)?\b|\bmartini(?:s)?\b|\bwine\b|\bbeer\b|\bshots?\b|\bsangria\b/i,
  },
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferCategory(snippet) {
  const scores = new Map([
    ["Live music", 0],
    ["Game night", 0],
    ["Food", 0],
    ["Drinks", 0],
  ]);

  for (const matcher of categoryMatchers) {
    if (matcher.pattern.test(snippet)) {
      scores.set(matcher.category, (scores.get(matcher.category) ?? 0) + 1);
    }
  }

  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1]);

  if (ranked[0][1] > 0) {
    return ranked[0][0];
  }

  if (/\blunch special\b|\bsandwich(?:es)?\b|\bmenu\b/i.test(snippet)) {
    return "Food";
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

function normalizeSnippet(snippet) {
  return snippet
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function canonicalizeSnippet(snippet) {
  return normalizeSnippet(snippet)
    .toLowerCase()
    .replace(/^[^a-z$]+/, "")
    .replace(/[^a-z0-9$%]+/g, " ")
    .trim();
}

function isLikelyFragment(snippet) {
  const trimmed = normalizeSnippet(snippet);

  if (trimmed.length < 24) {
    return true;
  }

  if (/^[a-z]/.test(trimmed) && !trimmed.startsWith("$")) {
    return true;
  }

  if (/^(al hour|ppy hour|resents|gburner|s rise|makeup|show:)/i.test(trimmed)) {
    return true;
  }

  return false;
}

function dedupeVenueCandidates(candidates) {
  const selected = [];
  const seen = new Set();

  for (const candidate of [...candidates].sort((left, right) => right.score - left.score || right.snippet.length - left.snippet.length)) {
    const normalized = normalizeSnippet(candidate.snippet);
    const canonical = canonicalizeSnippet(normalized);

    if (!canonical || isLikelyFragment(normalized) || seen.has(canonical)) {
      continue;
    }

    const overlapsExisting = selected.some((existing) => {
      const existingCanonical = canonicalizeSnippet(existing.snippet);
      return existingCanonical.includes(canonical) || canonical.includes(existingCanonical);
    });

    if (overlapsExisting) {
      continue;
    }

    seen.add(canonical);
    selected.push({
      ...candidate,
      snippet: normalized,
    });
  }

  return selected;
}

async function main() {
  const rawText = await readFile(rawPath, "utf8");
  const raw = JSON.parse(rawText);

  const reviewItems = raw.results.flatMap((venue) =>
    dedupeVenueCandidates(venue.extractedCandidates).map((candidate, index) => ({
      id: `${venue.id}-${index + 1}-${slugify(candidate.snippet).slice(0, 32)}`,
      venueId: venue.id,
      venueName: venue.name,
      neighborhood: venue.neighborhood,
      sourceKind: "prospect",
      placeId: venue.placeId,
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
