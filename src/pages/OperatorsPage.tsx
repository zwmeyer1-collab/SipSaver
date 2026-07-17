import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

type FormState = {
  ownerName:    string;
  barName:      string;
  email:        string;
  phone:        string;
  neighborhood: string;
  website:      string;
  message:      string;
};

const NEIGHBORHOODS = [
  "SoHo", "Downtown Tampa", "Ybor City", "Channelside",
  "Seminole Heights", "Tampa Heights", "Hyde Park", "Westshore", "Other",
];

// ── Benefits data ─────────────────────────────────────────────────────────────

const BENEFITS = [
  { icon: "📍", title: "Get on the map",       sub: "Your venue pinned in front of Tampa's most active bar-goers." },
  { icon: "⏱", title: "Live deal countdowns", sub: "Show exactly when your happy hour starts and ends — drives urgency." },
  { icon: "📊", title: "Real check-in data",  sub: "See who's visiting, when, and which deals are driving traffic." },
  { icon: "🏆", title: "Loyalty built in",    sub: "Customers earn points for visiting you. They keep coming back." },
  { icon: "🆓", title: "Free to list",         sub: "No cost to claim your venue. We grow together." },
];

// ── Claim form ────────────────────────────────────────────────────────────────

function ClaimForm() {
  const [form, setForm] = useState<FormState>({
    ownerName: "", barName: "", email: "", phone: "",
    neighborhood: "", website: "", message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState("");

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.barName.trim() || !form.email.trim() || !form.ownerName.trim()) {
      setError("Please fill in your name, bar name, and email.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("venue_claims").insert({
          owner_name:   form.ownerName,
          bar_name:     form.barName,
          email:        form.email,
          phone:        form.phone || null,
          neighborhood: form.neighborhood || null,
          website:      form.website || null,
          message:      form.message || null,
        });
        if (error) throw error;
        setSubmitted(true);
      } else {
        // Fallback: open pre-filled email
        const body = `Bar: ${form.barName}\nOwner: ${form.ownerName}\nEmail: ${form.email}\nPhone: ${form.phone}\nNeighborhood: ${form.neighborhood}\nWebsite: ${form.website}\n\n${form.message}`;
        window.location.href = `mailto:hello@sipsavertampa.com?subject=Venue claim: ${encodeURIComponent(form.barName)}&body=${encodeURIComponent(body)}`;
        setSubmitted(true);
      }
    } catch {
      setError("Something went wrong. Please try again or email hello@sipsavertampa.com");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="ops-success">
        <div className="ops-success-icon">🎉</div>
        <h3 className="ops-success-title">You're on the list!</h3>
        <p className="ops-success-sub">
          We'll reach out to <strong>{form.email}</strong> within 24 hours to get <strong>{form.barName}</strong> set up.
        </p>
        <p className="ops-success-note">In the meantime, browse deals to see what your customers are already seeing.</p>
      </div>
    );
  }

  return (
    <form className="ops-form" onSubmit={handleSubmit}>
      <div className="ops-field-row">
        <div className="ops-field">
          <label className="ops-label" htmlFor="ops-owner">Your name *</label>
          <input className="ops-input" id="ops-owner" type="text" placeholder="Jane Smith"
            value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
        </div>
        <div className="ops-field">
          <label className="ops-label" htmlFor="ops-bar">Bar / venue name *</label>
          <input className="ops-input" id="ops-bar" type="text" placeholder="The Rusty Anchor"
            value={form.barName} onChange={(e) => set("barName", e.target.value)} />
        </div>
      </div>

      <div className="ops-field-row">
        <div className="ops-field">
          <label className="ops-label" htmlFor="ops-email">Email *</label>
          <input className="ops-input" id="ops-email" type="email" placeholder="you@yourbar.com"
            value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="ops-field">
          <label className="ops-label" htmlFor="ops-phone">Phone</label>
          <input className="ops-input" id="ops-phone" type="tel" placeholder="(813) 555-0100"
            value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </div>

      <div className="ops-field-row">
        <div className="ops-field">
          <label className="ops-label" htmlFor="ops-neighborhood">Neighborhood</label>
          <select className="ops-input ops-select" id="ops-neighborhood"
            value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)}>
            <option value="">Select…</option>
            {NEIGHBORHOODS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="ops-field">
          <label className="ops-label" htmlFor="ops-website">Website</label>
          <input className="ops-input" id="ops-website" type="url" placeholder="https://yourbar.com"
            value={form.website} onChange={(e) => set("website", e.target.value)} />
        </div>
      </div>

      <div className="ops-field">
        <label className="ops-label" htmlFor="ops-message">Anything else?</label>
        <textarea className="ops-input ops-textarea" id="ops-message" rows={3}
          placeholder="Tell us about your happy hour deals, hours, or anything we should know…"
          value={form.message} onChange={(e) => set("message", e.target.value)} />
      </div>

      {error && <p className="ops-error">{error}</p>}

      <button className="ops-submit-btn" type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Claim my venue →"}
      </button>
      <p className="ops-form-note">We reply within 24 hours, no spam, cancel any time.</p>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function OperatorsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"owners" | "admin">("owners");

  return (
    <main className="ops-page">

      {/* Hero */}
      <section className="ops-hero">
        <p className="ops-hero-kicker">For bar &amp; restaurant owners</p>
        <h1 className="ops-hero-headline">
          Put your happy hour<br />
          in front of Tampa
        </h1>
        <p className="ops-hero-sub">
          SipSaver is how Tampa finds where to drink tonight.
          List your venue for free and start showing up.
        </p>
        <div className="ops-hero-stats">
          <div className="ops-stat"><strong>183+</strong><span>venues</span></div>
          <div className="ops-stat-line" />
          <div className="ops-stat"><strong>134</strong><span>tracked deals</span></div>
          <div className="ops-stat-line" />
          <div className="ops-stat"><strong>8</strong><span>neighborhoods</span></div>
        </div>
      </section>

      {/* Admin tab toggle — only visible to signed-in users */}
      {user && (
        <div className="ops-tab-row">
          <button
            className={`ops-tab ${tab === "owners" ? "ops-tab-active" : ""}`}
            type="button" onClick={() => setTab("owners")}
          >For bar owners</button>
          <button
            className={`ops-tab ${tab === "admin" ? "ops-tab-active" : ""}`}
            type="button" onClick={() => setTab("admin")}
          >Admin console</button>
        </div>
      )}

      {tab === "owners" ? (
        <>
          {/* Benefits */}
          <section className="ops-benefits">
            {BENEFITS.map((b) => (
              <div className="ops-benefit-row" key={b.title}>
                <span className="ops-benefit-icon">{b.icon}</span>
                <div>
                  <p className="ops-benefit-title">{b.title}</p>
                  <p className="ops-benefit-sub">{b.sub}</p>
                </div>
              </div>
            ))}
          </section>

          {/* Claim form */}
          <section className="ops-form-section">
            <h2 className="ops-section-title">Claim your venue</h2>
            <p className="ops-section-sub">Fill this out and we'll get you set up within a day.</p>
            <ClaimForm />
          </section>
        </>
      ) : (
        /* Admin console */
        <section className="ops-admin-section">
          <AdminConsole />
        </section>
      )}

    </main>
  );
}

// ── Admin console (lazy-imported to keep bundle clean) ────────────────────────

function AdminConsole() {
  // Dynamically import review data only when admin tab is opened
  const [loaded, setLoaded] = useState(false);
  const [items,  setItems]  = useState<unknown[]>([]);

  if (!loaded) {
    Promise.all([
      import("../../data/ingestion/tampa-review.json"),
      import("../../data/ingestion/tampa-prospect-review.json"),
      import("../../data/ingestion/tampa-instagram-review.json"),
    ]).then(([r, p, i]) => {
      const all = [...(i.default as { items: unknown[] }).items,
                   ...(p.default as { items: unknown[] }).items,
                   ...(r.default as { items: unknown[] }).items];
      setItems(all);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }

  return (
    <div className="ops-admin-wrap">
      <p className="ops-section-label">Admin · Data pipeline</p>
      <h2 className="ops-section-title">Review queue</h2>
      <p className="ops-section-sub">{items.length} signals pending review</p>
      {!loaded ? (
        <p className="ops-loading">Loading queue…</p>
      ) : (
        <div className="ops-admin-list">
          {(items as Array<{ name?: string; neighborhood?: string; status?: string; source?: string }>).slice(0, 20).map((item, i) => (
            <div className="ops-admin-row" key={i}>
              <div className="ops-admin-row-main">
                <p className="ops-admin-name">{item.name ?? "Unknown"}</p>
                <p className="ops-admin-meta">{item.neighborhood ?? "—"} · {item.source ?? "—"}</p>
              </div>
              <span className={`ops-admin-badge ops-badge-${item.status ?? "pending"}`}>
                {item.status ?? "pending"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
