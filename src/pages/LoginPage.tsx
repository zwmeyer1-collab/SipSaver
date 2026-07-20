import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logoMark from "../../logo.png";
import logoWords from "../../logowords.png";

type AuthTab = "signin" | "signup";

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

// ── Forgot password screen ────────────────────────────────────────────────────

type ForgotScreenProps = {
  sent: boolean;
  email: string;
  setEmail: (v: string) => void;
  onBack: () => void;
  onSend: () => void;
  isSubmitting: boolean;
  error: string;
};

function ForgotScreen({ sent, email, setEmail, onBack, onSend, isSubmitting, error }: ForgotScreenProps) {
  return (
    <main className="auth-page">
      <div className="auth-hero-section">
        <div className="auth-brand-lockup">
          <img alt="SipSaver" className="auth-logo-mark" src={logoMark} />
          <img alt="SipSaver" className="auth-logo-words" src={logoWords} />
        </div>
      </div>
      <div className="auth-sheet">
        {sent ? (
          <div className="auth-verify-wrap">
            <div className="auth-verify-icon">📬</div>
            <h2 className="auth-verify-title">Check your email</h2>
            <p className="auth-verify-sub">
              We sent a password reset link to <strong>{email}</strong>.
              Click it to choose a new password.
            </p>
            <button className="auth-submit-btn" type="button" onClick={onBack}>
              Back to sign in
            </button>
          </div>
        ) : (
          <div className="auth-form-body">
            <h2 className="auth-verify-title" style={{ marginBottom: 4 }}>Reset password</h2>
            <p className="auth-verify-sub" style={{ marginBottom: 20 }}>
              Enter your email and we&apos;ll send a reset link.
            </p>
            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="forgot-email">Email</label>
              <input
                className="auth-field-input"
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-submit-btn" type="button" disabled={isSubmitting} onClick={onSend}>
              {isSubmitting ? "Sending…" : "Send reset link"}
            </button>
            <p className="auth-switch-hint">
              <button className="auth-switch-link" type="button" onClick={onBack}>
                ← Back to sign in
              </button>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

// ── Main auth form ────────────────────────────────────────────────────────────

export function LoginPage() {
  const navigate = useNavigate();
  const { user, signIn, signUp, resetPassword, isLoading } = useAuth();

  const [tab, setTab]                   = useState<AuthTab>("signin");
  const [name, setName]                 = useState("");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [confirmPw, setConfirmPw]       = useState("");
  const [showPw, setShowPw]             = useState(false);
  const [error, setError]               = useState("");
  const [verified, setVerified]         = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgot, setShowForgot]     = useState(false);
  const [resetSent, setResetSent]       = useState(false);
  const [resetEmail, setResetEmail]     = useState("");

  if (user) return <Navigate to="/profile" replace />;
  if (verified) return (
    <VerifyScreen
      email={email}
      onBack={() => { setVerified(false); setTab("signin"); setError(""); }}
    />
  );

  if (showForgot) return (
    <ForgotScreen
      sent={resetSent}
      email={resetEmail}
      setEmail={setResetEmail}
      onBack={() => { setShowForgot(false); setResetSent(false); setResetEmail(""); setError(""); }}
      onSend={async () => {
        if (!resetEmail.trim() || isSubmitting) return;
        setIsSubmitting(true);
        setError("");
        try {
          await resetPassword(resetEmail.trim());
          setResetSent(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not send reset email.");
        } finally {
          setIsSubmitting(false);
        }
      }}
      isSubmitting={isSubmitting}
      error={error}
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

            <button
              className="auth-forgot-link"
              type="button"
              onClick={() => { setShowForgot(true); setResetEmail(email); setError(""); }}
            >
              Forgot password?
            </button>

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
