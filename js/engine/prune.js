// Self-pruning pool (W6): a question variant that almost never changes her top 3 leaves the rotation.
// Impact is replayed from her finished quizzes (history `ans`), so the quiz needs no extra read.
import { FoodQuiz } from "./quiz.js";

export const PRUNE_MIN_ASKS = 20;
export const PRUNE_RATE = 0.1;
export const MIN_VARIANTS = 2;
const LAST = 60; // replay at most her last 60 quizzes (cost)
const top3 = (z) => z.ranked().slice(0, 3).map((x) => x.f.id).join();

/** Per question id: {asked, changed} where changed = the top 3 differed after the answer. */
export function variantImpact(history, foods, questions) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const out = {};
  const rows = (history ?? []).filter((e) => Array.isArray(e.ans) && e.ans.length).sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? ""))).slice(-LAST);
  for (const e of rows) {
    const z = new FoodQuiz(foods, questions, {}, { rnd: () => 0.5, shuffle: false });
    for (const a of e.ans) {
      const [qid, i] = Array.isArray(a) ? a : String(a).split(":");
      const q = byId.get(qid);
      if (!q || !q.answers[+i]) continue;
      const before = top3(z);
      z.answer(q, +i);
      const o = (out[qid] ??= { asked: 0, changed: 0 });
      o.asked++;
      if (top3(z) !== before) o.changed++;
    }
  }
  return out;
}

/** Ids of the variants to drop: at least PRUNE_MIN_ASKS asks and under PRUNE_RATE impact, never leaving fewer than MIN_VARIANTS on an axis (the weakest go first). */
export function prunedVariants(history, foods, questions) {
  const imp = variantImpact(history, foods, questions);
  const rate = (id) => imp[id].changed / imp[id].asked;
  const drop = [];
  const axes = {};
  for (const q of questions) (axes[q.axis] ??= []).push(q);
  for (const vs of Object.values(axes)) {
    const bad = vs.filter((q) => imp[q.id]?.asked >= PRUNE_MIN_ASKS && rate(q.id) < PRUNE_RATE).sort((a, b) => rate(a.id) - rate(b.id) || (a.id < b.id ? -1 : 1));
    drop.push(...bad.slice(0, Math.max(0, vs.length - MIN_VARIANTS)).map((q) => ({ id: q.id, axis: q.axis, text: q.text, asked: imp[q.id].asked, rate: Math.round(rate(q.id) * 100) })));
  }
  return drop;
}
