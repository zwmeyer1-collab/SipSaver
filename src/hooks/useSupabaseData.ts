/**
 * Fetches venues, deals, sources, and events from Supabase and
 * populates the module-level data store.
 *
 * Call this once near the top of the component tree (AppShell).
 * Returns { loaded, fromSupabase } so the caller can trigger a
 * re-render when live data arrives.
 */

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { setLiveData } from "../lib/dataStore";
import {
  venues as staticVenues,
  deals as staticDeals,
  sources as staticSources,
  events as staticEvents,
} from "../data/tampa";
import type { Deal, EventCard, SourceRecord, Venue } from "../data/types";
import type { DealRow, EventRow, SourceRow, VenueRow } from "../lib/database.types";

function toVenue(row: VenueRow): Venue {
  return {
    id:              row.id,
    name:            row.name,
    neighborhood:    row.neighborhood,
    city:            row.city,
    address:         row.address,
    website:         row.website ?? "",
    instagramHandle: row.instagram_handle ?? "",
    latitude:        row.latitude,
    longitude:       row.longitude,
    placeId:         row.place_id ?? undefined,
  };
}

function toDeal(row: DealRow): Deal {
  return {
    id:            row.id,
    venueId:       row.venue_id,
    sourceId:      row.source_id ?? "",
    tag:           row.tag ?? "",
    day:           row.day,
    time:          row.time,
    description:   row.description,
    category:      row.category,
    reviewStatus:  row.review_status as Deal["reviewStatus"],
    lastVerified:  row.last_verified ?? "",
  };
}

function toSource(row: SourceRow): SourceRecord {
  return {
    id:          row.id,
    venueId:     row.venue_id,
    kind:        row.kind as SourceRecord["kind"],
    label:       row.label,
    url:         row.url,
    lastChecked: row.last_checked ?? "",
    reliability: row.reliability as SourceRecord["reliability"],
  };
}

function toEvent(row: EventRow): EventCard {
  return {
    id:          row.id,
    venueId:     row.venue_id,
    type:        row.type,
    title:       row.title,
    time:        row.time,
    description: row.description ?? "",
  };
}

export function useSupabaseData() {
  const [loaded, setLoaded] = useState(false);
  const [fromSupabase, setFromSupabase] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoaded(true); // using static data, that's fine
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      try {
        const [venuesRes, dealsRes, sourcesRes, eventsRes] = await Promise.all([
          supabase!.from("venues").select("*").eq("is_active", true),
          supabase!.from("deals").select("*").eq("is_active", true),
          supabase!.from("sources").select("*"),
          supabase!.from("events").select("*").eq("is_active", true),
        ]);

        if (cancelled) return;

        const hasError = venuesRes.error || dealsRes.error || sourcesRes.error || eventsRes.error;
        if (hasError) {
          console.warn("[SipSaver] Supabase fetch error — using static data", hasError);
          setLoaded(true);
          return;
        }

        const dbVenues  = (venuesRes.data  ?? []).map(toVenue);
        const dbDeals   = (dealsRes.data   ?? []).map(toDeal);
        const dbSources = (sourcesRes.data ?? []).map(toSource);
        const dbEvents  = (eventsRes.data  ?? []).map(toEvent);

        // Merge: Supabase rows win on ID conflicts; static-only rows are kept.
        const dbVenueIds  = new Set(dbVenues.map((v) => v.id));
        const dbDealIds   = new Set(dbDeals.map((d) => d.id));
        const dbSourceIds = new Set(dbSources.map((s) => s.id));
        const dbEventIds  = new Set(dbEvents.map((e) => e.id));

        const venues  = [...dbVenues,  ...staticVenues.filter((v) => !dbVenueIds.has(v.id))];
        const deals   = [...dbDeals,   ...staticDeals.filter((d) => !dbDealIds.has(d.id))];
        const sources = [...dbSources, ...staticSources.filter((s) => !dbSourceIds.has(s.id))];
        const events  = [...dbEvents,  ...staticEvents.filter((e) => !dbEventIds.has(e.id))];

        setLiveData(venues, deals, sources, events);
        setFromSupabase(true);
        setLoaded(true);

        console.info(
          `[SipSaver] Live data loaded from Supabase — ${venues.length} venues, ${deals.length} deals`
        );
      } catch (err) {
        if (!cancelled) {
          console.warn("[SipSaver] Supabase fetch threw — using static data", err);
          setLoaded(true);
        }
      }
    }

    void fetchAll();
    return () => { cancelled = true; };
  }, []);

  return { loaded, fromSupabase };
}
