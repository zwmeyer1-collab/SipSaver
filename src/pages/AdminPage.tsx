import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { isAdmin } from "../lib/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

type DbStats = {
  venues: number;
  deals: number;
  profiles: number;
  checkIns: number;
  savedVenues: number;
  venueClaims: number;
};

type DealHealth = {
  verified: number;
  seeded: number;
  needsReview: number;
};

type NeighborhoodRow = {
  neighborhood: string;
  count: number;
};

type VenueClaim = {
  id: string;
  owner_name: string;
  bar_name: string;
  email: string;
  phone: string | null;
  neighborhood: string | null;
  website: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

type RecentCheckIn = {
  id: string;
  venue_name: string;
  neighborhood: string;
  points_earned: number;
  created_at: string;
  profile_id: string;
};

type RecentProfile = {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function fmt(n: number) { return n.toLocaleString(); }

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, sub, accent = "purple" }: {
  label: string; value: number | string; icon: string; sub?: string; accent?: string;
}) {
  return (
    <div className={`adm-stat-card adm-stat-accent-${accent}`}>
      <span className="adm-stat-icon">{icon}</span>
      <div>
        <p className="adm-stat-value">{typeof value === "number" ? fmt(value) : value}</p>
        <p className="adm-stat-label">{label}</p>
        {sub && <p className="adm-stat-sub">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { user, isLoading } = useAuth();

  const [dbStatus,       setDbStatus]       = useState<"checking" | "online" | "offline">("checking");
  const [dbPing,         setDbPing]         = useState<number | null>(null);
  const [stats,          setStats]          = useState<DbStats | null>(null);
  const [dealHealth,     setDealHealth]     = useState<DealHealth | null>(null);
  const [neighborhoods,  setNeighborhoods]  = useState<NeighborhoodRow[]>([]);
  const [venuesNoDeal,   setVenuesNoDeal]   = useState<number>(0);
  const [claims,         setClaims]         = useState<VenueClaim[]>([]);
  const [checkIns,       setCheckIns]       = useState<RecentCheckIn[]>([]);
  const [profiles,       setProfiles]       = useState<RecentProfile[]>([]);
  const [loadingData,    setLoadingData]    = useState(true);
  const [claimFilter,    setClaimFilter]    = useState<"all" | "pending" | "approved">("pending");

  // Block non-admins
  if (!isLoading && (!user || !isAdmin(user.email))) {
    return <Navigate to="/" replace />;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user || !isAdmin(user.email)) return;

    async function load() {
      if (!supabase) return;
      setLoadingData(true);
      const t0 = Date.now();

      try {
        // Run all queries in parallel
        const [
          venuesRes, dealsRes, profilesRes,
          checkInsRes, savedRes, claimsRes,
          recentCheckInsRes, recentProfilesRes,
          allVenueNeighborhoodsRes, allDealStatusRes,
        ] = await Promise.all([
          supabase.from("venues").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("deals").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("check_ins").select("id", { count: "exact", head: true }),
          supabase.from("saved_venues").select("id", { count: "exact", head: true }),
          supabase.from("venue_claims").select("*").order("created_at", { ascending: false }).limit(50),
          supabase.from("check_ins").select("id, venue_name, neighborhood, points_earned, created_at, profile_id")
            .order("created_at", { ascending: false }).limit(10),
          supabase.from("profiles").select("id, name, email, created_at")
            .order("created_at", { ascending: false }).limit(10),
          supabase.from("venues").select("neighborhood").eq("is_active", true),
          supabase.from("deals").select("review_status, venue_id").eq("is_active", true),
        ]);

        setDbPing(Date.now() - t0);
        setDbStatus("online");

        setStats({
          venues:      venuesRes.count      ?? 0,
          deals:       dealsRes.count       ?? 0,
          profiles:    profilesRes.count    ?? 0,
          checkIns:    checkInsRes.count    ?? 0,
          savedVenues: savedRes.count       ?? 0,
          venueClaims: claimsRes.data?.length ?? 0,
        });

        // Deal health breakdown
        const dealRows = (allDealStatusRes.data ?? []) as { review_status: string; venue_id: string }[];
        const health: DealHealth = { verified: 0, seeded: 0, needsReview: 0 };
        const venuesWithDeals = new Set<string>();
        for (const row of dealRows) {
          venuesWithDeals.add(row.venue_id);
          if (row.review_status === "verified") health.verified++;
          else if (row.review_status === "seeded") health.seeded++;
          else health.needsReview++;
        }
        setDealHealth(health);
        setVenuesNoDeal((venuesRes.count ?? 0) - venuesWithDeals.size);

        // Neighborhood breakdown
        const nbRows = (allVenueNeighborhoodsRes.data ?? []) as { neighborhood: string }[];
        const nbMap = new Map<string, number>();
        for (const row of nbRows) {
          nbMap.set(row.neighborhood, (nbMap.get(row.neighborhood) ?? 0) + 1);
        }
        const nbSorted: NeighborhoodRow[] = Array.from(nbMap.entries())
          .map(([neighborhood, count]) => ({ neighborhood, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12);
        setNeighborhoods(nbSorted);

        setClaims((claimsRes.data ?? []) as VenueClaim[]);
        setCheckIns((recentCheckInsRes.data ?? []) as RecentCheckIn[]);
        setProfiles((recentProfilesRes.data ?? []) as RecentProfile[]);
      } catch {
        setDbStatus("offline");
      } finally {
        setLoadingData(false);
      }
    }

    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  async function updateClaimStatus(id: string, status: string) {
    if (!supabase) return;
    await supabase.from("venue_claims").update({ status }).eq("id", id);
    setClaims((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
  }

  const filteredClaims = claimFilter === "all"
    ? claims
    : claims.filter((c) => c.status === claimFilter);

  if (isLoading) return null;

  return (
    <main className="adm-page">

      {/* Header */}
      <div className="adm-header">
        <div>
          <p className="adm-kicker">Admin · SipSaver</p>
          <h1 className="adm-title">Backend Console</h1>
        </div>
        <div className={`adm-status-pill adm-status-${dbStatus}`}>
          <span className="adm-status-dot" />
          {dbStatus === "checking" ? "Connecting…" : dbStatus === "online" ? `DB online · ${dbPing}ms` : "DB offline"}
        </div>
      </div>

      {loadingData ? (
        <div className="adm-loading">
          <div className="adm-loading-spinner" />
          <p>Loading data…</p>
        </div>
      ) : (
        <>
          {/* Stats grid */}
          {stats && (
            <section className="adm-section">
              <p className="adm-section-label">Database overview</p>
              <div className="adm-stats-grid">
                <StatCard icon="🏢" label="Venues"       value={stats.venues}      sub="active" accent="purple" />
                <StatCard icon="🍺" label="Deals"        value={stats.deals}       sub="active" accent="amber" />
                <StatCard icon="👤" label="Users"        value={stats.profiles}    sub="signed up" accent="teal" />
                <StatCard icon="📍" label="Check-ins"    value={stats.checkIns}    sub="total" accent="coral" />
                <StatCard icon="♥"  label="Saved"        value={stats.savedVenues} sub="venue saves" accent="rose" />
                <StatCard icon="📋" label="Claims"       value={stats.venueClaims} sub="submissions" accent="slate" />
              </div>
            </section>
          )}

          {/* Deal health */}
          {dealHealth && (
            <section className="adm-section">
              <p className="adm-section-label">Deal quality</p>
              <div className="adm-health-card">
                <div className="adm-health-bar">
                  {dealHealth.verified > 0 && (
                    <div
                      className="adm-health-seg adm-health-verified"
                      style={{ flex: dealHealth.verified }}
                      title={`${dealHealth.verified} verified`}
                    />
                  )}
                  {dealHealth.seeded > 0 && (
                    <div
                      className="adm-health-seg adm-health-seeded"
                      style={{ flex: dealHealth.seeded }}
                      title={`${dealHealth.seeded} seeded`}
                    />
                  )}
                  {dealHealth.needsReview > 0 && (
                    <div
                      className="adm-health-seg adm-health-needs-review"
                      style={{ flex: dealHealth.needsReview }}
                      title={`${dealHealth.needsReview} needs review`}
                    />
                  )}
                </div>
                <div className="adm-health-legend">
                  <span className="adm-health-dot adm-health-verified" />
                  <span className="adm-health-legend-label">Verified</span>
                  <span className="adm-health-legend-num">{fmt(dealHealth.verified)}</span>
                  <span className="adm-health-dot adm-health-seeded" />
                  <span className="adm-health-legend-label">Seeded</span>
                  <span className="adm-health-legend-num">{fmt(dealHealth.seeded)}</span>
                  {dealHealth.needsReview > 0 && (<>
                    <span className="adm-health-dot adm-health-needs-review" />
                    <span className="adm-health-legend-label">Needs review</span>
                    <span className="adm-health-legend-num">{fmt(dealHealth.needsReview)}</span>
                  </>)}
                </div>
                {venuesNoDeal > 0 && (
                  <p className="adm-health-warning">⚠ {venuesNoDeal} venue{venuesNoDeal !== 1 ? "s" : ""} have no deals</p>
                )}
              </div>
            </section>
          )}

          {/* Neighborhood breakdown */}
          {neighborhoods.length > 0 && (
            <section className="adm-section">
              <p className="adm-section-label">Neighborhoods</p>
              <div className="adm-nb-card">
                {neighborhoods.map((nb, i) => {
                  const max = neighborhoods[0].count;
                  return (
                    <div className="adm-nb-row" key={nb.neighborhood}>
                      <span className="adm-nb-rank">{i + 1}</span>
                      <div className="adm-nb-body">
                        <div className="adm-nb-name-row">
                          <span className="adm-nb-name">{nb.neighborhood}</span>
                          <span className="adm-nb-count">{nb.count}</span>
                        </div>
                        <div className="adm-nb-track">
                          <div className="adm-nb-fill" style={{ width: `${(nb.count / max) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Venue claims */}
          <section className="adm-section">
            <div className="adm-section-head">
              <p className="adm-section-label">Venue claims</p>
              <div className="adm-filter-row">
                {(["pending", "approved", "all"] as const).map((f) => (
                  <button
                    key={f}
                    className={`adm-filter-btn ${claimFilter === f ? "adm-filter-active" : ""}`}
                    type="button"
                    onClick={() => setClaimFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filteredClaims.length === 0 ? (
              <p className="adm-empty">No {claimFilter === "all" ? "" : claimFilter} claims yet.</p>
            ) : (
              <div className="adm-claims-list">
                {filteredClaims.map((c) => (
                  <div className="adm-claim-card" key={c.id}>
                    <div className="adm-claim-top">
                      <div>
                        <p className="adm-claim-bar">{c.bar_name}</p>
                        <p className="adm-claim-meta">{c.owner_name} · {c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                        {c.neighborhood && <p className="adm-claim-meta">{c.neighborhood}{c.website ? ` · ${c.website}` : ""}</p>}
                        {c.message && <p className="adm-claim-msg">"{c.message}"</p>}
                      </div>
                      <div className="adm-claim-right">
                        <span className={`adm-badge adm-badge-${c.status}`}>{c.status}</span>
                        <p className="adm-claim-time">{timeAgo(c.created_at)}</p>
                      </div>
                    </div>
                    {c.status === "pending" && (
                      <div className="adm-claim-actions">
                        <button className="adm-btn-approve" type="button" onClick={() => void updateClaimStatus(c.id, "approved")}>
                          ✓ Approve
                        </button>
                        <button className="adm-btn-reject" type="button" onClick={() => void updateClaimStatus(c.id, "rejected")}>
                          ✕ Reject
                        </button>
                        <a className="adm-btn-email" href={`mailto:${c.email}?subject=Your SipSaver venue claim for ${c.bar_name}`}>
                          Email owner
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent check-ins */}
          <section className="adm-section">
            <p className="adm-section-label">Recent check-ins</p>
            {checkIns.length === 0 ? (
              <p className="adm-empty">No check-ins yet.</p>
            ) : (
              <div className="adm-activity-list">
                {checkIns.map((c) => (
                  <div className="adm-activity-row" key={c.id}>
                    <span className="adm-activity-icon">📍</span>
                    <div className="adm-activity-body">
                      <p className="adm-activity-main">{c.venue_name}</p>
                      <p className="adm-activity-sub">{c.neighborhood} · +{c.points_earned} pts</p>
                    </div>
                    <p className="adm-activity-time">{timeAgo(c.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent sign-ups */}
          <section className="adm-section">
            <p className="adm-section-label">Recent sign-ups</p>
            {profiles.length === 0 ? (
              <p className="adm-empty">No users yet.</p>
            ) : (
              <div className="adm-activity-list">
                {profiles.map((p) => (
                  <div className="adm-activity-row" key={p.id}>
                    <span className="adm-activity-icon">👤</span>
                    <div className="adm-activity-body">
                      <p className="adm-activity-main">{p.name ?? p.email.split("@")[0]}</p>
                      <p className="adm-activity-sub">{p.email}</p>
                    </div>
                    <p className="adm-activity-time">{timeAgo(p.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
