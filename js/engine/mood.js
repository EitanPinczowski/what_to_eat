// Result mood title (R8): first mood whose tags all appear on the food.
import { STR } from "../data/strings.js";
import { QUESTIONS } from "../data/questions.js";

export function moodFor(food, moods = STR.moods) {
  const m = food && moods.find((m) => m.tags.every((t) => food.tags.includes(t)));
  return m ? m.t : STR.moodDefault;
}

const MAX_CHIPS = 3;
const MIN_SCORE = 1.5;

/**
 * answers: [{q: id, i: index | [i, j], inferred?: bool}] or [id, i] pairs, in the order asked. Pure.
 * → {chips: [{tag, label, inferred}], line}: the 2-3 strongest tags (a pair counts 0.6 each, an inferred answer half), line "בא לך משהו חם, מנחם ומלוח —" or "".
 */
export function cravingSummary(answers, questions = QUESTIONS, max = MAX_CHIPS) {
  const score = {}, order = [];
  for (const a of answers ?? []) {
    const [id, i, inferred] = Array.isArray(a) ? a : [a?.q, a?.i, a?.inferred];
    const q = questions.find((x) => x.id === id);
    const idx = Array.isArray(i) ? i : [i];
    for (const j of idx) {
      const ans = q?.answers[j];
      if (!ans) continue;
      for (const [tag, v] of Object.entries(ans.fx)) {
        if (v <= 0 || !STR.craving.tag[tag]) continue;
        const e = (score[tag] ??= { v: 0, own: 0 });
        if (!order.includes(tag)) order.push(tag);
        const w = v * (idx.length > 1 ? 0.6 : 1) * (inferred ? 0.5 : 1);
        e.v += w;
        if (!inferred) e.own += w;
      }
    }
  }
  const top = order.filter((t) => score[t].v >= MIN_SCORE).sort((a, b) => score[b].v - score[a].v).slice(0, max);
  const chips = top.map((tag) => ({ tag, label: STR.craving.tag[tag], inferred: score[tag].own === 0 }));
  const names = chips.map((c) => c.label);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} ו${names.at(-1)}` : names[0];
  return { chips, line: list ? STR.craving.line(list) : "" };
}
