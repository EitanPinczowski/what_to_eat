// Learning loops (spec-loops-places-design.md §2.6).
// Learned bonus per (answer, tag) = 0.5 × (P(tag | answer) − P(tag)), capped ±1.5, after ≥5 quizzes.
export const MIN_QUIZZES = 5;
const CAP = 1.5;
const MIN_SEEN = 2;

/**
 * @param entries history entries with `f` (food id) and `ans` ([questionId, answerIndex][])
 * @param foods Food[]
 * @returns {Object<string, Object<string, number>>} "qid:i" → {tag: bonus}
 */
export function learnFrom(entries, foods) {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const picks = entries.filter((e) => e.f && byId.has(e.f) && Array.isArray(e.ans));
  if (picks.length < MIN_QUIZZES) return {};
  const tagCount = {};
  for (const e of picks) for (const t of byId.get(e.f).tags) tagCount[t] = (tagCount[t] ?? 0) + 1;
  const byAns = {};
  for (const e of picks)
    for (const a of e.ans) {
      const [q, i] = Array.isArray(a) ? a : String(a).split(":");
      const k = `${q}:${i}`;
      (byAns[k] ??= []).push(byId.get(e.f));
    }
  const out = {};
  for (const [k, fs] of Object.entries(byAns)) {
    if (fs.length < MIN_SEEN) continue;
    const local = {};
    for (const f of fs) for (const t of f.tags) local[t] = (local[t] ?? 0) + 1;
    const tags = new Set([...Object.keys(local), ...Object.keys(tagCount)]);
    for (const t of tags) {
      const b = 0.5 * ((local[t] ?? 0) / fs.length - (tagCount[t] ?? 0) / picks.length);
      if (Math.abs(b) >= 0.05) (out[k] ??= {})[t] = Math.max(-CAP, Math.min(CAP, Math.round(b * 100) / 100));
    }
  }
  return out;
}

/** Accuracy stats from history entries with `stats` ({hit, steps, guesses, skips}). */
export function statsFrom(entries) {
  const st = entries.map((e) => e.stats).filter(Boolean);
  if (!st.length) return null;
  const skips = {};
  for (const s of st) for (const q of s.skips ?? []) skips[q] = (skips[q] ?? 0) + 1;
  const worst = Object.entries(skips).sort((a, b) => b[1] - a[1])[0];
  return {
    n: st.length,
    hitRate: st.filter((s) => s.hit).length / st.length,
    avgSteps: st.reduce((a, s) => a + (s.steps ?? 0), 0) / st.length,
    confusing: worst ? worst[0] : null,
  };
}

/** "How was it?" nudge: ±0.5 per vote, kept within ±1. */
export function nudgeExp(exp, foodId, up) {
  const v = Math.max(-1, Math.min(1, (exp[foodId] ?? 0) + (up ? 0.5 : -0.5)));
  return { ...exp, [foodId]: v };
}
