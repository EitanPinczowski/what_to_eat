// Item 9: the picker opened from home links to her latest quiz result when it is fresh and still has no place.
export const RECENT_MS = 3 * 3600e3;

/** Newest history entry under 3 h old that has a food and no place / "going" mark yet; else null. */
export function recentQuizEntry(list, now = Date.now()) {
  let best = null;
  for (const h of list ?? []) {
    const t = new Date(h.at).getTime();
    if (!Number.isFinite(t) || now - t >= RECENT_MS || t > now + 6e4) continue;
    if (h.place || h.goAt || (!h.f && !h.fn)) continue;
    if (!best || t > new Date(best.at).getTime()) best = h;
  }
  return best;
}
