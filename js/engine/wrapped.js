// "Food wrapped": monthly recap computed on Eitan's device from stored history. No new data.
// The result is a small summary that travels inside the link (#w=), so no Firestore doc and no rules change.
export const MIN_MEALS = 3; // below this the guest sees one friendly "not enough yet" card

/** "YYYY-MM" (local time) of an ISO timestamp, or "" when it is not a date. */
export function monthKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The month before `now` ("2026-12-01" → "2026-11"). */
export function prevMonth(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const isFirstOfMonth = (now = new Date()) => now.getDate() === 1;

const top = (counts, n = 1) =>
  Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n);

/** Question that most often shows up in quizzes whose first guess missed (≥3 asks), else the most-skipped one. */
export function hardQuestion(entries) {
  const skips = {};
  for (const e of entries) for (const q of e.stats?.skips ?? []) skips[q] = (skips[q] ?? 0) + 1;
  if (Object.keys(skips).length) return top(skips)[0][0];
  const asked = {}, missed = {};
  for (const e of entries) {
    if (!e.stats || !Array.isArray(e.ans)) continue;
    const miss = !(e.stats.hit && e.stats.guesses <= 1);
    for (const a of e.ans) {
      const q = String(a).split(":")[0];
      asked[q] = (asked[q] ?? 0) + 1;
      if (miss) missed[q] = (missed[q] ?? 0) + 1;
    }
  }
  const ranked = Object.keys(asked)
    .filter((q) => asked[q] >= 3 && (missed[q] ?? 0) > 0)
    .sort((a, b) => (missed[b] ?? 0) / asked[b] - (missed[a] ?? 0) / asked[a] || (missed[b] ?? 0) - (missed[a] ?? 0) || (a < b ? -1 : 1));
  return ranked[0] ?? null;
}

/**
 * Summary of one month (month = "YYYY-MM") from history entries ({at, f, fn, fe, stats, place}) and places ({id: {name}}).
 * Returns small plain fields only: {mo, n, top: [[foodId|null, name, emoji, count]], hit, q, pl, enough}.
 * hit = % of quizzes whose very first guess was right (only quizzes that carry stats), null when none.
 */
export function wrappedSummary(history, month, places = {}) {
  const es = (history ?? []).filter((e) => monthKey(e.at) === month);
  const counts = {}, meta = {};
  for (const e of es) {
    const key = e.f ?? `~${e.fn}`;
    counts[key] = (counts[key] ?? 0) + 1;
    meta[key] ??= [e.f ?? null, String(e.fn ?? "").slice(0, 40), e.fe || "🍽️"];
  }
  const withStats = es.filter((e) => e.stats);
  const firstHit = withStats.filter((e) => e.stats.hit && e.stats.guesses <= 1).length;
  const visits = {};
  for (const e of es) if (e.place && places[e.place]?.name) visits[e.place] = (visits[e.place] ?? 0) + 1;
  const fav = top(visits)[0];
  return {
    mo: month,
    n: es.length,
    enough: es.length >= MIN_MEALS,
    top: top(counts, 3).map(([k, c]) => [...meta[k], c]),
    hit: withStats.length ? Math.round((firstHit / withStats.length) * 100) : null,
    q: hardQuestion(es),
    pl: fav ? String(places[fav[0]].name).slice(0, 40) : null,
  };
}
