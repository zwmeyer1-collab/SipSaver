import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

const prospectsPath = path.join(workspaceRoot, "data", "venues", "tampa-prospects.json");
const outputDir = path.join(workspaceRoot, "data", "ingestion");
const outputPath = path.join(outputDir, "tampa-prospects-raw.json");

const dealKeywordPatterns = [
  /\bhappy hour\b/i,
  /\bspecials?\b/i,
  /\bdeal(?:s)?\b/i,
  /\bhalf[- ]off\b/i,
  /\b\d+\s?(?:%|percent)\s+off\b/i,
  /\$\d+/i,
  /\bmargarita(?:s)?\b/i,
  /\bmimosa(?:s)?\b/i,
  /\bmartini(?:s)?\b/i,
  /\bwell drink(?:s)?\b/i,
  /\bdomestic(?:s)?\b/i,
  /\bimports?\b/i,
  /\btaco(?:s)?\b/i,
  /\bdraft(?:s)?\b/i,
  /\bwing(?:s)?\b/i,
  /\bbrunch\b/i,
  /\bappetizers?\b/i,
  /\bburger(?:s)?\b/i,
  /\bsliders?\b/i,
  /\bsandwich(?:es)?\b/i,
  /\bshot(?:s)?\b/i,
  /\bwine\b/i,
  /\bbeer\b/i,
  /\bseltzers?\b/i,
];

const eventKeywordPatterns = [
  /\btrivia\b/i,
  /\blive music\b/i,
  /\bdj\b/i,
  /\bkaraoke\b/i,
  /\bgame night\b/i,
  /\bopen mic\b/i,
  /\bshow\b/i,
  /\bdoors?\b/i,
  /\bconcert\b/i,
  /\bband\b/i,
  /\bperformance\b/i,
];

const keywordPatterns = [...dealKeywordPatterns, ...eventKeywordPatterns];

const weakOfferPatterns = [
  /\bloyalty program\b/i,
  /\bmerchandise\b/i,
  /\bat the door\b/i,
  /\bminimum donation\b/i,
  /\bmember(?:ship)?\b/i,
  /\bprivate event\b/i,
];

const pathHints = [
  "happy-hour",
  "happyhour",
  "specials",
  "drink-specials",
  "events",
  "event",
  "menu",
  "menus",
  "promotions",
  "offers",
  "calendar",
];

function parseArgs(argv) {
  const options = {
    limit: null,
    verbose: false,
  };

  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      options.limit = Number.parseInt(arg.slice("--limit=".length), 10);
    }

    if (arg === "--verbose") {
      options.verbose = true;
    }
  }

  return options;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#038;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&raquo;/gi, " ")
    .replace(/&#8243;/g, '"')
    .replace(/&#8212;/g, "-");
}

function stripHtml(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|br|tr|td)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/\t/g, " ")
      .replace(/\n{2,}/g, "\n")
  );
}

function extractTagContents(html, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(pattern);
  return match ? normalizeWhitespace(stripHtml(match[1])) : "";
}

function extractMetaDescription(html) {
  const match = html.match(
    /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["'][^>]*>/i
  );
  return match ? normalizeWhitespace(match[1]) : "";
}

function scoreSnippet(snippet) {
  let score = 0;
  const matchedKeywords = [];

  for (const pattern of dealKeywordPatterns) {
    if (pattern.test(snippet)) {
      score += 2;
      matchedKeywords.push(pattern.source.replace(/\\b/g, ""));
    }
  }

  for (const pattern of eventKeywordPatterns) {
    if (pattern.test(snippet)) {
      score += 1;
      matchedKeywords.push(pattern.source.replace(/\\b/g, ""));
    }
  }

  if (/\b(mon|tues|wednes|thurs|fri|satur|sun|daily|weekdays?)\b/i.test(snippet)) {
    score += 2;
  }

  if (/\b\d{1,2}\s?(?::\d{2})?\s?(?:am|pm)\b/i.test(snippet)) {
    score += 2;
  }

  if (/\$\d/.test(snippet)) {
    score += 3;
  }

  if (/\b(?:happy hour|specials?|deal(?:s)?|half[- ]off)\b/i.test(snippet)) {
    score += 2;
  }

  if (weakOfferPatterns.some((pattern) => pattern.test(snippet))) {
    score -= 3;
  }

  if (eventKeywordPatterns.some((pattern) => pattern.test(snippet)) && !dealKeywordPatterns.some((pattern) => pattern.test(snippet))) {
    score -= 1;
  }

  if (snippet.length > 220) {
    score -= 1;
  }

  return {
    score,
    matchedKeywords,
  };
}

function extractRelevantSnippets(html) {
  const text = stripHtml(html);
  const rawLines = text
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 24);

  const keywordWindows = rawLines.flatMap((line) => {
    const windows = [];

    for (const pattern of keywordPatterns) {
      const match = pattern.exec(line);

      if (!match || match.index === undefined) {
        continue;
      }

      const start = Math.max(0, match.index - 70);
      const end = Math.min(line.length, match.index + 150);
      windows.push(normalizeWhitespace(line.slice(start, end)));
    }

    return windows;
  });

  const candidates = [...rawLines, ...keywordWindows]
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z$])/))
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 24 && line.length <= 320);

  const deduped = [];
  const seen = new Set();

  for (const line of candidates) {
    const key = line.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(line);
  }

  return deduped
    .map((snippet) => ({
      snippet,
      ...scoreSnippet(snippet),
    }))
    .filter((item) => item.score >= 4)
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
}

function extractCandidateLinks(html, baseUrl) {
  const linkMatches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)];
  const candidates = [];
  const seen = new Set();

  for (const match of linkMatches) {
    const rawHref = match[1];
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
      continue;
    }

    let resolved;

    try {
      resolved = new URL(rawHref, baseUrl);
    } catch {
      continue;
    }

    if (resolved.origin !== new URL(baseUrl).origin) {
      continue;
    }

    const url = resolved.toString();
    const lowercase = url.toLowerCase();
    const hintMatch = pathHints.some((hint) => lowercase.includes(hint));

    if (!hintMatch || seen.has(url)) {
      continue;
    }

    seen.add(url);
    candidates.push(url);
  }

  return candidates.slice(0, 3);
}

async function fetchPage(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "SipSaverBot/0.1 (+https://example.com)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  const html = await response.text();

  return {
    url,
    finalUrl: response.url,
    status: response.status,
    ok: response.ok,
    html,
  };
}

async function scrapeVenue(venue, verbose) {
  const crawlTargets = [...venue.crawlTargets];
  const visited = new Set();
  const pages = [];
  const errors = [];

  for (const initialTarget of crawlTargets) {
    if (visited.has(initialTarget)) {
      continue;
    }

    visited.add(initialTarget);

    try {
      const firstPage = await fetchPage(initialTarget);
      const title = extractTagContents(firstPage.html, "title");
      const metaDescription = extractMetaDescription(firstPage.html);
      const relevantSnippets = extractRelevantSnippets(firstPage.html);
      const childLinks = extractCandidateLinks(firstPage.html, firstPage.finalUrl);

      pages.push({
        url: firstPage.finalUrl,
        status: firstPage.status,
        title,
        metaDescription,
        relevantSnippets,
      });

      if (verbose) {
        console.log(`[prospect] ${venue.name} homepage ${firstPage.status} ${firstPage.finalUrl}`);
      }

      for (const childLink of childLinks) {
        if (visited.has(childLink)) {
          continue;
        }

        visited.add(childLink);

        try {
          const childPage = await fetchPage(childLink);

          pages.push({
            url: childPage.finalUrl,
            status: childPage.status,
            title: extractTagContents(childPage.html, "title"),
            metaDescription: extractMetaDescription(childPage.html),
            relevantSnippets: extractRelevantSnippets(childPage.html),
          });

          if (verbose) {
            console.log(`[prospect] ${venue.name} child ${childPage.status} ${childPage.finalUrl}`);
          }
        } catch (error) {
          errors.push({
            url: childLink,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      errors.push({
        url: initialTarget,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const extractedCandidates = pages
    .flatMap((page) =>
      page.relevantSnippets.map((item) => ({
        sourceUrl: page.url,
        title: page.title,
        snippet: item.snippet,
        score: item.score,
        matchedKeywords: item.matchedKeywords,
      }))
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);

  return {
    id: venue.id,
    placeId: venue.placeId,
    name: venue.name,
    neighborhood: venue.neighborhood,
    website: venue.website,
    pages,
    extractedCandidates,
    errors,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prospectsFile = await readFile(prospectsPath, "utf8");
  const prospects = JSON.parse(prospectsFile);
  const venues = options.limit ? prospects.slice(0, options.limit) : prospects;

  const results = [];

  for (const venue of venues) {
    results.push(await scrapeVenue(venue, options.verbose));
  }

  const output = {
    generatedAt: new Date().toISOString(),
    city: "Tampa",
    venueCount: results.length,
    results,
    summary: {
      venuesWithCandidates: results.filter((item) => item.extractedCandidates.length > 0).length,
      venuesWithErrors: results.filter((item) => item.errors.length > 0).length,
      totalCandidateSnippets: results.reduce((sum, item) => sum + item.extractedCandidates.length, 0),
    },
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(JSON.stringify(output.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
