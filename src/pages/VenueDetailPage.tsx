import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMinuteTick } from "../hooks/useMinuteTick";
import { getVenueDealBadgeVariant } from "../lib/countdownUtils";
import { events } from "../data/tampa";
import { useSavedVenues } from "../hooks/useSavedVenues";
import { useRewards } from "../hooks/useRewards";
import { getVenueProfileById, getMapVenues } from "../lib/tampaSelectors";
import { getVibe } from "../lib/nightPlan";
import { getDisplayDeals } from "../lib/tampaSelectors";

const NEIGHBORHOOD_COLORS: Record<string, string> = {
  "SoHo": "venue-hero-soho",
  "Downtown Tampa": "venue-hero-downtown",
  "Ybor": "venue-hero-ybor",
  "Channelside": "venue-hero-channelside",
  "Seminole Heights": "venue-hero-seminole",
  "Tampa Heights": "venue-hero-heights",
  "Hyde Park": "venue-hero-hyde",
  "Westshore": "venue-hero-westshore",
};

const CATEGORY_ICON: Record<string, string> = {
  "Drinks": "🍸",
  "Food": "🍽",
  "Live music": "♪",
  "Game night": "🎮",
};

export function VenueDetailPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const { savedVenueIds, toggleSavedVenue, isSignedIn } = useSavedVenues();
  const { checkIn, hasCheckedInRecently, state: rewardsState } = useRewards();
  useMinuteTick(); // keeps countdown labels live
  const [checkInFlash, setCheckInFlash] = useState(false);
  const [shareFlash, setShareFlash] = useState(false);

  // Record this venue as recently viewed
  useEffect(() => {
    if (!venueId) return;
    try {
      const raw = localStorage.getItem("sipsaver_recent_venues");
      const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      const next = [venueId, ...ids.filter((id) => id !== venueId)].slice(0, 8);
      localStorage.setItem("sipsaver_recent_venues", JSON.stringify(next));
    } catch { /* ignore */ }
  }, [venueId]);

  function handleSave() {
    if (!isSignedIn) {
      navigate("/login");
      return;
    }
    void toggleSavedVenue(venueId!);
  }

  function handleCheckIn() {
    if (!profile) return;
    const topDeal = profile.deals[0];
    checkIn({ id: venue.id, name: venue.name, neighborhood: venue.neighborhood }, topDeal?.description);
    setCheckInFlash(true);
    setTimeout(() => setCheckInFlash(false), 2500);
  }

  function handleShare() {
    if (!profile) return;
    const topDeal = profile.deals[0];
    const dealLine = topDeal ? ` — ${topDeal.description.slice(0, 60)}${topDeal.description.length > 60 ? "…" : ""}` : "";
    const shareText = `Check out ${venue.name} in ${venue.neighborhood}${dealLine} via SipSaver`;
    const shareUrl = window.location.href;
    if (navigator.share) {
      void navigator.share({ title: venue.name, text: shareText, url: shareUrl });
    } else {
      void navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
        setShareFlash(true);
        setTimeout(() => setShareFlash(false), 2000);
      });
    }
  }

  if (!venueId) return <Navigate to="/venues" replace />;

  let profile: ReturnType<typeof getVenueProfileById> | null = null;
  try {
    profile = getVenueProfileById(venueId);
  } catch {
    return <Navigate to="/venues" replace />;
  }

  const { venue, deals, sources } = profile;
  const venueEvents = events.filter((e) => e.venueId === venue.id);
  const isSaved = savedVenueIds.includes(venue.id);
  const alreadyCheckedIn = hasCheckedInRecently(venue.id);
  const heroClass = NEIGHBORHOOD_COLORS[venue.neighborhood] ?? "venue-hero-default";
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name + " " + venue.address)}`;
  const allDeals = getDisplayDeals();
  const venueAllDeals = allDeals.filter((d) => d.venueId === venue.id);
  const liveCount = venueAllDeals.filter((d) => d.countdownLabel.includes("left")).length;
  const vibe = getVibe(venueAllDeals.length, liveCount, venueEvents.length > 0);

  // Nearby venues in the same neighborhood
  const allVenues = getMapVenues();
  const nearbyVenues = allVenues
    .filter((v) => v.id !== venue.id && v.neighborhood === venue.neighborhood)
    .map((v) => {
      const vDeals = allDeals.filter((d) => d.venueId === v.id);
      const vLive = vDeals.filter((d) => d.countdownLabel.includes("left")).length;
      const vEvents = events.some((e) => e.venueId === v.id);
      const score = vLive * 4 + vDeals.length;
      return { venue: v, dealCount: vDeals.length, liveCount: vLive, topDeal: vDeals[0], vibe: getVibe(vDeals.length, vLive, vEvents), score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return (
    <main className="venue-detail-page">

      {/* Hero */}
      <section className={`venue-detail-hero-mobile ${heroClass}`}>
        <div className="venue-detail-hero-inner">
          <Link className="venue-back-link" to="/venues">← Back</Link>
          <div className="venue-hero-content">
            <p className="venue-hero-neighborhood">{venue.neighborhood}</p>
            <h1 className="venue-hero-name">{venue.name}</h1>
            <p className="venue-hero-address">{venue.address}</p>
          </div>
          <button
            className={`venue-save-fab ${isSaved ? "venue-save-fab-active" : ""}`}
            type="button"
            aria-label={isSaved ? "Unsave venue" : "Save venue"}
            onClick={handleSave}
          >
            {isSaved ? "♥" : "♡"}
          </button>
        </div>

        <div className="venue-hero-vibe-row">
          <span className={`venue-vibe-pill ${vibe.cls}`}>{vibe.icon} {vibe.label}</span>
          {liveCount > 0 && <span className="venue-vibe-live-dot-row"><span className="hoppy-live-dot" /> {liveCount} deal{liveCount !== 1 ? "s" : ""} live now</span>}
        </div>

        <div className="venue-hero-stats">
          <div className="venue-hero-stat">
            <strong>{deals.length}</strong>
            <span>deals</span>
          </div>
          <div className="venue-hero-stat">
            <strong>{venueEvents.length}</strong>
            <span>events</span>
          </div>
          <div className="venue-hero-stat">
            <strong>{rewardsState.checkIns.filter(c => c.venueId === venue.id).length}</strong>
            <span>check-ins</span>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="venue-actions-row">
        <button
          className={`venue-action-btn ${alreadyCheckedIn ? "venue-action-checkin-done" : "venue-action-checkin"}`}
          type="button"
          onClick={handleCheckIn}
          disabled={alreadyCheckedIn}
        >
          {checkInFlash ? `✓ +50 pts!` : alreadyCheckedIn ? "✓ Checked in" : "📍 Check in"}
        </button>
        {venue.website ? (
          <a className="venue-action-btn venue-action-primary" href={venue.website} rel="noreferrer" target="_blank">
            Website
          </a>
        ) : null}
        <button
          className="venue-action-btn venue-action-share"
          type="button"
          onClick={handleShare}
          title="Share this venue"
        >
          {shareFlash ? "✓ Copied!" : "↑ Share"}
        </button>
        <a className="venue-action-btn venue-action-secondary" href={googleMapsUrl} rel="noreferrer" target="_blank">
          Directions
        </a>
      </section>

      {/* Deals */}
      <section className="venue-section">
        <p className="venue-section-label">
          {deals.length > 0 ? `${deals.length} deal${deals.length !== 1 ? "s" : ""}` : "Deals"}
        </p>
        {deals.length > 0 ? (
          <div className="venue-deal-stack">
            {deals.map((deal) => (
              <article className="venue-deal-card" key={deal.id}>
                <div className="venue-deal-card-top">
                  <span className="venue-deal-icon">{CATEGORY_ICON[deal.category] ?? "🍺"}</span>
                  <div className="venue-deal-head">
                    <div className="venue-deal-meta">
                      <span className="venue-deal-category">{deal.category}</span>
                      <span className="venue-deal-dot">·</span>
                      <span className="venue-deal-day">{deal.day}</span>
                    </div>
                    <p className="venue-deal-time">{deal.time}</p>
                  </div>
                  <span className={`venue-deal-badge ${getVenueDealBadgeVariant(deal.countdownLabel)}`}>
                    {deal.countdownLabel}
                  </span>
                </div>
                <p className="venue-deal-desc">{deal.description}</p>
                <div className="venue-deal-chips">
                  {deal.priceLabel && <span className="micro-chip">{deal.priceLabel}</span>}
                  <span className="micro-chip">{deal.trustLabel}</span>
                  <span className="micro-chip">{deal.sourceKindLabel}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="venue-empty">
            <p>No deals confirmed yet. Check back — we scrape new venues regularly.</p>
          </div>
        )}
      </section>

      {/* Events */}
      {venueEvents.length > 0 && (
        <section className="venue-section">
          <p className="venue-section-label">{venueEvents.length} event{venueEvents.length !== 1 ? "s" : ""}</p>
          <div className="venue-event-stack">
            {venueEvents.map((event) => (
              <article className="venue-event-card" key={event.id}>
                <span className="venue-event-icon">{event.type === "Live music" ? "♪" : "?"}</span>
                <div>
                  <p className="venue-event-type">{event.type}</p>
                  <h4 className="venue-event-title">{event.title}</h4>
                  <p className="venue-event-time">{event.time}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Source info */}
      {sources.length > 0 && (
        <section className="venue-section venue-section-sources">
          <p className="venue-section-label">Sources ({sources.length})</p>
          <div className="venue-source-list">
            {sources.map((source) => (
              <a
                key={source.id}
                className="venue-source-row"
                href={source.url}
                rel="noreferrer"
                target="_blank"
              >
                <div>
                  <p className="venue-source-label">{source.label}</p>
                  <p className="venue-source-meta">{source.kind} · checked {source.lastChecked}</p>
                </div>
                <span className={`venue-source-badge ${source.reliability === "high" ? "venue-source-badge-high" : ""}`}>
                  {source.reliability}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* More in neighborhood */}
      {nearbyVenues.length > 0 && (
        <section className="venue-section venue-nearby-section">
          <p className="venue-section-label">More in {venue.neighborhood}</p>
          <div className="venue-nearby-rail">
            {nearbyVenues.map(({ venue: nv, dealCount, liveCount: nvLive, topDeal, vibe: nvVibe }) => (
              <Link key={nv.id} className="venue-nearby-card" to={`/venues/${nv.id}`}>
                <div className="venue-nearby-card-top">
                  {nvVibe.cls !== "vibe-chill" && (
                    <span className={`venue-nearby-vibe ${nvVibe.cls}`}>{nvVibe.icon}</span>
                  )}
                  {nvLive > 0 && (
                    <span className="venue-nearby-live">
                      <span className="hoppy-live-dot" />{nvLive} live
                    </span>
                  )}
                </div>
                <p className="venue-nearby-name">{nv.name}</p>
                <p className="venue-nearby-count">
                  {dealCount} deal{dealCount !== 1 ? "s" : ""}
                </p>
                {topDeal && (
                  <p className="venue-nearby-deal">
                    {topDeal.time} · {topDeal.description.slice(0, 42)}{topDeal.description.length > 42 ? "…" : ""}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="venue-detail-footer">
        <Link className="inline-panel-link" to="/venues">← Back to map</Link>
      </div>
    </main>
  );
}
