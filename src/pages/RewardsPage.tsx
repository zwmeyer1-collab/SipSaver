import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useRewards,
  REWARDS,
  LEVELS,
  POINT_VALUES,
  type Reward,
} from "../hooks/useRewards";

function getBadgeProgress(badgeId: string, state: ReturnType<typeof import("../hooks/useRewards").useRewards>["state"]): { current: number; total: number } | null {
  const uniqueNeighborhoods = new Set(state.checkIns.map((c) => c.neighborhood));
  switch (badgeId) {
    case "first_sip":  return { current: Math.min(state.checkIns.length, 1), total: 1 };
    case "regular":    return { current: Math.min(state.checkIns.length, 5), total: 5 };
    case "explorer":   return { current: Math.min(uniqueNeighborhoods.size, 3), total: 3 };
    case "social_butterfly": return { current: Math.min(state.sharedPlans, 1), total: 1 };
    case "deal_hunter": return { current: Math.min(state.dealsUsed, 5), total: 5 };
    case "platinum_sipper": return { current: Math.min(state.points, 3000), total: 3000 };
    default: return null;
  }
}

export function RewardsPage() {
  const { state, level, streak, earnedBadges, unearnedBadges, redeemReward, checkIn } = useRewards();
  const [redeemedId, setRedeemedId] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [demoCheckedIn, setDemoCheckedIn] = useState(false);

  function handleRedeem(reward: Reward) {
    if (state.points < reward.cost) {
      setRedeemError(`You need ${reward.cost - state.points} more points for this reward.`);
      setTimeout(() => setRedeemError(null), 3000);
      return;
    }
    redeemReward(reward);
    setRedeemedId(reward.id);
    setTimeout(() => setRedeemedId(null), 3000);
  }

  // Demo check-in for testing (MacDinton's)
  function handleDemoCheckIn() {
    checkIn({ id: "macdintions", name: "MacDinton's", neighborhood: "SoHo" }, "$5 domestic buckets");
    setDemoCheckedIn(true);
  }

  // Progress to next level
  const nextLevel = LEVELS.find((l) => l.minPoints > state.points);
  const pointsToNext = nextLevel ? nextLevel.minPoints - state.points : 0;

  return (
    <main className="dashboard page-shell rewards-page">

      {/* ── Hero / Level card ─────────────────────────────────────────── */}
      <section className="rewards-hero mobile-section-card">
        <div className="rewards-level-card">
          <div className="rewards-level-left">
            <span className="rewards-level-icon">{level.icon}</span>
            <div>
              <p className="rewards-level-name">{level.name}</p>
              <p className="rewards-points-display">
                <strong>{state.points.toLocaleString()}</strong>
                <span> pts</span>
              </p>
            </div>
          </div>
          <div className="rewards-level-right">
            {nextLevel ? (
              <>
                <p className="rewards-next-label">{pointsToNext} pts to {nextLevel.name}</p>
                <div className="rewards-progress-track">
                  <div
                    className="rewards-progress-fill"
                    style={{ width: `${level.progress}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="rewards-next-label">🏆 Max level!</p>
            )}
          </div>
        </div>

        <div className="rewards-stats-row">
          <div className="rewards-stat">
            <strong>{state.checkIns.length}</strong>
            <span>check-ins</span>
          </div>
          <div className="rewards-stat">
            <strong>{earnedBadges.length}</strong>
            <span>badges</span>
          </div>
          {streak > 0 ? (
            <div className="rewards-stat rewards-stat-streak">
              <strong>{streak}🔥</strong>
              <span>day streak</span>
            </div>
          ) : (
            <div className="rewards-stat">
              <strong>{state.sharedPlans}</strong>
              <span>plans shared</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Earn points ───────────────────────────────────────────────── */}
      <section className="mobile-section-card rewards-earn-section">
        <p className="section-label">Earn points</p>
        <h3 className="panel-title">How to stack up</h3>
        <div className="rewards-earn-list">
          {[
            { action: "Check in at a venue",        pts: POINT_VALUES.checkIn,      icon: "📍" },
            { action: "Invite a friend",             pts: POINT_VALUES.inviteFriend, icon: "👥" },
            { action: "Share a Hoppy Hour plan",     pts: POINT_VALUES.sharePlan,    icon: "🍻" },
            { action: "Use a deal",                  pts: POINT_VALUES.useDeal,      icon: "🎯" },
            { action: "Save a venue",                pts: POINT_VALUES.saveVenue,    icon: "♡" },
          ].map(({ action, pts, icon }) => (
            <div className="rewards-earn-row" key={action}>
              <span className="rewards-earn-icon">{icon}</span>
              <span className="rewards-earn-action">{action}</span>
              <span className="rewards-earn-pts">+{pts} pts</span>
            </div>
          ))}
        </div>

        {/* Demo check-in for testing */}
        {!demoCheckedIn ? (
          <button className="rewards-checkin-demo-btn" type="button" onClick={handleDemoCheckIn}>
            📍 Try a check-in (+{POINT_VALUES.checkIn} pts)
          </button>
        ) : (
          <div className="rewards-checkin-success">
            ✓ Checked in at MacDinton's — +{POINT_VALUES.checkIn} points earned!
          </div>
        )}
      </section>

      {/* ── Redeem rewards ────────────────────────────────────────────── */}
      <section className="mobile-section-card">
        <p className="section-label">Redeem</p>
        <h3 className="panel-title">Use your points</h3>
        {redeemError && <p className="rewards-error">{redeemError}</p>}
        <div className="rewards-redeem-list">
          {REWARDS.map((reward) => {
            const canAfford = state.points >= reward.cost;
            const justRedeemed = redeemedId === reward.id;
            return (
              <div
                className={`rewards-redeem-card ${!canAfford ? "rewards-redeem-locked" : ""} ${justRedeemed ? "rewards-redeem-success" : ""}`}
                key={reward.id}
              >
                <span className="rewards-redeem-icon">{reward.icon}</span>
                <div className="rewards-redeem-body">
                  <div className="rewards-redeem-head">
                    <p className="rewards-redeem-name">{reward.name}</p>
                    <span className="rewards-redeem-tag">{reward.tag}</span>
                  </div>
                  <p className="rewards-redeem-desc">{reward.description}</p>
                  <div className="rewards-redeem-footer">
                    <span className="rewards-cost-badge">{reward.cost.toLocaleString()} pts</span>
                    <button
                      className={`rewards-redeem-btn ${canAfford ? "rewards-redeem-btn-active" : "rewards-redeem-btn-locked"}`}
                      type="button"
                      disabled={!canAfford}
                      onClick={() => handleRedeem(reward)}
                    >
                      {justRedeemed ? "✓ Redeemed!" : canAfford ? "Redeem" : `Need ${(reward.cost - state.points).toLocaleString()} more`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Badges ────────────────────────────────────────────────────── */}
      <section className="mobile-section-card">
        <p className="section-label">Badges</p>
        <h3 className="panel-title">{earnedBadges.length} of {earnedBadges.length + unearnedBadges.length} earned</h3>

        {earnedBadges.length > 0 && (
          <div className="rewards-badge-grid">
            {earnedBadges.map((badge) => (
              <div className="rewards-badge rewards-badge-earned" key={badge.id}>
                <span className="rewards-badge-icon">{badge.icon}</span>
                <p className="rewards-badge-name">{badge.name}</p>
                <p className="rewards-badge-desc">{badge.description}</p>
              </div>
            ))}
          </div>
        )}

        {unearnedBadges.length > 0 && (
          <>
            <p className="rewards-locked-label">Locked</p>
            <div className="rewards-badge-grid">
              {unearnedBadges.map((badge) => {
                const progress = getBadgeProgress(badge.id, state);
                const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;
                return (
                  <div className="rewards-badge rewards-badge-locked" key={badge.id}>
                    <span className="rewards-badge-icon">🔒</span>
                    <p className="rewards-badge-name">{badge.name}</p>
                    <p className="rewards-badge-desc">{badge.description}</p>
                    {progress && (
                      <div className="badge-progress-wrap">
                        <div className="badge-progress-track">
                          <div className="badge-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="badge-progress-label">
                          {badge.id === "platinum_sipper"
                            ? `${state.points.toLocaleString()} / 3,000 pts`
                            : `${progress.current} / ${progress.total}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ── Level roadmap ─────────────────────────────────────────────── */}
      <section className="mobile-section-card">
        <p className="section-label">Levels</p>
        <h3 className="panel-title">Your progression path</h3>
        <div className="rewards-level-list">
          {LEVELS.map((l) => {
            const isCurrentLevel = l.minPoints <= state.points && (l.maxPoints === 99999 || state.points < l.maxPoints);
            const isPast = state.points >= l.maxPoints && l.maxPoints !== 99999;
            return (
              <div
                className={`rewards-level-row ${isCurrentLevel ? "rewards-level-row-active" : ""} ${isPast ? "rewards-level-row-past" : ""}`}
                key={l.name}
              >
                <span className="rewards-level-row-icon">{l.icon}</span>
                <div className="rewards-level-row-body">
                  <p className="rewards-level-row-name">{l.name}</p>
                  <p className="rewards-level-row-range">
                    {l.maxPoints === 99999 ? `${l.minPoints.toLocaleString()}+ pts` : `${l.minPoints.toLocaleString()} – ${l.maxPoints.toLocaleString()} pts`}
                  </p>
                </div>
                {isCurrentLevel && <span className="rewards-level-row-current">Current</span>}
                {isPast && <span className="rewards-level-row-done">✓</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Recent check-ins ──────────────────────────────────────────── */}
      {state.checkIns.length > 0 && (
        <section className="mobile-section-card">
          <p className="section-label">History</p>
          <h3 className="panel-title">Your check-ins</h3>
          <div className="rewards-checkin-list">
            {state.checkIns.slice(0, 8).map((c, i) => (
              <div className="rewards-checkin-row" key={i}>
                <span className="rewards-checkin-icon">📍</span>
                <div className="rewards-checkin-body">
                  <p className="rewards-checkin-venue">{c.venueName}</p>
                  <p className="rewards-checkin-meta">
                    {c.neighborhood} · {new Date(c.timestamp).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                  {c.dealDesc && <p className="rewards-checkin-deal">{c.dealDesc.slice(0, 60)}{c.dealDesc.length > 60 ? "…" : ""}</p>}
                </div>
                <span className="rewards-checkin-pts">+{POINT_VALUES.checkIn}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="rewards-cta-row">
        <Link className="crawl-generate-btn" to="/hoppy">
          🍻 Build a night plan
        </Link>
        <Link className="inline-panel-link" to="/venues">
          Find venues to check into →
        </Link>
      </div>

    </main>
  );
}
