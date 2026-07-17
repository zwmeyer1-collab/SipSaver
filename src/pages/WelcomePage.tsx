import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDisplayDeals, getMapVenues } from "../lib/tampaSelectors";
import { usePWAInstall } from "../hooks/usePWAInstall";
import logoMark from "../../logo.png";
import logoWords from "../../logowords.png";

const VISITED_KEY = "sipsaver_visited";

export function WelcomePage() {
  const navigate = useNavigate();
  const { canInstall, installed, triggerInstall } = usePWAInstall();

  // Returning users skip straight to the app
  useEffect(() => {
    if (localStorage.getItem(VISITED_KEY)) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  function handleGetStarted() {
    localStorage.setItem(VISITED_KEY, "1");
    navigate("/");
  }

  // Pull a few live stats to show the app is real
  const allDeals  = getDisplayDeals();
  const allVenues = getMapVenues();
  const liveCount = allDeals.filter((d) => d.countdownLabel.includes("left")).length;
  const soonCount = allDeals.filter((d) => d.countdownLabel.startsWith("Starts in")).length;

  // Pick 3 sample deals to preview — prefer live ones
  const previewDeals = [
    ...allDeals.filter((d) => d.countdownLabel.includes("left")),
    ...allDeals.filter((d) => d.countdownLabel.startsWith("Starts in")),
    ...allDeals,
  ]
    .filter((d, i, arr) => arr.findIndex((x) => x.venueId === d.venueId) === i)
    .slice(0, 3);

  const neighborhoodCount = new Set(allVenues.map((v) => v.neighborhood)).size;

  return (
    <main className="welcome-page">

      {/* ── Top bar ── */}
      <div className="welcome-topbar">
        <Link className="welcome-signin-link" to="/login">Sign in</Link>
      </div>

      {/* ── Hero ── */}
      <section className="welcome-hero">
        <div className="welcome-hero-brand">
          <img alt="SipSaver" className="welcome-hero-logo-mark" src={logoMark} />
          <div className="welcome-hero-brand-text">
            <img alt="SipSaver" className="welcome-hero-logo-words" src={logoWords} />
            <p className="welcome-hero-tagline">Tampa&apos;s happy hour guide</p>
          </div>
        </div>

        <div className="welcome-hero-badge">
          {liveCount > 0 ? (
            <>
              <span className="welcome-live-dot" />
              {liveCount} deal{liveCount !== 1 ? "s" : ""} live right now
            </>
          ) : (
            <>🍺 Tampa&apos;s happy hour guide</>
          )}
        </div>

        <h1 className="welcome-headline">
          Find the best<br />
          happy hours<br />
          in <span>Tampa</span>
        </h1>

        <p className="welcome-sub">
          Live deals, real countdowns, and bar crawl planning
          across {neighborhoodCount} Tampa neighborhoods.
        </p>

        <div className="welcome-stats-row">
          <div className="welcome-stat">
            <strong>{allVenues.length}</strong>
            <span>venues mapped</span>
          </div>
          <div className="welcome-stat-line" />
          <div className="welcome-stat">
            <strong>{allDeals.length}</strong>
            <span>tracked deals</span>
          </div>
          <div className="welcome-stat-line" />
          <div className="welcome-stat">
            <strong>{liveCount + soonCount > 0 ? liveCount + soonCount : neighborhoodCount}</strong>
            <span>{liveCount + soonCount > 0 ? "active now" : "neighborhoods"}</span>
          </div>
        </div>
      </section>

      {/* ── Deal preview cards ── */}
      {previewDeals.length > 0 && (
        <section className="welcome-preview-section">
          <p className="welcome-section-label">What&apos;s on tonight</p>
          <div className="welcome-deal-rail">
            {previewDeals.map((deal) => {
              const isLive = deal.countdownLabel.includes("left");
              const isSoon = deal.countdownLabel.startsWith("Starts in");
              return (
                <div className="welcome-deal-card" key={deal.id}>
                  <div className="welcome-deal-card-top">
                    <span className="welcome-deal-neighborhood">{deal.venue.neighborhood}</span>
                    <span className={`welcome-deal-badge ${isLive ? "wdb-live" : isSoon ? "wdb-soon" : "wdb-gray"}`}>
                      {deal.countdownLabel}
                    </span>
                  </div>
                  <p className="welcome-deal-venue">{deal.venue.name}</p>
                  <p className="welcome-deal-desc">
                    {deal.description.slice(0, 60)}{deal.description.length > 60 ? "…" : ""}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="welcome-preview-note">Sign up to see all deals, save venues &amp; check in</p>
        </section>
      )}

      {/* ── Features ── */}
      <section className="welcome-features">
        <div className="welcome-feature">
          <span className="welcome-feature-icon">⏱</span>
          <div>
            <p className="welcome-feature-title">Live countdowns</p>
            <p className="welcome-feature-sub">See exactly how long each deal has left — updated every minute.</p>
          </div>
        </div>
        <div className="welcome-feature">
          <span className="welcome-feature-icon">🗺</span>
          <div>
            <p className="welcome-feature-title">Interactive map</p>
            <p className="welcome-feature-sub">Color-coded pins show which venues are active right now.</p>
          </div>
        </div>
        <div className="welcome-feature">
          <span className="welcome-feature-icon">🍻</span>
          <div>
            <p className="welcome-feature-title">Bar crawl planner</p>
            <p className="welcome-feature-sub">Build a route across Tampa&apos;s best spots for the night.</p>
          </div>
        </div>
        <div className="welcome-feature">
          <span className="welcome-feature-icon">🏆</span>
          <div>
            <p className="welcome-feature-title">Rewards &amp; check-ins</p>
            <p className="welcome-feature-sub">Earn points every time you visit a venue. Unlock badges.</p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="welcome-cta-section">
        <button className="welcome-cta-btn" type="button" onClick={handleGetStarted}>
          Explore Tampa deals →
        </button>
        <p className="welcome-cta-sub">
          Already have an account?{" "}
          <Link
            className="welcome-cta-signin"
            to="/login"
            onClick={() => localStorage.setItem(VISITED_KEY, "1")}
          >
            Sign in
          </Link>
        </p>
        {canInstall && !installed && (
          <button className="welcome-install-btn" type="button" onClick={() => void triggerInstall()}>
            📲 Add to Home Screen
          </button>
        )}
        <p className="welcome-cta-note">Free to use · No app download needed</p>
      </div>

      {/* ── Origin story ── */}
      <div className="welcome-origin">
        <div className="welcome-origin-inner">
          <span className="welcome-origin-flag">📍 Made in Tampa, FL</span>
          <p className="welcome-origin-copy">
            SipSaver was built by Tampa locals tired of missing happy hour by five minutes.
            We track every deal, every day — so you never pay full price again.
          </p>
          <div className="welcome-origin-chips">
            <span className="welcome-origin-chip">🍺 {allVenues.length}+ venues</span>
            <span className="welcome-origin-chip">⏱ Live countdowns</span>
            <span className="welcome-origin-chip">🗺 All of Tampa</span>
          </div>
        </div>
      </div>

    </main>
  );
}
