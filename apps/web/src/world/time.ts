// Shared day/night clock derived from wall time so every player sees the same sky.
export const DAY_LENGTH_MS = 24 * 60 * 1000; // one in-game day = 24 real minutes

// `?hour=13` pins the clock (useful for screenshots, QA and accessibility).
const pinned = (() => {
  try {
    const v = new URLSearchParams(location.search).get("hour");
    const n = v === null ? NaN : Number(v);
    return n >= 0 && n < 24 ? n : null;
  } catch {
    return null;
  }
})();

export function gameHour(now = Date.now()): number {
  if (pinned !== null) return pinned;
  // Offset so that a fresh session usually lands in daylight hours.
  return (((now / DAY_LENGTH_MS) * 24 + 10) % 24 + 24) % 24;
}

export function formatHour(h: number) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  const ampm = hh < 12 ? "am" : "pm";
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${ampm}`;
}

/** 0 at night, 1 at midday, smooth through dawn (6am) and dusk (6:30pm). */
export function daylight(h: number) {
  const up = smooth(5.5, 7.5, h), down = 1 - smooth(17.8, 19.4, h);
  return Math.max(0, Math.min(up, down));
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
