/**
 * Shared countdown label utilities used across deal card components.
 */

/**
 * Parses minutes remaining from a LIVE label like "47m left", "2h 15m left", "1h left".
 * Returns null if the label isn't a live countdown.
 */
export function parseLiveMinutes(label: string): number | null {
  const hm = label.match(/(\d+)h\s*(\d+)m\s*left/i);
  if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2]);
  const hOnly = label.match(/(\d+)h\s*left/i);
  if (hOnly) return parseInt(hOnly[1]) * 60;
  const mOnly = label.match(/(\d+)m\s*left/i);
  if (mOnly) return parseInt(mOnly[1]);
  return null;
}

export function parseCountdownMinutes(label: string): number | null {
  const hm = label.match(/(\d+)h\s*(\d+)m/);
  if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2]);
  const hOnly = label.match(/(\d+)h(?!\s*\d)/);
  if (hOnly) return parseInt(hOnly[1]) * 60;
  const mOnly = label.match(/(\d+)m(?!\s*left)/);
  if (mOnly) return parseInt(mOnly[1]);
  return null;
}

/**
 * Returns a CSS modifier class for the countdown badge on a dark-background deal card.
 * Variants: countdown-green | countdown-urgent | countdown-amber | countdown-blue | countdown-gray
 */
export function getCountdownVariant(label: string): string {
  if (!label || label === "Time posted") return "countdown-gray";
  if (label.includes("live") || label.includes("ends") || label.includes("left")) return "countdown-green";
  if (label.includes("Starts")) {
    const mins = parseCountdownMinutes(label);
    if (mins !== null && mins <= 30) return "countdown-urgent";
    return "countdown-amber";
  }
  return "countdown-blue";
}

/**
 * Returns a CSS modifier for a light-background deal badge (venue detail page).
 * Variants: venue-deal-badge-live | venue-deal-badge-urgent | venue-deal-badge-soon | ""
 */
export function getVenueDealBadgeVariant(label: string): string {
  if (!label || label === "Time posted") return "";
  if (label.includes("left")) return "venue-deal-badge-live";
  if (label.includes("Starts")) {
    const mins = parseCountdownMinutes(label);
    if (mins !== null && mins <= 30) return "venue-deal-badge-urgent";
    return "venue-deal-badge-soon";
  }
  return "";
}
