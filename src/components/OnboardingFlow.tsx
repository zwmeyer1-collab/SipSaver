import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const ONBOARDING_KEY = "sipsaver_onboarded";

export function hasCompletedOnboarding() {
  return Boolean(localStorage.getItem(ONBOARDING_KEY));
}

export function markOnboardingDone() {
  localStorage.setItem(ONBOARDING_KEY, "1");
}

const NEIGHBORHOODS = [
  { id: "soho",      label: "SoHo",             emoji: "🍸" },
  { id: "ybor",      label: "Ybor City",         emoji: "🎺" },
  { id: "downtown",  label: "Downtown",           emoji: "🏙" },
  { id: "channel",   label: "Channelside",        emoji: "⚓" },
  { id: "seminole",  label: "Seminole Heights",   emoji: "🌿" },
  { id: "heights",   label: "Tampa Heights",      emoji: "🏠" },
  { id: "hyde",      label: "Hyde Park",          emoji: "🌳" },
  { id: "westshore", label: "Westshore",          emoji: "✈️" },
];

type Props = { onDone: () => void };

export function OnboardingFlow({ onDone }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const firstName = user?.name?.split(" ")[0] ?? "there";

  function toggleNeighborhood(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function finish() {
    if (selected.size > 0) {
      localStorage.setItem("sipsaver_neighborhoods", JSON.stringify(Array.from(selected)));
    }
    markOnboardingDone();
    onDone();
  }

  return (
    <div className="ob-overlay">
      <div className="ob-sheet">

        {step === 1 && (
          <div className="ob-step ob-step-welcome">
            <div className="ob-confetti">🎉</div>
            <h1 className="ob-headline">Welcome, {firstName}!</h1>
            <p className="ob-sub">
              You're now part of Tampa's happy hour community.
              Let's get you set up in 30 seconds.
            </p>
            <div className="ob-welcome-perks">
              <div className="ob-perk"><span>📍</span><span>Live deal countdowns</span></div>
              <div className="ob-perk"><span>♥</span><span>Save your favorite spots</span></div>
              <div className="ob-perk"><span>🏆</span><span>Earn points for every visit</span></div>
            </div>
            <button className="ob-btn-primary" type="button" onClick={() => setStep(2)}>
              Let's go →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="ob-step ob-step-neighborhoods">
            <p className="ob-step-label">Step 1 of 2</p>
            <h2 className="ob-headline">Where do you like to go?</h2>
            <p className="ob-sub">Pick your Tampa neighborhoods and we'll surface the best deals there first.</p>
            <div className="ob-neighborhood-grid">
              {NEIGHBORHOODS.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`ob-neighborhood-chip ${selected.has(n.id) ? "ob-chip-selected" : ""}`}
                  onClick={() => toggleNeighborhood(n.id)}
                >
                  <span className="ob-chip-emoji">{n.emoji}</span>
                  <span className="ob-chip-label">{n.label}</span>
                  {selected.has(n.id) && <span className="ob-chip-check">✓</span>}
                </button>
              ))}
            </div>
            <button
              className="ob-btn-primary"
              type="button"
              onClick={() => setStep(3)}
            >
              {selected.size > 0 ? `Looks good →` : "Skip for now →"}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="ob-step ob-step-done">
            <div className="ob-done-icon">🍺</div>
            <h2 className="ob-headline">You're all set!</h2>
            <p className="ob-sub">
              {selected.size > 0
                ? `We'll highlight deals in ${Array.from(selected).length > 1 ? `your ${Array.from(selected).length} neighborhoods` : NEIGHBORHOODS.find(n => n.id === Array.from(selected)[0])?.label ?? "your area"} first.`
                : "Deals across all of Tampa are waiting for you."}
            </p>
            <div className="ob-done-tips">
              <p className="ob-tip"><strong>Tip:</strong> Tap any deal card to see the full venue, hours, and check-in button.</p>
              <p className="ob-tip"><strong>Tip:</strong> Check in at a venue to earn 50 points toward rewards.</p>
            </div>
            <button className="ob-btn-primary" type="button" onClick={finish}>
              Find tonight's deals →
            </button>
          </div>
        )}

        {/* Step dots */}
        <div className="ob-dots">
          {[1, 2, 3].map((s) => (
            <span key={s} className={`ob-dot ${step === s ? "ob-dot-active" : ""}`} />
          ))}
        </div>

      </div>
    </div>
  );
}
