import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSavedVenues } from "../hooks/useSavedVenues";
import { useRewards, computeStreak } from "../hooks/useRewards";
import { isAdmin } from "../lib/admin";

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const { savedVenueIds } = useSavedVenues();
  const { state: rewardsState, level, earnedBadges } = useRewards();
  const streak = computeStreak(rewardsState.checkIns);

  if (!user) return null;

  const initial = user.name?.charAt(0).toUpperCase() ?? "?";
  const pointsToNext = level.maxPoints === 99999 ? 0 : level.maxPoints - rewardsState.points;

  return (
    <main className="auth-page auth-page-profile">
      <div className="auth-profile-header">
        <h2 className="auth-profile-title">Profile</h2>
        <button className="auth-profile-signout" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      <div className="auth-profile-body">
        <div className="auth-avatar-wrap">
          <div className="auth-avatar">{initial}</div>
          <h1 className="auth-profile-name">{user.name}</h1>
          <p className="auth-profile-email">{user.email}</p>
        </div>

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
              <div className="auth-level-bar">
                <div className="auth-level-bar-fill" style={{ width: `${level.progress}%` }} />
              </div>
            </div>
          ) : (
            <p className="auth-level-max">🏆 Max level!</p>
          )}
        </div>

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
