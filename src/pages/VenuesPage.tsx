import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TampaMap } from "../components/TampaMap";
import { getDisplayDeals, getMapVenues } from "../lib/tampaSelectors";
import { useSavedVenues } from "../hooks/useSavedVenues";
import { getVibe } from "../lib/nightPlan";
import { events } from "../data/tampa";
import { useMinuteTick } from "../hooks/useMinuteTick";
import { parseCountdownMinutes } from "../lib/countdownUtils";

export function VenuesPage() {
  useMinuteTick();
  const venues = getMapVenues();
  const deals = getDisplayDeals();
  const { savedVenueIds, isSignedIn, storageMode, toggleSavedVenue } = useSavedVenues();
  const [activeChip, setActiveChip] = useState("All");
  const [activeNeighborhood, setActiveNeighborhood] = useState("All neighborhoods");
  const [query, setQuery] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(venues[0]?.id ?? null);

  const mapChips = ["All", "Saved", "Drinks", "Food", "Live music", "Game night"];
  const neighborhoodChips = [
    "All neighborhoods",
    ...Array.from(new Set(venues.map((venue) => venue.neighborhood))).sort(),
  ];

  // Pre-compute activity data per venue
  const venueActivityMap = useMemo(() => {
    const todayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
    return new Map(venues.map((v) => {
      const venueDeals = deals.filter((d) => d.venueId === v.id);
      const liveCount = venueDeals.filter((d) => d.countdownLabel.includes("left")).length;
      const todayCount = venueDeals.filter((d) => d.day === todayName).length;
      const hasEvents = events.some((e) => e.venueId === v.id);
      const startingSoon = venueDeals.some((d) => {
        if (!d.countdownLabel.includes("Starts")) return false;
        const mins = parseCountdownMinutes(d.countdownLabel);
        return mins !== null && mins <= 90;
      });
      const activityScore = liveCount * 4 + todayCount * 2 + (hasEvents ? 2 : 0) + venueDeals.length;
      const vibe = getVibe(venueDeals.length, liveCount, hasEvents);
      return [v.id, { liveCount, todayCount, hasEvents, startingSoon, activityScore, vibe, totalDeals: venueDeals.length }];
    }));
  }, [venues, deals]);

  const filteredVenues = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    let baseVenues = venues;

    if (activeChip === "Saved") {
      baseVenues = venues.filter((venue) => savedVenueIds.includes(venue.id));
    } else if (activeChip !== "All") {
      const matchingVenueIds = new Set(
        deals.filter((deal) => deal.category === activeChip).map((deal) => deal.venueId)
      );
      baseVenues = venues.filter((venue) => matchingVenueIds.has(venue.id));
    }

    if (activeNeighborhood !== "All neighborhoods") {
      baseVenues = baseVenues.filter((venue) => venue.neighborhood === activeNeighborhood);
    }

    if (normalizedQuery.length > 0) {
      baseVenues = baseVenues.filter((venue) =>
        [venue.name, venue.neighborhood, venue.address].join(" ").toLowerCase().includes(normalizedQuery)
      );
    }

    return [...baseVenues].sort((left, right) => {
      const lScore = venueActivityMap.get(left.id)?.activityScore ?? 0;
      const rScore = venueActivityMap.get(right.id)?.activityScore ?? 0;
      return rScore - lScore || left.name.localeCompare(right.name);
    });
  }, [activeChip, activeNeighborhood, deals, query, savedVenueIds, venues, venueActivityMap]);

  const selectedVenue =
    filteredVenues.find((venue) => venue.id === selectedVenueId) ?? filteredVenues[0] ?? venues[0] ?? null;

  const selectedDeals = selectedVenue
    ? deals.filter((deal) => deal.venueId === selectedVenue.id).slice(0, 2)
    : [];

  return (
    <main className="dashboard page-shell">
      <section className="mobile-section-card mobile-map-discovery">
        <div className="panel-heading">
          <div>
            <p className="section-label">Map</p>
            <h2 className="panel-title">Find the best spots around you</h2>
          </div>
          <p className="panel-caption">{filteredVenues.length} results</p>
        </div>

        <div className="map-filter-strip">
          {mapChips.map((chip) => (
            <button
              key={chip}
              className={`map-filter-chip ${chip === activeChip ? "map-filter-chip-active" : ""}`}
              type="button"
              onClick={() => setActiveChip(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="map-filter-strip">
          {neighborhoodChips.map((chip) => (
            <button
              key={chip}
              className={`map-filter-chip ${chip === activeNeighborhood ? "map-filter-chip-active" : ""}`}
              type="button"
              onClick={() => setActiveNeighborhood(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="search-card mobile-search-card">
          <div className="search-line">
            <span className="search-icon">⌕</span>
            <div className="search-copy">
              <p className="search-label">Search venues</p>
              <input
                className="search-input"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="MacDinton's, Howard Ave, SoHo"
              />
            </div>
          </div>
        </div>

        <TampaMap
          venues={filteredVenues}
          activeNeighborhood="All Tampa"
          selectedVenueId={selectedVenue?.id}
          venueActivity={venueActivityMap}
        />

        <div className="map-card-strip">
          {filteredVenues.slice(0, 16).map((venue) => {
            const venueDeals = deals.filter((deal) => deal.venueId === venue.id).slice(0, 2);
            const isSaved = savedVenueIds.includes(venue.id);
            const isSelected = selectedVenue?.id === venue.id;
            const activity = venueActivityMap.get(venue.id);
            const vibe = activity?.vibe;
            const liveCount = activity?.liveCount ?? 0;
            const totalDeals = activity?.totalDeals ?? 0;

            return (
              <article
                className={`map-discovery-card ${isSelected ? "map-discovery-card-active" : ""}`}
                key={venue.id}
              >
                <button
                  className="map-discovery-card-hit"
                  type="button"
                  onClick={() => setSelectedVenueId(venue.id)}
                >
                  <div className="map-discovery-card-cover">
                    <span className="map-discovery-badge">{venue.neighborhood}</span>
                    {liveCount > 0 && (
                      <span className="map-card-live-badge">
                        <span className="hoppy-live-dot" /> {liveCount} live
                      </span>
                    )}
                  </div>
                  <div className="map-discovery-card-body">
                    <div className="venue-card-header">
                      <div className="zone-card-top">
                        <h4>{venue.name}</h4>
                        <span>{venue.address}</span>
                      </div>
                    </div>

                    {vibe && (
                      <div className="map-card-vibe-row">
                        <span className={`map-card-vibe-pill ${vibe.cls}`}>{vibe.icon} {vibe.label}</span>
                        {totalDeals > 0 && <span className="map-card-deal-count">{totalDeals} deal{totalDeals !== 1 ? "s" : ""}</span>}
                      </div>
                    )}

                    <div className="chip-row tight">
                      {venueDeals.length > 0 ? (
                        venueDeals.map((deal) => (
                          <span className="micro-chip" key={deal.id}>
                            {deal.category}
                          </span>
                        ))
                      ) : (
                        <span className="micro-chip">No live card yet</span>
                      )}
                    </div>

                    <div className="map-discovery-actions">
                      <Link className="inline-panel-link" to={`/venues/${venue.id}`}>
                        Open venue
                      </Link>
                      <button
                        className={`save-button ${isSaved ? "save-button-active" : ""}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void toggleSavedVenue(venue.id);
                        }}
                      >
                        {isSaved ? "Saved" : "Save"}
                      </button>
                    </div>
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="page-hero panel">
        <p className="section-label">Venue directory</p>
        <h2 className="panel-title">Every bar, restaurant & brewery we track in Tampa.</h2>
        <p className="hero-subcopy">
          {venues.length} spots mapped across {Array.from(new Set(venues.map(v => v.neighborhood))).length} neighborhoods. Tap any venue for deals, hours, and directions.
        </p>
      </section>

      <section className="page-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">Venue coverage</p>
              <h3 className="panel-title">Live Tampa venue list</h3>
            </div>
            <p className="panel-caption">
            {filteredVenues.length} shown • {venues.length} mapped spots • {savedVenueIds.length} saved
            </p>
          </div>

          <div className="map-filter-strip">
            {neighborhoodChips.map((chip) => (
              <button
                key={`desktop-${chip}`}
                className={`map-filter-chip ${chip === activeNeighborhood ? "map-filter-chip-active" : ""}`}
                type="button"
                onClick={() => setActiveNeighborhood(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="venue-directory-grid">
            {filteredVenues.map((venue) => {
              const venueDeals = deals.filter((deal) => deal.venueId === venue.id).slice(0, 2);
              const isSaved = savedVenueIds.includes(venue.id);
              const activity = venueActivityMap.get(venue.id);
              const vibe = activity?.vibe;
              const liveCount = activity?.liveCount ?? 0;
              const totalDeals = activity?.totalDeals ?? 0;

              return (
                <article className="venue-directory-card" key={venue.id}>
                  <div className="venue-card-header">
                    <Link className="venue-card-link" to={`/venues/${venue.id}`}>
                      <div className="zone-card-top">
                        <h4>{venue.name}</h4>
                        <span className="venue-dir-neighborhood">{venue.neighborhood}</span>
                      </div>
                    </Link>
                    <button
                      className={`save-button ${isSaved ? "save-button-active" : ""}`}
                      type="button"
                      onClick={() => void toggleSavedVenue(venue.id)}
                    >
                      {isSaved ? "Saved" : "Save"}
                    </button>
                  </div>
                  <p className="venue-dir-address">{venue.address}</p>
                  {vibe && (
                    <div className="venue-dir-vibe-row">
                      <span className={`venue-dir-vibe-pill ${vibe.cls}`}>{vibe.icon} {vibe.label}</span>
                      {liveCount > 0 && (
                        <span className="venue-dir-live">
                          <span className="hoppy-live-dot" />{liveCount} live
                        </span>
                      )}
                      {totalDeals > 0 && liveCount === 0 && (
                        <span className="venue-dir-deal-count">{totalDeals} deal{totalDeals !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  )}
                  <div className="chip-row tight">
                    {venueDeals.length > 0 ? (
                      venueDeals.map((deal) => (
                        <span className="micro-chip" key={deal.id}>
                          {deal.category}
                        </span>
                      ))
                    ) : (
                      <span className="micro-chip">No live card yet</span>
                    )}
                  </div>
                  <Link className="inline-panel-link" to={`/venues/${venue.id}`}>
                    View venue page
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="side-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Map focus</p>
                <h3 className="panel-title">Current selected venue</h3>
              </div>
            </div>
            {selectedVenue ? (
              <div className="zone-stack">
                <article className="zone-card">
                  <div className="zone-card-top">
                    <h4>{selectedVenue.name}</h4>
                    <span>{selectedVenue.neighborhood}</span>
                  </div>
                  <p>{selectedVenue.address}</p>
                </article>
                {selectedDeals.length > 0 ? (
                  selectedDeals.map((deal) => (
                    <article className="zone-card" key={deal.id}>
                      <p>{deal.description}</p>
                    </article>
                  ))
                ) : (
                  <article className="zone-card">
                    <p>No promoted deal card yet, but this venue is already on the live Tampa map.</p>
                  </article>
                )}
                <article className="zone-card">
                  <p>
                    {isSignedIn
                      ? `Save is live now using ${storageMode === "supabase" ? "Supabase" : "local fallback"} storage`
                      : "Sign in to start saving venues"}
                  </p>
                </article>
              </div>
            ) : null}
            <Link className="inline-panel-link" to="/">
              Back to discover
            </Link>
          </section>
        </aside>
      </section>
    </main>
  );
}
