/**
 * SipSaver — Supabase seed script
 *
 * Reads the static Tampa data from src/data/tampa.ts and inserts it
 * into your Supabase project.
 *
 * Run once after applying the migration SQL:
 *   npx tsx scripts/seed-supabase.ts
 *
 * Requires: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
 * (or set them as env vars before running the script)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env.local manually (no external dotenv dep needed) ────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    // Strip optional surrounding quotes and whitespace from value
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && val && !process.env[key]) {
      process.env[key] = val;
    }
  }
} catch {
  // .env.local not found — rely on actual env vars
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

// Use service role key if available for seeding (bypasses RLS), otherwise anon key
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseKey;
const supabase = createClient(supabaseUrl, serviceRoleKey);

// ── Import static data ───────────────────────────────────────────────────────
// We import as dynamic values since this is a plain TS script, not a Vite module.
// The data is structured to match the DB schema exactly.

// Inline the minimal data needed — this mirrors src/data/tampa.ts
// (If the static data changes, re-run the seed. Existing rows are upserted.)

import { venues, deals, sources, events } from "../src/data/tampa.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function upsertChunks<T extends object>(
  table: string,
  rows: T[],
  onConflict: string
) {
  let inserted = 0;
  for (const batch of chunk(rows, 50)) {
    const { error, count } = await supabase
      .from(table)
      .upsert(batch as never, { onConflict, count: "exact" });
    if (error) {
      console.error(`  ✗ ${table} batch error:`, error.message);
    } else {
      inserted += count ?? batch.length;
    }
  }
  return inserted;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 SipSaver seed starting…\n");

  // 1. Venues
  console.log(`Seeding ${venues.length} venues…`);
  const venueRows = venues.map((v) => ({
    id:               v.id,
    name:             v.name,
    neighborhood:     v.neighborhood,
    city:             v.city,
    address:          v.address,
    website:          v.website || null,
    instagram_handle: v.instagramHandle || null,
    latitude:         v.latitude,
    longitude:        v.longitude,
    place_id:         v.placeId ?? null,
    is_active:        true,
  }));
  const vCount = await upsertChunks("venues", venueRows, "id");
  console.log(`  ✓ ${vCount} venues upserted\n`);

  // 2. Sources
  console.log(`Seeding ${sources.length} sources…`);
  const sourceRows = sources.map((s) => ({
    id:           s.id,
    venue_id:     s.venueId,
    kind:         s.kind,
    label:        s.label,
    url:          s.url,
    last_checked: s.lastChecked || null,
    reliability:  s.reliability,
  }));
  const sCount = await upsertChunks("sources", sourceRows, "id");
  console.log(`  ✓ ${sCount} sources upserted\n`);

  // 3. Deals
  console.log(`Seeding ${deals.length} deals…`);
  const dealRows = deals.map((d) => ({
    id:            d.id,
    venue_id:      d.venueId,
    source_id:     d.sourceId || null,
    tag:           d.tag || null,
    day:           d.day,
    time:          d.time,
    description:   d.description,
    category:      d.category,
    review_status: d.reviewStatus,
    last_verified: d.lastVerified || null,
    is_active:     true,
  }));
  const dCount = await upsertChunks("deals", dealRows, "id");
  console.log(`  ✓ ${dCount} deals upserted\n`);

  // 4. Events
  console.log(`Seeding ${events.length} events…`);
  const eventRows = events.map((e) => ({
    id:          e.id,
    venue_id:    e.venueId,
    type:        e.type,
    title:       e.title,
    time:        e.time,
    description: e.description || null,
    is_active:   true,
  }));
  const eCount = await upsertChunks("events", eventRows, "id");
  console.log(`  ✓ ${eCount} events upserted\n`);

  console.log("✅ Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
