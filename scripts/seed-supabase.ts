/**
 * Upserts all static venues, sources, and deals from tampa.ts into Supabase.
 * Run with: npx tsx scripts/seed-supabase.ts
 */

import { createClient } from "@supabase/supabase-js";
import { venues, sources, deals, events } from "../src/data/tampa";

const SUPABASE_URL = "https://nbplqgtvcudfezbeqgid.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5icGxxZ3R2Y3VkZmV6YmVxZ2lkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjcyNjM5MSwiZXhwIjoyMDkyMzAyMzkxfQ.Py_GTGiU-c2V0V30s9j0rlc--BIQFAS_xSxJ6x4Q42E";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function upsertChunked<T extends object>(
  table: string,
  rows: T[],
  chunkSize = 50
) {
  let inserted = 0;
  for (const batch of chunk(rows, chunkSize)) {
    const { error } = await supabase.from(table).upsert(batch as any, { onConflict: "id" });
    if (error) {
      console.error(`  ✗ ${table} batch error:`, error.message);
      throw error;
    }
    inserted += batch.length;
    process.stdout.write(`\r  ${table}: ${inserted}/${rows.length}`);
  }
  console.log(`\r  ✓ ${table}: ${rows.length} rows upserted     `);
}

async function main() {
  console.log("SipSaver → Supabase seed\n");

  // 1. Venues (no FK deps)
  const venueRows = venues.map((v) => ({
    id: v.id,
    name: v.name,
    neighborhood: v.neighborhood,
    city: v.city,
    address: v.address,
    website: v.website ?? null,
    instagram_handle: v.instagramHandle ?? null,
    latitude: v.latitude,
    longitude: v.longitude,
    place_id: v.placeId ?? null,
    is_active: true,
  }));
  await upsertChunked("venues", venueRows);

  // 2. Sources (FK → venues)
  const sourceRows = sources.map((s) => ({
    id: s.id,
    venue_id: s.venueId,
    kind: s.kind,
    label: s.label,
    url: s.url,
    last_checked: s.lastChecked ?? null,
    reliability: s.reliability,
  }));
  await upsertChunked("sources", sourceRows);

  // 3. Deals (FK → venues + sources)
  const dealRows = deals.map((d) => ({
    id: d.id,
    venue_id: d.venueId,
    source_id: d.sourceId ?? null,
    tag: d.tag ?? null,
    day: d.day,
    time: d.time,
    description: d.description,
    category: d.category,
    review_status: d.reviewStatus,
    last_verified: d.lastVerified ?? null,
    is_active: true,
  }));
  await upsertChunked("deals", dealRows);

  // 4. Events (FK → venues)
  const eventRows = events.map((e) => ({
    id: e.id,
    venue_id: e.venueId,
    type: e.type,
    title: e.title,
    time: e.time,
    description: e.description ?? null,
    is_active: true,
  }));
  await upsertChunked("events", eventRows);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
