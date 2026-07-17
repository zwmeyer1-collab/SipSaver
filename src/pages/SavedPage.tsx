import { useState } from "react";
import { Link } from "react-router-dom";
import { getDisplayDeals, getMapVenues } from "../lib/tampaSelectors";
import { useSavedVenues } from "../hooks/useSavedVenues";
import { useRewards } from "../hooks/useRewards";
import { getVibe } from "../lib/nightPlan";
import { events } from "../data/tampa";
import { useMinuteTick } from "../hooks/useMinuteTick";

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG: Record<string, string> = {
  Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday",
  Thu: "Thursday", Fri: "Friday", Sat: "Saturday",
};

export function SavedPage() {
  useMinuteTick();
  const venues = getMapVenues();
  const deals = getDisplayDeals();
  const { savedVenueIds, isSignedIn, toggleSavedVenue } = useSavedVenues();
  const { checkIn, hasCheckedInRecently } = useRewards();
  const [flashVenueId, setFlashVenueId] = useState<string | null>(null);

  const todayShort = ALL_DAYS[new Date().getDay()];
  const todayLong = DAY_LONG[todayShort];
  const isWeekendToday = todayShort === "Sat" || todayShort === "Sun";

  function isTodayDeal(day: string) {
    return day === todayLong || day === "Daily" ||
      (day === "Weekdays" && !isWeekendToday) ||
      (day === "Weekends" && isWeekendToday);
  }

  function handleCheckIn(venue: { id: string; name: string; neighborhood: string }, dealDesc?: string) {
    checkIn(venue, dealDesc);
    setFlashVenueId(venue.id);
    setTimeout(() => setFlashVenueId(null), 2200);
  }

  // Enrich saved venues with activity data, sorted by live deals → today deals → rest
  const rawSaved = venues.filter((v) => savedVenueIds.includes(v.id));
  const savedVenues = rawSaved
    .map((venue) => {
      const venueDeals = deals.filter((d) => d.venueId === venue.id);
      const liveDeals = venueDeals.filter((d) => d.countdownLabel.includes("left"));
      const todayDeals = venueDeals.filter((d) => isTodayDeal(d.day));
      const hasEvents = events.some((e) => e.venueId === venue.id);
      const vibe = getVibe(venueDeals.length, liveDeals.length, hasEvents);
      const topDeal = liveDeals[0] ?? todayDeals[0] ?? venueDeals[0];
      const score = liveDeals.length * 4 + todayDeals.length * 2 + venueDeals.length;
      return { venue, venueDeals, liveDeals, todayDeals, vibe, topDeal, score };
    })
    .sort((a, b) => b.score - a.score);

  const totalLive = savedVenues.reduce((n, v) => n + v.liveDeals.length, 0);

  return (
    <main className="dashboard page-shell saved-page">

      {/* Hero */}
      <section className="saved-hero mobile-section-card">
        <div className="saved-hero-row">
          <div>
            <p className="section-label">Your list</p>
            <h1 className="saved-hero-title">Saved spots</h1>
          </div>
          {totalLive > 0 && (
            <span className="saved-live-badge">
              <span className="live-now-pulse" />
              {totalLive} live now
            </span>
          )}
        </div>
        {savedVenues.length > 0 && (
          <p className="saved-hero-sub">{savedVenues.length} venue{savedVenues.length !== 1 ? "s" : ""} saved · sorted by tonight&apos;s activity</p>
        )}
      </section>

      {!isSignedIn ? (
        <section className="saved-signin-prompt mobile-section-card">
          <div className="saved-prompt-icon">♡</div>
          <h2 className="saved-prompt-title">Sign in to save venues</h2>
          <p className="saved-prompt-sub">
            Save your favorite spots and get deal updates across sessions. Your saves sync to your account.
          </p>
          <Link className="crawl-generate-btn saved-signin-btn" to="/login">
            Sign in or create account
          </Link>
          <p className="saved-prompt-note">
            Already tapping Save? Your picks are stored locally right now — they&apos;ll sync once you sign in.
          </p>
        </section>
      ) : savedVenues.length === 0 ? (
        <section className="saved-empty mobile-section-card">
          <div className="saved-prompt-icon">🍺</div>
          <h2 className="saved-prompt-title">No saves yet</h2>
          <p className="saved-prompt-sub">
            Tap the heart on any venue to build your go-to list. Great for bar crawl planning.
          </p>
          <Link className="crawl-generate-btn" to="/venues">Browse venues</Link>
        </section>
      ) : (
        <section className="saved-list mobile-section-card">
          {savedVenues.map(({ venue, venueDeals, liveDeals, todayDeals, vibe, topDeal }) => {
            const alreadyCheckedIn = hasCheckedInRecently(venue.id);
            const isFlashing = flashVenueId === venue.id;

            return (
              <article className="saved-venue-card" key={venue.id}>

                {/* Header row */}
                <div className="saved-venue-head">
                  <div className="saved-venue-info">
                    <div className="saved-venue-meta-row">
                      <p className="saved-venue-neighborhood">{venue.neighborhood}</p>
                      {vibe.cls !== "vibe-chill" && (
                        <span className={`saved-vibe-pill ${vibe.cls}`}>{vibe.icon} {vibe.label}</span>
                      )}
                    </div>
                    <Link className="saved-venue-name" to={`/venues/${venue.id}`}>
                      {venue.name}
                    </Link>
                    <p className="saved-venue-stats">
                      {venueDeals.length} deal{venueDeals.length !== 1 ? "s" : ""}
                      {todayDeals.length > 0 && ` · ${todayDeals.length} today`}
                      {liveDeals.length > 0 && <span className="saved-live-dot-text"> · {liveDeals.length} live now</span>}
                    </p>
                  </div>
                  <div className="saved-venue-actions">
                    <button
                      className={`saved-checkin-btn ${alreadyCheckedIn ? "saved-checkin-done" : ""}`}
                      type="button"
                      disabled={alreadyCheckedIn}
                      onClick={() => handleCheckIn({ id: venue.id, name: venue.name, neighborhood: venue.neighborhood }, topDeal?.description)}
                    >
                      {isFlashing ? "✓ +50" : alreadyCheckedIn ? "✓" : "📍"}
                    </button>
                    <button
                      className="saved-unsave-btn"
                      type="button"
                      onClick={() => void toggleSavedVenue(venue.id)}
                      aria-label="Unsave"
                    >
                      ♥
                    </button>
                  </div>
                </div>

                {/* Top deal */}
                {topDeal ? (
                  <div className={`saved-venue-deal ${liveDeals.length > 0 ? "saved-venue-deal-live" : ""}`}>
                    <div className="saved-deal-header">
                      <span className="saved-deal-label">{topDeal.category}</span>
                      <span className="saved-deal-time">{topDeal.day} · {topDeal.time}</span>
                      <span className={`saved-deal-countdown ${
                        topDeal.countdownLabel.includes("left") ? "saved-countdown-live" :
                        topDeal.countdownLabel.includes("Starts") ? "saved-countdown-soon" : ""
                      }`}>
                        {topDeal.countdownLabel}
                      </span>
                    </div>
                    <p className="saved-deal-desc">{topDeal.description}</p>
                    {venueDeals.length > 1 && (
                      <Link className="saved-all-deals-link" to={`/venues/${venue.id}`}>
                        +{venueDeals.length - 1} more deal{venueDeals.length - 1 !== 1 ? "s" : ""} →
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="saved-venue-nodeal">
                    <p>No active deal — check back soon.</p>
                    <Link className="inline-panel-link" to={`/venues/${venue.id}`}>View venue</Link>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {savedVenues.length > 0 && (
        <section className="saved-crawl-cta mobile-section-card">
          <p className="section-label">Ready to go out?</p>
          <h3 className="saved-cta-title">Turn your saves into a night plan</h3>
          <p className="saved-cta-sub">Build a route or plan the whole night with deals you already like.</p>
          <div className="saved-cta-btns">
            <Link className="crawl-generate-btn" to="/hoppy">🍻 Hoppy Hour plan</Link>
            <Link className="inline-panel-link" to="/crawl">Bar Crawl →</Link>
          </div>
        </section>
      )}
    </main>
  );
}
