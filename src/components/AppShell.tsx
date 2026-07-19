import { useState, useEffect, useRef } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRewards, computeStreak } from "../hooks/useRewards";
import { useSupabaseData } from "../hooks/useSupabaseData";
import { getDisplayDeals } from "../lib/tampaSelectors";
import { OnboardingFlow, hasCompletedOnboarding } from "./OnboardingFlow";
import logoMark from "../../logo.png";
import logoWords from "../../logowords.png";

function getNavLinkClassName(isActive: boolean) {
  return `topbar-link ${isActive ? "topbar-link-active" : ""}`;
}

export function AppShell() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const shownRef = useRef(false);

  // Fire once when user first becomes available and hasn't onboarded
  useEffect(() => {
    if (user && !shownRef.current && !hasCompletedOnboarding()) {
      shownRef.current = true;
      setShowOnboarding(true);
    }
  }, [user]);
  const { state: rewardsState } = useRewards();
  const streak = computeStreak(rewardsState.checkIns);
  useSupabaseData(); // fetches from DB, re-renders tree when live data arrives
  const liveDealsCount = getDisplayDeals().filter(d => d.countdownLabel.includes("left")).length;

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div className="app-shell">
      <div className="app-backdrop" />
      <div className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <img alt="SipSaver logo" className="mobile-brand-logo" src={logoMark} />
          <img alt="SipSaver" className="mobile-brand-wordmark" src={logoWords} />
        </div>
        <div className="mobile-location-pill">
          <span className="mobile-location-pin">📍</span>
          <span className="mobile-location-name">Tampa, FL</span>
        </div>
      </div>

      <header className="app-topbar">
        <div className="brand-lockup">
          <div className="brand-wordmark-lockup">
            <p className="brand-kicker">Tampa Beta</p>
            <div className="brand-wordmark-frame">
              <img alt="SipSaver wordmark" className="brand-wordmark-image" src={logoWords} />
            </div>
          </div>
        </div>

        <div className="topbar-nav">
          <NavLink className={({ isActive }) => getNavLinkClassName(isActive)} to="/">
            Discover
          </NavLink>
          <NavLink className={({ isActive }) => getNavLinkClassName(isActive)} to="/venues">
            Venues
          </NavLink>
          <NavLink className={({ isActive }) => getNavLinkClassName(isActive)} to="/operators">
            Operators
          </NavLink>
        </div>

        <div className="topbar-actions">
          {user ? (
            <>
              <NavLink className="user-chip" to="/profile">
                <span className="user-chip-label">Signed in as</span>
                <strong>{user.name}</strong>
              </NavLink>
              <button className="ghost-button" type="button" onClick={() => void handleSignOut()}>
                Sign out
              </button>
            </>
          ) : (
            <NavLink className="ghost-button topbar-button-link" to="/login">
              Sign in
            </NavLink>
          )}
          <button className="primary-button" type="button" onClick={() => navigate("/operators")}>
            Claim your bar
          </button>
        </div>
      </header>

      {showOnboarding && user && (
        <OnboardingFlow onDone={() => setShowOnboarding(false)} />
      )}

      <Outlet />

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <NavLink className={({ isActive }) => `mobile-bottom-link ${isActive ? "mobile-bottom-link-active" : ""}`} to="/" end>
          <span className="mobile-bottom-icon-wrap">
            <span className="mobile-bottom-icon">⌕</span>
            {liveDealsCount > 0 && <span className="nav-live-dot" />}
          </span>
          <span>Discover</span>
        </NavLink>
        <NavLink className={({ isActive }) => `mobile-bottom-link ${isActive ? "mobile-bottom-link-active" : ""}`} to="/venues">
          <span className="mobile-bottom-icon">⌖</span>
          <span>Map</span>
        </NavLink>
        <NavLink className={({ isActive }) => `mobile-bottom-link mobile-bottom-link-crawl ${isActive ? "mobile-bottom-link-active" : ""}`} to="/crawl">
          <span className="mobile-bottom-crawl-badge">🍺</span>
          <span>Crawl</span>
        </NavLink>
        <NavLink className={({ isActive }) => `mobile-bottom-link ${isActive ? "mobile-bottom-link-active" : ""}`} to="/hoppy">
          <span className="mobile-bottom-icon">🍻</span>
          <span>Hoppy</span>
        </NavLink>
        <NavLink className={({ isActive }) => `mobile-bottom-link ${isActive ? "mobile-bottom-link-active" : ""}`} to="/profile">
          <span className="mobile-bottom-icon-wrap">
            <span className="mobile-bottom-icon">👤</span>
            {streak > 0 && <span className="nav-streak-badge">{streak}🔥</span>}
          </span>
          <span>{user?.name?.split(" ")[0] ?? "Profile"}</span>
        </NavLink>
      </nav>
    </div>
  );
}
