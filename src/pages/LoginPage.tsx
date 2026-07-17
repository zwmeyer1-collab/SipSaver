import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSavedVenues } from "../hooks/useSavedVenues";
import { useRewards, computeStreak } from "../hooks/useRewards";
import { isAdmin } from "../lib/admin";
import logoMark from "../../logo.png";
import logoWords from "../../logowords.png";

type AuthTab = "signin" | "signup";

// ── Signed-in profile view ────────────────────────────────────────────────────

function ProfileView() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { savedVenueIds } = useSavedVenues();
  const { state: rewardsState, level, earnedBadges } = useRewards();
  const streak = computeStreak(rewardsState.checkIns);

  if (!user) return null;

  const initial = user.name?.charAt(0).toUpperCase() ?? "?";
  const pointsToNext = level.maxPoints === 99999 ? 0 : level.maxPoints - rewardsState.points;

  return (
    <main className="auth-page auth-page-profile">
      {/* Header strip */}
      <div className="auth-profile-header">
        <button className="auth-profile-back" type="button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <button className="auth-profile-signout" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      <div className="auth-profile-body">
        {/* Avatar */}
        <div className="auth-avatar-wrap">
          <div className="auth-avatar">{initial}</div>
          <h1 className="auth-profile-name">{user.name}</h1>
          <p className="auth-profile-email">{user.email}</p>
        </div>

        {/* Level card */}
        <div className="auth-level-card">
          <div className="auth-level-left">
            <span className="auth-level-icon">{level.icon}</span>
            <div>
              <p className="auth-level-tier">{level.name}</p>
              <p className="auth-level-pts">{rewardsState.points.toLocaleString()} pts</p>
            </div>
          </div>
          {level.maxPoints !== 99999 ? (
            <div className="auth-level-right">
              <p className="auth-level-next-label">{pointsToNext} pts to next level</p>
              <div className="auth-level-bar"><div className="auth-level-bar-fill" style={{ width: `${level.progress}%` }} /></div>
            </div>
          ) : (
            <p className="auth-level-max">🏆 Max level!</p>
          )}
        </div>

        {/* Stats row */}
        <div className="auth-stats-row">
          <div className="auth-stat-item">
            <strong>{rewardsState.checkIns.length}</strong>
            <span>check-ins</span>
          </div>
          <div className="auth-stat-divider" />
          <div className="auth-stat-item">
            <strong>{savedVenueIds.length}</strong>
            <span>saved</span>
          </div>
          <div className="auth-stat-divider" />
          <div className="auth-stat-item">
            <strong>{streak > 0 ? `${streak}🔥` : earnedBadges.length}</strong>
            <span>{streak > 0 ? "day streak" : "badges"}</span>
          </div>
        </div>

        {/* Badge strip */}
        {earnedBadges.length > 0 && (
          <div className="auth-badges-strip">
            {earnedBadges.slice(0, 5).map((b) => (
              <span className="auth-badge-chip" key={b.id} title={b.name}>{b.icon}</span>
            ))}
            {earnedBadges.length > 5 && (
              <span className="auth-badge-more">+{earnedBadges.length - 5}</span>
            )}
          </div>
        )}

        {/* Quick links */}
        <div className="auth-profile-links">
          <Link className="auth-profile-link" to="/rewards">
            <span className="auth-plink-icon">🏆</span>
            <span className="auth-plink-label">Rewards &amp; badges</span>
            <span className="auth-plink-arrow">›</span>
          </Link>
          <Link className="auth-profile-link" to="/saved">
            <span className="auth-plink-icon">♥</span>
            <span className="auth-plink-label">Saved venues</span>
            <span className="auth-plink-arrow">›</span>
          </Link>
          <Link className="auth-profile-link" to="/">
            <span className="auth-plink-icon">⌕</span>
            <span className="auth-plink-label">Browse deals</span>
            <span className="auth-plink-arrow">›</span>
          </Link>
          {isAdmin(user.email) && (
            <Link className="auth-profile-link auth-profile-link-admin" to="/admin">
              <span className="auth-plink-icon">⚙️</span>
              <span className="auth-plink-label">Admin console</span>
              <span className="auth-plink-arrow">›</span>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Verification sent screen ──────────────────────────────────────────────────

function VerifyScreen({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <main className="auth-page">
      <div className="auth-hero-section">
        <div className="auth-brand-lockup">
          <img alt="SipSaver" className="auth-logo-mark" src={logoMark} />
          <img alt="SipSaver" className="auth-logo-words" src={logoWords} />
        </div>
      </div>
      <div className="auth-sheet">
        <div className="auth-verify-wrap">
          <div className="auth-verify-icon">📬</div>
          <h2 className="auth-verify-title">Check your email</h2>
          <p className="auth-verify-sub">
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account, then come back and sign in.
          </p>
          <button className="auth-submit-btn" type="button" onClick={onBack}>
            Back to sign in
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Main auth form ────────────────────────────────────────────────────────────

export function LoginPage() {
  const navigate = useNavigate();
  const { user, signIn, signUp, isLoading } = useAuth();

  const [tab, setTab]                   = useState<AuthTab>("signin");
  const [name, setName]                 = useState("");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [confirmPw, setConfirmPw]       = useState("");
  const [showPw, setShowPw]             = useState(false);
  const [error, setError]               = useState("");
  const [verified, setVerified]         = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <ProfileView />;
  if (verified) return (
    <VerifyScreen
      email={email}
      onBack={() => { setVerified(false); setTab("signin"); setError(""); }}
    />
  );

  function switchTab(next: AuthTab) {
    setTab(next);
    setError("");
    setPassword("");
    setConfirmPw("");
    setShowPw(false);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      await signIn({ email: email.trim(), password });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect email or password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || isSubmitting) return;
    if (password !== confirmPw) { setError("Passwords don't match."); return; }
    if (password.length < 6)   { setError("Password must be at least 6 characters."); return; }
    setIsSubmitting(true);
    setError("");
    try {
      const result = await signUp({ name: name.trim(), email: email.trim(), password });
      if (result.needsVerification) {
        setVerified(true);
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">

      {/* ── Dark hero ── */}
      <div className="auth-hero-section">
        <Link className="auth-back-link" to="/">← Browse deals</Link>

        <div className="auth-brand-lockup">
          <img alt="SipSaver logo" className="auth-logo-mark" src={logoMark} />
          <img alt="SipSaver" className="auth-logo-words" src={logoWords} />
          <p className="auth-hero-tagline">Tampa&apos;s happy hour guide</p>
        </div>

        <div className="auth-value-props">
          <span className="auth-vp">♥ Save spots</span>
          <span className="auth-vp-dot">·</span>
          <span className="auth-vp">📍 Check in</span>
          <span className="auth-vp-dot">·</span>
          <span className="auth-vp">🏆 Earn rewards</span>
        </div>
      </div>

      {/* ── Bottom sheet ── */}
      <div className="auth-sheet">

        {/* Tab switcher */}
        <div className="auth-tab-row">
          <button
            className={`auth-tab-btn ${tab === "signin" ? "auth-tab-btn-active" : ""}`}
            type="button"
            onClick={() => switchTab("signin")}
          >
            Sign in
          </button>
          <button
            className={`auth-tab-btn ${tab === "signup" ? "auth-tab-btn-active" : ""}`}
            type="button"
            onClick={() => switchTab("signup")}
          >
            Create account
          </button>
        </div>

        {tab === "signin" ? (
          <form className="auth-form-body" onSubmit={handleSignIn}>
            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="signin-email">Email</label>
              <input
                className="auth-field-input"
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isLoading || isSubmitting}
              />
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="signin-pw">Password</label>
              <div className="auth-pw-wrap">
                <input
                  className="auth-field-input auth-field-input-pw"
                  id="signin-pw"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading || isSubmitting}
                />
                <button
                  className="auth-pw-toggle"
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button
              className="auth-submit-btn"
              type="submit"
              disabled={isLoading || isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>

            <p className="auth-switch-hint">
              No account?{" "}
              <button className="auth-switch-link" type="button" onClick={() => switchTab("signup")}>
                Create one
              </button>
            </p>
          </form>
        ) : (
          <form className="auth-form-body" onSubmit={handleSignUp}>
            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="signup-name">First name</label>
              <input
                className="auth-field-input"
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                disabled={isLoading || isSubmitting}
              />
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="signup-email">Email</label>
              <input
                className="auth-field-input"
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isLoading || isSubmitting}
              />
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="signup-pw">Password</label>
              <div className="auth-pw-wrap">
                <input
                  className="auth-field-input auth-field-input-pw"
                  id="signup-pw"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  disabled={isLoading || isSubmitting}
                />
                <button
                  className="auth-pw-toggle"
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="signup-confirm">Confirm password</label>
              <input
                className="auth-field-input"
                id="signup-confirm"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isLoading || isSubmitting}
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button
              className="auth-submit-btn"
              type="submit"
              disabled={isLoading || isSubmitting}
            >
              {isSubmitting ? "Creating account…" : "Create account"}
            </button>

            <p className="auth-switch-hint">
              Already have an account?{" "}
              <button className="auth-switch-link" type="button" onClick={() => switchTab("signin")}>
                Sign in
              </button>
            </p>

            <p className="auth-terms">
              By creating an account you agree to SipSaver&apos;s terms of use.
              We&apos;ll send a quick verification email.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
