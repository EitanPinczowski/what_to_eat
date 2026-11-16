// Learned bonus per (answer, tag) = 0.5 × (P(tag | answer) − P(tag)), decayed, capped ±1.5, after ≥5 quizzes.
export const MIN_QUIZZES = 5;
const CAP = 1.5;
const MIN_SEEN = 2;

/**
 * entries: history ({f, ans, at, how}); returns "qid:i" → {tag: bonus}
 */
export function learnFrom(entries, foods) {
  const byId = new Map(foods.map((f) => [f.id, f.tags]));
  const picks = entries.filter((e) => byId.has(e.f) && Array.isArray(e.ans));
  if (picks.length < MIN_QUIZZES) return {};
  // weight 0.5^(age/60 d) against her newest quiz, not the clock: a resumed quiz replays the same
  const ref = Math.max(...picks.map((e) => Date.parse(e.at)).filter(Number.isFinite));
  const wOf = (e) => (Number.isFinite(ref) && Date.parse(e.at) <= ref ? 0.5 ** ((ref - Date.parse(e.at)) / 864e5 / 60) : 1);
  const mass = (es) => {
    const m = new Map(), t = es.reduce((n, e) => n + wOf(e), 0);
    for (const e of es) for (const g of byId.get(e.f)) m.set(g, (m.get(g) ?? 0) + wOf(e) / t);
    return m;
  };
  const all = mass(picks), byAns = {}, out = {};
  for (const e of picks) for (const a of e.ans) (byAns[Array.isArray(a) ? a.join(":") : a] ??= []).push(e);
  for (const [k, es] of Object.entries(byAns)) {
    if (es.length < MIN_SEEN) continue;
    const loc = mass(es), o = {};
    for (const g of new Set([...loc.keys(), ...all.keys()])) o[g] = 0.5 * ((loc.get(g) ?? 0) - (all.get(g) ?? 0));
    for (const e of es) if (e.how) for (const g of byId.get(e.f)) o[g] += 0.15 * Math.sign(e.how) * wOf(e); // 👍/👎 of that quiz
    for (const g in o) if (Math.abs(o[g]) >= 0.05) (out[k] ??= {})[g] = Math.max(-CAP, Math.min(CAP, Math.round(o[g] * 100) / 100));
  }
  return out;
}

/** The one definition of a hit. rank = 1-based place of the right food among what was offered, 0 = never offered. */
export const hitFrom = (rank) => ({ rank, hit: rank > 0, first: rank === 1, top3: rank >= 1 && rank <= 3 });
export const rankIn = (offered, id) => offered.indexOf(id) + 1;
/** Rank of a history entry's stats: the guess that was right (stats.guesses), 0 when none was. */
export const statsRank = (s) => (s?.hit ? Math.max(1, s.guesses | 0) : 0);

/** "How was it?" nudge: ±0.5 per vote, kept within ±1. */
export function nudgeExp(exp, foodId, up) {
  const v = Math.max(-1, Math.min(1, (exp[foodId] ?? 0) + (up ? 0.5 : -0.5)));
  return { ...exp, [foodId]: v };
}

/** The question ids of her last n quizzes, most recent first (from history `ans`): the engine lets a variant she saw lately wait. */
export function seenFrom(history, n = 3) {
  return (history ?? [])
    .filter((e) => Array.isArray(e.ans))
    .sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")))
    .slice(0, n)
    .map((e) => e.ans.map((a) => (Array.isArray(a) ? a[0] : String(a).split(":")[0])));
}
