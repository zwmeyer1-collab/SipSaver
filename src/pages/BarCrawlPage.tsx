import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDisplayDeals } from "../lib/tampaSelectors";
import { generateCrawl } from "../lib/barCrawl";
import type { BarCrawl } from "../lib/barCrawl";
import { savePlan, generatePlanId } from "../lib/nightPlan";
import type { NightPlan } from "../lib/nightPlan";

const NEIGHBORHOODS = [
  "All Tampa",
  "SoHo",
  "Downtown Tampa",
  "Ybor",
  "Channelside",
  "Seminole Heights",
  "Tampa Heights",
  "Hyde Park",
  "Westshore",
];
const STOP_OPTIONS = [3, 4, 5];

function formatDistance(km: number): string {
  const mi = km * 0.621371;
  if (mi < 0.1) return "< 0.1 mi";
  return `${Math.round(mi * 10) / 10} mi`;
}

function estimateCost(crawl: BarCrawl): string {
  const prices: number[] = [];
  for (const stop of crawl.stops) {
    const matches = [...stop.deal.description.matchAll(/\$(\d+(?:\.\d{1,2})?)/g)];
    const nums = matches.map((m) => parseFloat(m[1]));
    if (nums.length > 0) prices.push(Math.min(...nums));
  }
  if (prices.length === 0) return "";
  const total = prices.reduce((a, b) => a + b, 0);
  const lo = total.toFixed(0);
  const hi = (total * 1.5).toFixed(0);
  return `~$${lo}–$${hi}`;
}

function crawlToPlan(crawl: BarCrawl): NightPlan {
  return {
    id: generatePlanId(),
    name: `${crawl.neighborhood} Crawl`,
    startTime: crawl.stops[0]?.deal.time ?? "Tonight",
    neighborhood: crawl.neighborhood,
    stops: crawl.stops.map((s) => ({
      venueId: s.venue.id,
      venueName: s.venue.name,
      neighborhood: s.venue.neighborhood,
      dealDesc: s.deal.description,
      dealTime: s.deal.time,
      votes: 0,
    })),
    rsvps: [],
    createdAt: new Date().toISOString(),
  };
}

function shareOrCopy(crawl: BarCrawl) {
  const lines = crawl.stops.map((stop, i) => {
    const walk = stop.walkMinutesFromPrev ? ` (${stop.walkMinutesFromPrev} min walk)` : "";
    return `Stop ${i + 1}: ${stop.venue.name} — ${stop.deal.time}${walk}`;
  });
  const text = `🍺 SipSaver Bar Crawl — ${crawl.neighborhood}\n\n${lines.join("\n")}\n\nFind deals: sipsaver.app`;

  if (navigator.share) {
    void navigator.share({ title: "SipSaver Bar Crawl", text });
  } else {
    void navigator.clipboard.writeText(text).then(() => {
      alert("Crawl copied to clipboard!");
    });
  }
}

export function BarCrawlPage() {
  const navigate = useNavigate();
  const [neighborhood, setNeighborhood] = useState("SoHo");
  const [stopCount, setStopCount] = useState(3);
  const [crawl, setCrawl] = useState<BarCrawl | null>(null);
  const [generated, setGenerated] = useState(false);
  const [savedAsPlan, setSavedAsplan] = useState(false);

  function handleSaveAsPlan() {
    if (!crawl) return;
    savePlan(crawlToPlan(crawl));
    setSavedAsplan(true);
    setTimeout(() => navigate("/hoppy"), 800);
  }

  function handleGenerate() {
    const deals = getDisplayDeals();
    let result = generateCrawl(deals, neighborhood, stopCount);
    // If not enough stops in chosen neighborhood, fall back to All Tampa
    if (result.stops.length < 2 && neighborhood !== "All Tampa") {
      result = generateCrawl(deals, "All Tampa", stopCount);
      result = { ...result, neighborhood: `All Tampa (not enough data for ${neighborhood} yet)` };
    }
    setCrawl(result);
    setGenerated(true);
  }

  return (
    <main className="dashboard page-shell bar-crawl-page">
      <section className="crawl-hero mobile-section-card">
        <div className="crawl-hero-icon">🍺</div>
        <h1 className="crawl-hero-title">Bar Crawl Mode</h1>
        <p className="crawl-hero-sub">
          Pick a neighborhood, pick your stops. We build the route — ordered by deal timing and walking distance.
        </p>
      </section>

      <section className="crawl-builder mobile-section-card">
        <div className="crawl-builder-group">
          <p className="crawl-label">Neighborhood</p>
          <div className="crawl-chip-row">
            {NEIGHBORHOODS.map((n) => (
              <button
                key={n}
                className={`crawl-chip ${neighborhood === n ? "crawl-chip-active" : ""}`}
                type="button"
                onClick={() => {
                  setNeighborhood(n);
                  setGenerated(false);
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="crawl-builder-group">
          <p className="crawl-label">Stops</p>
          <div className="crawl-chip-row">
            {STOP_OPTIONS.map((n) => (
              <button
                key={n}
                className={`crawl-chip crawl-chip-stop ${stopCount === n ? "crawl-chip-active" : ""}`}
                type="button"
                onClick={() => {
                  setStopCount(n);
                  setGenerated(false);
                }}
              >
                {n} bars
              </button>
            ))}
          </div>
        </div>

        <button className="crawl-generate-btn" type="button" onClick={handleGenerate}>
          {generated ? "Regenerate crawl" : "Generate crawl"}
        </button>
      </section>

      {generated && crawl && (
        <>
          {crawl.stops.length === 0 ? (
            <section className="crawl-empty mobile-section-card">
              <p>Not enough deal data for {neighborhood} yet. Try "All Tampa" or a different neighborhood.</p>
            </section>
          ) : (
            <>
              <section className="crawl-summary mobile-section-card">
                <div className="crawl-summary-stats">
                  <div className="crawl-stat">
                    <strong>{crawl.stops.length}</strong>
                    <span>stops</span>
                  </div>
                  <div className="crawl-stat">
                    <strong>{crawl.totalWalkMinutes}m</strong>
                    <span>walk time</span>
                  </div>
                  {estimateCost(crawl) && (
                    <div className="crawl-stat">
                      <strong>{estimateCost(crawl)}</strong>
                      <span>est. per person</span>
                    </div>
                  )}
                </div>
                <p className="crawl-zone-label">{crawl.neighborhood}</p>
              </section>

              <section className="crawl-route mobile-section-card">
                {crawl.stops.map((stop, i) => (
                  <div key={stop.venue.id} className="crawl-stop-group">
                    {stop.walkMinutesFromPrev !== null && (
                      <div className="crawl-walk-connector">
                        <div className="crawl-walk-line" />
                        <span className="crawl-walk-label">
                          {stop.walkMinutesFromPrev} min walk
                          {stop.distanceKmFromPrev !== null
                            ? ` · ${formatDistance(stop.distanceKmFromPrev)}`
                            : ""}
                        </span>
                        <div className="crawl-walk-line" />
                      </div>
                    )}
                    <article className="crawl-stop-card">
                      <div className="crawl-stop-number">
                        <span>{i + 1}</span>
                      </div>
                      <div className="crawl-stop-body">
                        <div className="crawl-stop-head">
                          <div>
                            <p className="crawl-stop-neighborhood">{stop.venue.neighborhood}</p>
                            <Link className="crawl-stop-name" to={`/venues/${stop.venue.id}`}>
                              {stop.venue.name}
                            </Link>
                          </div>
                          <span className="crawl-stop-countdown">{stop.deal.countdownLabel}</span>
                        </div>
                        <p className="crawl-stop-time">
                          {stop.deal.category} · {stop.deal.day} · {stop.deal.time}
                        </p>
                        <p className="crawl-stop-deal">{stop.deal.description}</p>
                        <div className="crawl-stop-footer">
                          <div className="crawl-chip-row tight">
                            {stop.deal.priceLabel && (
                              <span className="micro-chip">{stop.deal.priceLabel}</span>
                            )}
                            <span className="micro-chip">{stop.deal.category}</span>
                          </div>
                          <Link className="inline-panel-link" to={`/venues/${stop.venue.id}`}>
                            Details
                          </Link>
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </section>

              <section className="crawl-actions mobile-section-card">
                <button
                  className="crawl-save-plan-btn"
                  type="button"
                  onClick={handleSaveAsPlan}
                  disabled={savedAsPlan}
                >
                  {savedAsPlan ? "✓ Saved — opening Hoppy…" : "🍻 Save as Hoppy Hour plan"}
                </button>
                <button
                  className="crawl-share-btn"
                  type="button"
                  onClick={() => shareOrCopy(crawl)}
                >
                  Share this crawl
                </button>
                <button
                  className="crawl-regenerate-link"
                  type="button"
                  onClick={handleGenerate}
                >
                  Try a different route
                </button>
              </section>
            </>
          )}
        </>
      )}

      {!generated && (
        <section className="crawl-placeholder mobile-section-card">
          <div className="crawl-placeholder-content">
            <p className="crawl-placeholder-icon">🗺</p>
            <p className="crawl-placeholder-text">
              Your route will appear here — stop order, walking time, and live deal windows.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
