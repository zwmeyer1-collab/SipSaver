import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import logoMark from "../../logo.png";
import logoWords from "../../logowords.png";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [ready, setReady]           = useState(false);
  const [password, setPassword]     = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [done, setDone]             = useState(false);

  // Supabase fires PASSWORD_RECOVERY when the magic link is opened
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Also check if there's already an active recovery session
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPw) { setError("Passwords don't match."); return; }
    if (password.length < 6)   { setError("Must be at least 6 characters."); return; }
    setSaving(true);
    setError("");
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-hero-section">
        <div className="auth-brand-lockup">
          <img alt="SipSaver" className="auth-logo-mark" src={logoMark} />
          <img alt="SipSaver" className="auth-logo-words" src={logoWords} />
        </div>
      </div>

      <div className="auth-sheet">
        {done ? (
          <div className="auth-verify-wrap">
            <div className="auth-verify-icon">✅</div>
            <h2 className="auth-verify-title">Password updated</h2>
            <p className="auth-verify-sub">Taking you back to the app…</p>
          </div>
        ) : !ready ? (
          <div className="auth-verify-wrap">
            <div className="auth-verify-icon">🔑</div>
            <h2 className="auth-verify-title">Verifying link…</h2>
            <p className="auth-verify-sub">Hang on while we confirm your reset link.</p>
          </div>
        ) : (
          <form className="auth-form-body" onSubmit={handleSave}>
            <h2 className="auth-verify-title" style={{ marginBottom: 4 }}>New password</h2>
            <p className="auth-verify-sub" style={{ marginBottom: 20 }}>Choose a new password for your account.</p>

            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="rp-pw">New password</label>
              <div className="auth-pw-wrap">
                <input
                  className="auth-field-input auth-field-input-pw"
                  id="rp-pw"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  disabled={saving}
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
              <label className="auth-field-label" htmlFor="rp-confirm">Confirm password</label>
              <input
                className="auth-field-input"
                id="rp-confirm"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={saving}
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button className="auth-submit-btn" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
