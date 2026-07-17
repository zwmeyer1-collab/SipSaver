import { useEffect, useState } from "react";

/**
 * Returns a counter that increments every `intervalMs` (default 60s).
 * Components that call this will re-render on each tick, which causes
 * getDisplayDeals() to recompute fresh countdown labels automatically.
 */
export function useMinuteTick(intervalMs = 60_000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Align the first tick to the start of the next minute so all
    // countdowns flip at the same moment rather than drifting.
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      setTick((t) => t + 1);
      interval = setInterval(() => setTick((t) => t + 1), intervalMs);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [intervalMs]);

  return tick;
}
