/**
 * Module-level data store for SipSaver.
 *
 * Starts with the static Tampa data so the app renders instantly.
 * When Supabase data loads, setLiveData() replaces it and notifies
 * any subscribed React hooks to trigger a re-render.
 */

import {
  deals as staticDeals,
  events as staticEvents,
  sources as staticSources,
  venues as staticVenues,
} from "../data/tampa";
import type { Deal, EventCard, SourceRecord, Venue } from "../data/types";

let _venues: Venue[]        = staticVenues;
let _deals: Deal[]          = staticDeals;
let _sources: SourceRecord[] = staticSources;
let _events: EventCard[]    = staticEvents;
let _fromSupabase           = false;
let _listeners: Array<() => void> = [];

export function getStoredVenues():  Venue[]         { return _venues; }
export function getStoredDeals():   Deal[]           { return _deals; }
export function getStoredSources(): SourceRecord[]   { return _sources; }
export function getStoredEvents():  EventCard[]      { return _events; }
export function isDataFromSupabase(): boolean        { return _fromSupabase; }

/** Replace store contents with live Supabase data and notify listeners. */
export function setLiveData(
  venues:  Venue[],
  deals:   Deal[],
  sources: SourceRecord[],
  events:  EventCard[],
) {
  _venues  = venues;
  _deals   = deals;
  _sources = sources;
  _events  = events;
  _fromSupabase = true;
  _listeners.forEach((fn) => fn());
}

/** Subscribe to store changes. Returns an unsubscribe function. */
export function subscribeToDataChanges(fn: () => void): () => void {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((l) => l !== fn); };
}
