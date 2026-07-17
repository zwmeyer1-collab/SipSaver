import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getDisplayDeals, getMapVenues } from "../lib/tampaSelectors";
import { useMinuteTick } from "../hooks/useMinuteTick";
import { events } from "../data/tampa";
import {
  type NightPlan,
  type NightPlanStop,
  encodePlan,
  decodePlan,
  savePlan,
  loadPlan,
  clearPlan,
  getVotedVenueIds,
  markVoted,
  generatePlanId,
  getVibe,
} from "../lib/nightPlan";

const START_TIMES = [
  "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM",
];

type PlanView = "landing" | "build" | "active" | "join";

function copyToClipboard(text: string, onDone: () => void) {
  void navigator.clipboard.writeText(text).then(onDone);
}

export function HoppyHourPage() {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<PlanView>("landing");
  const [activePlan, setActivePlan] = useState<NightPlan | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpStatus, setRsvpStatus] = useState<"going" | "maybe" | null>(null);
  const [showRsvpInput, setShowRsvpInput] = useState(false);

  // Build-plan state
  const [planName, setPlanName] = useState("");
  const [planNeighborhood, setPlanNeighborhood] = useState("SoHo");
  const [planStartTime, setPlanStartTime] = useState("9:00 PM");
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);

  useMinuteTick(); // keeps countdown labels and live deal counts fresh
  const displayDeals = getDisplayDeals();
  const mapVenues = getMapVenues();
  const todayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
  const todayLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
  const isWeekend = todayShort === "Sat" || todayShort === "Sun";

  // Check for shared plan in URL
  useEffect(() => {
    const encoded = searchParams.get("plan");
    if (encoded) {
      const shared = decodePlan(encoded);
      if (shared) {
        setActivePlan(shared);
        setView("join");
        return;
      }
    }
    // Check localStorage
    const saved = loadPlan();
    if (saved) {
      setActivePlan(saved);
      setView("active");
    }
    setVotedIds(getVotedVenueIds());
  }, [searchParams]);

  // ── Trending venues (sorted by live deal density + events) ─────────────────
  const trendingVenues = mapVenues
    .map((venue) => {
      const venueDeals = displayDeals.filter((d) => d.venueId === venue.id);
      const todayDeals = venueDeals.filter((d) => {
        return (
          d.day === todayLong ||
          d.day === "Daily" ||
          (d.day === "Weekdays" && !isWeekend) ||
          (d.day === "Weekends" && isWeekend)
        );
      });
      const liveDeals = venueDeals.filter((d) => d.countdownLabel.includes("left"));
      const venueEvents = events.filter((e) => e.venueId === venue.id);
      const vibe = getVibe(todayDeals.length, liveDeals.length, venueEvents.length > 0);
      const topDeal = todayDeals[0] ?? venueDeals[0];
      return {
        venue,
        dealCount: venueDeals.length,
        todayCount: todayDeals.length,
        liveCount: liveDeals.length,
        hasEvents: venueEvents.length > 0,
        vibe,
        topDeal,
      };
    })
    .filter((v) => v.dealCount > 0)
    .sort((a, b) => (b.liveCount * 3 + b.todayCount + (b.hasEvents ? 2 : 0)) - (a.liveCount * 3 + a.todayCount + (a.hasEvents ? 2 : 0)))
    .slice(0, 8);

  // ── Venues available to pick for a plan ────────────────────────────────────
  const neighborhoods = ["All Tampa", ...Array.from(new Set(mapVenues.map((v) => v.neighborhood))).sort()];

  const pickableVenues = mapVenues
    .filter((v) => planNeighborhood === "All Tampa" || v.neighborhood === planNeighborhood)
    .map((v) => {
      const venueDeals = displayDeals.filter((d) => d.venueId === v.id);
      const todayDeals = venueDeals.filter((d) => {
        return (
          d.day === todayLong || d.day === "Daily" ||
          (d.day === "Weekdays" && !isWeekend) || (d.day === "Weekends" && isWeekend)
        );
      });
      const topDeal = todayDeals[0] ?? venueDeals[0];
      return { venue: v, dealCount: venueDeals.length, todayCount: todayDeals.length, topDeal };
    })
    .filter((v) => v.dealCount > 0)
    .sort((a, b) => b.todayCount - a.todayCount || b.dealCount - a.dealCount)
    .slice(0, 16);

  function toggleVenueSelection(venueId: string) {
    setSelectedVenueIds((prev) =>
      prev.includes(venueId)
        ? prev.filter((id) => id !== venueId)
        : prev.length < 5
        ? [...prev, venueId]
        : prev
    );
  }

  function handleCreatePlan() {
    const name = planName.trim() || `${planNeighborhood} Night Out`;
    const stops: NightPlanStop[] = selectedVenueIds
      .map((id) => {
        const entry = pickableVenues.find((v) => v.venue.id === id);
        if (!entry) return null;
        return {
          venueId: entry.venue.id,
          venueName: entry.venue.name,
          neighborhood: entry.venue.neighborhood,
          dealDesc: entry.topDeal?.description ?? "",
          dealTime: entry.topDeal?.time ?? "",
          votes: 0,
        } satisfies NightPlanStop;
      })
      .filter((s): s is NightPlanStop => s !== null);

    const plan: NightPlan = {
      id: generatePlanId(),
      name,
      startTime: planStartTime,
      neighborhood: planNeighborhood,
      stops,
      rsvps: [{ name: "You", status: "going" }],
      createdAt: new Date().toISOString(),
    };

    savePlan(plan);
    setActivePlan(plan);
    setView("active");
  }

  function handleVote(venueId: string) {
    if (!activePlan || votedIds.has(venueId)) return;
    const updated: NightPlan = {
      ...activePlan,
      stops: activePlan.stops.map((s) =>
        s.venueId === venueId ? { ...s, votes: s.votes + 1 } : s
      ),
    };
    savePlan(updated);
    setActivePlan(updated);
    markVoted(venueId);
    setVotedIds(new Set([...votedIds, venueId]));
  }

  function handleRsvp(status: "going" | "maybe") {
    setRsvpStatus(status);
    setShowRsvpInput(true);
  }

  function submitRsvp() {
    if (!activePlan || !rsvpStatus || !rsvpName.trim()) return;
    const updated: NightPlan = {
      ...activePlan,
      rsvps: [
        ...activePlan.rsvps.filter((r) => r.name !== rsvpName.trim()),
        { name: rsvpName.trim(), status: rsvpStatus },
      ],
    };
    savePlan(updated);
    setActivePlan(updated);
    setShowRsvpInput(false);
    setRsvpName("");
  }

  function handleShare() {
    if (!activePlan) return;
    const url = `${window.location.origin}/hoppy?plan=${encodePlan(activePlan)}`;
    if (navigator.share) {
      void navigator.share({ title: activePlan.name, text: `Join my night plan on SipSaver!`, url });
    } else {
      copyToClipboard(url, () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  }

  function handleClearPlan() {
    clearPlan();
    setActivePlan(null);
    setView("landing");
    setSelectedVenueIds([]);
    setPlanName("");
  }

  function handleJoinPlan() {
    if (!activePlan) return;
    savePlan(activePlan);
    setView("active");
  }

  const goingCount = activePlan?.rsvps.filter((r) => r.status === "going").length ?? 0;
  const maybeCount = activePlan?.rsvps.filter((r) => r.status === "maybe").length ?? 0;
  const sortedStops = activePlan
    ? [...activePlan.stops].sort((a, b) => b.votes - a.votes)
    : [];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <main className="dashboard page-shell hoppy-page">

      {/* ── JOIN VIEW (shared plan link) ───────────────────────────────── */}
      {view === "join" && activePlan && (
        <>
          <section className="hoppy-hero mobile-section-card hoppy-hero-join">
            <div className="hoppy-hero-top">
              <p className="hoppy-hero-kicker">🍺 You're invited</p>
              <h1 className="hoppy-hero-title">{activePlan.name}</h1>
              <p className="hoppy-hero-sub">
                Starting {activePlan.startTime} · {activePlan.neighborhood} ·{" "}
                {activePlan.stops.length} stop{activePlan.stops.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="hoppy-join-actions">
              <button className="hoppy-rsvp-btn hoppy-rsvp-going" type="button" onClick={handleJoinPlan}>
                🙌 I'm going
              </button>
              <button className="hoppy-rsvp-btn hoppy-rsvp-maybe" type="button" onClick={() => { setView("active"); }}>
                🤔 Maybe
              </button>
            </div>
          </section>

          <section className="mobile-section-card">
            <p className="section-label">The route</p>
            <div className="plan-stop-list">
              {activePlan.stops.map((stop, i) => (
                <div className="plan-stop-row" key={stop.venueId}>
                  <div className="plan-stop-num">{i + 1}</div>
                  <div className="plan-stop-body">
                    <p className="plan-stop-name">{stop.venueName}</p>
                    <p className="plan-stop-meta">{stop.neighborhood}{stop.dealTime ? ` · ${stop.dealTime}` : ""}</p>
                    {stop.dealDesc && <p className="plan-stop-deal">{stop.dealDesc}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── ACTIVE PLAN VIEW ───────────────────────────────────────────── */}
      {view === "active" && activePlan && (
        <>
          <section className="hoppy-active-hero mobile-section-card">
            <div className="hoppy-active-top">
              <div>
                <p className="hoppy-plan-kicker">Tonight's plan</p>
                <h1 className="hoppy-plan-title">{activePlan.name}</h1>
                <p className="hoppy-plan-meta">
                  {activePlan.startTime} · {activePlan.neighborhood} · {activePlan.stops.length} stops
                </p>
              </div>
              <button className="hoppy-share-btn" type="button" onClick={handleShare}>
                {copied ? "✓ Copied!" : "Share →"}
              </button>
            </div>

            <div className="hoppy-rsvp-counts">
              <span className="hoppy-rsvp-count hoppy-rsvp-count-going">
                🙌 {goingCount} going
              </span>
              {maybeCount > 0 && (
                <span className="hoppy-rsvp-count hoppy-rsvp-count-maybe">
                  🤔 {maybeCount} maybe
                </span>
              )}
              <div className="hoppy-rsvp-avatars">
                {activePlan.rsvps.map((r) => (
                  <div
                    key={r.name}
                    className={`hoppy-avatar ${r.status === "going" ? "hoppy-avatar-going" : "hoppy-avatar-maybe"}`}
                    title={`${r.name} (${r.status})`}
                  >
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            {!showRsvpInput ? (
              <div className="hoppy-rsvp-row">
                <p className="hoppy-rsvp-label">Update your RSVP:</p>
                <button className="hoppy-rsvp-btn hoppy-rsvp-going" type="button" onClick={() => handleRsvp("going")}>Going</button>
                <button className="hoppy-rsvp-btn hoppy-rsvp-maybe" type="button" onClick={() => handleRsvp("maybe")}>Maybe</button>
              </div>
            ) : (
              <div className="hoppy-rsvp-name-row">
                <input
                  className="hoppy-name-input"
                  type="text"
                  placeholder="Your name"
                  value={rsvpName}
                  onChange={(e) => setRsvpName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitRsvp(); }}
                  autoFocus
                />
                <button className="hoppy-rsvp-btn hoppy-rsvp-going" type="button" onClick={submitRsvp}>
                  Done
                </button>
              </div>
            )}
          </section>

          <section className="mobile-section-card">
            <div className="panel-heading">
              <div>
                <p className="section-label">The route</p>
                <h3 className="panel-title">Vote on where to go next</h3>
              </div>
            </div>
            <div className="plan-stop-list">
              {sortedStops.map((stop, i) => (
                <div className="plan-stop-row plan-stop-row-vote" key={stop.venueId}>
                  <div className="plan-stop-num">{i + 1}</div>
                  <div className="plan-stop-body">
                    <Link className="plan-stop-name plan-stop-link" to={`/venues/${stop.venueId}`}>
                      {stop.venueName}
                    </Link>
                    <p className="plan-stop-meta">
                      {stop.neighborhood}{stop.dealTime ? ` · ${stop.dealTime}` : ""}
                    </p>
                    {stop.dealDesc && <p className="plan-stop-deal">{stop.dealDesc.slice(0, 72)}{stop.dealDesc.length > 72 ? "…" : ""}</p>}
                  </div>
                  <button
                    className={`plan-vote-btn ${votedIds.has(stop.venueId) ? "plan-vote-btn-voted" : ""}`}
                    type="button"
                    disabled={votedIds.has(stop.venueId)}
                    onClick={() => handleVote(stop.venueId)}
                  >
                    <span className="plan-vote-icon">▲</span>
                    <span className="plan-vote-count">{stop.votes}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="mobile-section-card hoppy-plan-actions">
            <button className="hoppy-share-full-btn" type="button" onClick={handleShare}>
              {copied ? "✓ Link copied!" : "📲 Share this plan with friends"}
            </button>
            <button className="hoppy-clear-btn" type="button" onClick={handleClearPlan}>
              Start a new plan
            </button>
          </section>
        </>
      )}

      {/* ── BUILD PLAN VIEW ────────────────────────────────────────────── */}
      {view === "build" && (
        <>
          <section className="hoppy-hero mobile-section-card">
            <button className="hoppy-back-link" type="button" onClick={() => setView("landing")}>
              ← Back
            </button>
            <h1 className="hoppy-hero-title">Build tonight's plan</h1>
            <p className="hoppy-hero-sub">Name it, pick your stops, share the link.</p>
          </section>

          <section className="mobile-section-card hoppy-build-section">
            <label className="hoppy-field-label">Plan name</label>
            <input
              className="hoppy-name-input"
              type="text"
              placeholder="SoHo Sesh, Friday Night Out…"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              maxLength={40}
            />
          </section>

          <section className="mobile-section-card hoppy-build-section">
            <label className="hoppy-field-label">Starting time</label>
            <div className="crawl-chip-row">
              {START_TIMES.map((t) => (
                <button
                  key={t}
                  className={`crawl-chip ${planStartTime === t ? "crawl-chip-active" : ""}`}
                  type="button"
                  onClick={() => setPlanStartTime(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>

          <section className="mobile-section-card hoppy-build-section">
            <label className="hoppy-field-label">Neighborhood</label>
            <div className="crawl-chip-row">
              {neighborhoods.map((n) => (
                <button
                  key={n}
                  className={`crawl-chip ${planNeighborhood === n ? "crawl-chip-active" : ""}`}
                  type="button"
                  onClick={() => { setPlanNeighborhood(n); setSelectedVenueIds([]); }}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>

          <section className="mobile-section-card hoppy-build-section">
            <div className="panel-heading">
              <div>
                <label className="hoppy-field-label">Pick your stops</label>
                <p className="hoppy-field-sub">Tap to add · {selectedVenueIds.length}/5 selected</p>
              </div>
            </div>
            <div className="hoppy-venue-picker">
              {pickableVenues.map(({ venue, topDeal, todayCount }) => {
                const isSelected = selectedVenueIds.includes(venue.id);
                return (
                  <button
                    key={venue.id}
                    className={`hoppy-pick-card ${isSelected ? "hoppy-pick-card-active" : ""}`}
                    type="button"
                    onClick={() => toggleVenueSelection(venue.id)}
                  >
                    <div className="hoppy-pick-card-head">
                      <div>
                        <p className="hoppy-pick-neighborhood">{venue.neighborhood}</p>
                        <p className="hoppy-pick-name">{venue.name}</p>
                      </div>
                      <div className={`hoppy-pick-check ${isSelected ? "hoppy-pick-check-active" : ""}`}>
                        {isSelected ? "✓" : "+"}
                      </div>
                    </div>
                    {topDeal && (
                      <p className="hoppy-pick-deal">
                        {topDeal.time} · {topDeal.description.slice(0, 55)}{topDeal.description.length > 55 ? "…" : ""}
                      </p>
                    )}
                    {todayCount > 0 && (
                      <span className="hoppy-pick-badge">{todayCount} deal{todayCount !== 1 ? "s" : ""} today</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mobile-section-card">
            <button
              className="crawl-generate-btn"
              type="button"
              disabled={selectedVenueIds.length < 2}
              onClick={handleCreatePlan}
            >
              {selectedVenueIds.length < 2
                ? `Pick at least 2 stops (${selectedVenueIds.length} selected)`
                : `Create plan with ${selectedVenueIds.length} stop${selectedVenueIds.length !== 1 ? "s" : ""} →`}
            </button>
          </section>
        </>
      )}

      {/* ── LANDING VIEW ────────────────────────────────────────────────── */}
      {view === "landing" && (
        <>
          <section className="hoppy-hero mobile-section-card">
            <div className="hoppy-hero-icon">🍻</div>
            <h1 className="hoppy-hero-title">Hoppy Hour</h1>
            <p className="hoppy-hero-sub">
              Plan tonight with friends. Pick bars, vote on the route, share the link — everyone's on the same page.
            </p>
            <button className="hoppy-cta-btn" type="button" onClick={() => setView("build")}>
              Build tonight's plan →
            </button>
          </section>

          {/* Trending venues */}
          <section className="mobile-section-card">
            <div className="panel-heading">
              <div>
                <p className="section-label">Right now</p>
                <h3 className="panel-title">What's trending tonight</h3>
              </div>
            </div>
            <div className="hoppy-vibe-grid">
              {trendingVenues.map(({ venue, vibe, topDeal, liveCount }) => (
                <article className="hoppy-vibe-card" key={venue.id}>
                  <div className="hoppy-vibe-card-head">
                    <div>
                      <p className="hoppy-vibe-neighborhood">{venue.neighborhood}</p>
                      <Link className="hoppy-vibe-name" to={`/venues/${venue.id}`}>
                        {venue.name}
                      </Link>
                    </div>
                    <span className={`hoppy-vibe-badge ${vibe.cls}`}>
                      {vibe.icon} {vibe.label}
                    </span>
                  </div>
                  {topDeal && (
                    <p className="hoppy-vibe-deal">
                      {topDeal.time} · {topDeal.description.slice(0, 60)}{topDeal.description.length > 60 ? "…" : ""}
                    </p>
                  )}
                  <div className="hoppy-vibe-footer">
                    {liveCount > 0 && (
                      <span className="hoppy-vibe-live">
                        <span className="hoppy-live-dot" />
                        {liveCount} live now
                      </span>
                    )}
                    <button
                      className="hoppy-add-to-plan-btn"
                      type="button"
                      onClick={() => {
                        setPlanNeighborhood("All Tampa");
                        setSelectedVenueIds([venue.id]);
                        setView("build");
                      }}
                    >
                      Add to plan
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Mock social proof — shows what the feature will look like with real data */}
          <section className="mobile-section-card hoppy-social-preview">
            <div className="panel-heading">
              <div>
                <p className="section-label">Friends' plans</p>
                <h3 className="panel-title">Who's going out tonight</h3>
              </div>
              <span className="hoppy-social-coming">Coming soon</span>
            </div>
            <div className="hoppy-friend-list">
              {[
                { name: "Alex + 2", plan: "SoHo Sesh", stops: 4, time: "9 PM", status: "going" },
                { name: "Jordan", plan: "Ybor Night", stops: 3, time: "10 PM", status: "maybe" },
                { name: "Taylor + 1", plan: "Channelside Crawl", stops: 5, time: "8 PM", status: "going" },
              ].map((friend) => (
                <div className="hoppy-friend-row" key={friend.name}>
                  <div className={`hoppy-avatar hoppy-avatar-${friend.status}`}>
                    {friend.name.charAt(0)}
                  </div>
                  <div className="hoppy-friend-info">
                    <p className="hoppy-friend-name">{friend.name}</p>
                    <p className="hoppy-friend-plan">{friend.plan} · {friend.stops} stops · {friend.time}</p>
                  </div>
                  <span className={`hoppy-friend-status hoppy-friend-${friend.status}`}>
                    {friend.status === "going" ? "🙌" : "🤔"}
                  </span>
                </div>
              ))}
            </div>
            <p className="hoppy-social-note">
              Sign in and connect friends to see their real plans here.
            </p>
          </section>

          {/* How it works */}
          <section className="mobile-section-card hoppy-how-section">
            <p className="section-label">How it works</p>
            <div className="hoppy-how-steps">
              <div className="hoppy-how-step">
                <span className="hoppy-how-num">1</span>
                <div>
                  <p className="hoppy-how-title">Build your plan</p>
                  <p className="hoppy-how-desc">Pick 2–5 bars, set a start time, name it.</p>
                </div>
              </div>
              <div className="hoppy-how-step">
                <span className="hoppy-how-num">2</span>
                <div>
                  <p className="hoppy-how-title">Share the link</p>
                  <p className="hoppy-how-desc">One tap sends a link — friends open it, RSVP, and vote.</p>
                </div>
              </div>
              <div className="hoppy-how-step">
                <span className="hoppy-how-num">3</span>
                <div>
                  <p className="hoppy-how-title">Vote on the route</p>
                  <p className="hoppy-how-desc">Upvote stops to move them to the top. Best bar wins.</p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

    </main>
  );
}
