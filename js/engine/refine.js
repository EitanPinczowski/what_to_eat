// Result-screen helpers, loaded on demand (not in the start-up graph): "why this?" lines and the "Close, but…" nudges.
import { STR } from "../data/strings.js";
import { QUESTIONS } from "../data/questions.js";
import { cravingSummary } from "./mood.js";

const ALL = 99;

/** One short line from the food's strongest matches with her answers ("חם, מנחם ועם רוטב"), or "" when nothing matches. Pure. */
export function whyLine(food, answers, questions = QUESTIONS) {
  const tags = new Set(food?.tags ?? []);
  const hits = cravingSummary(answers, questions, ALL).chips.filter((c) => tags.has(c.tag)).slice(0, 3).map((c) => c.label);
  return hits.length > 1 ? `${hits.slice(0, -1).join(", ")} ו${hits.at(-1)}` : (hits[0] ?? "");
}

/** direction → {fx: tag weights the re-rank adds, from: her tags it is the opposite of (weight = how strongly)}. */
export const NUDGES = {
  light: { fx: { light: 2, healthy: 1, heavy: -1.5 }, from: { heavy: 2, fried: 2, junk: 2, comfort: 1, cheesy: 1 } },
  comfort: { fx: { comfort: 2, hot: 0.5 }, from: { light: 2, healthy: 2, cold: 1, fancy: 1 } },
  sweet: { fx: { sweet: 2 }, from: { salty: 2, spicy: 1, fried: 1, saucy: 1 } },
  salty: { fx: { salty: 2 }, from: { sweet: 2, light: 1 } },
  spicy: { fx: { spicy: 2 }, from: { creamy: 2, sweet: 1, light: 1, comfort: 1 } },
  fancy: { fx: { fancy: 2 }, from: { junk: 2, quick: 2, home: 1, fried: 1 } },
  quick: { fx: { quick: 2 }, from: { fancy: 2, home: 2, heavy: 1 } },
  cold: { fx: { cold: 2, hot: -1 }, from: { hot: 2, comfort: 1 } },
};
const DEFAULT = ["comfort", "sweet", "light"];

/** 3 nudge keys from the opposites of her answers (never one she already is: that would repeat). Pure, deterministic. */
export function nudgesFor(answers, questions = QUESTIONS) {
  const mine = new Map(cravingSummary(answers, questions, ALL).chips.map((c, i) => [c.tag, 3 - Math.min(2, i)]));
  const scored = Object.entries(NUDGES)
    .map(([k, n], i) => ({ k, i, v: Object.entries(n.from).reduce((s, [t, w]) => s + (mine.get(t) ?? 0) * w, 0) - (Object.keys(n.fx).some((t) => n.fx[t] > 0 && mine.has(t)) ? 99 : 0) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .map((x) => x.k);
  const free = (k) => !scored.includes(k) && !Object.keys(NUDGES[k].fx).some((t) => NUDGES[k].fx[t] > 0 && mine.has(t));
  for (const k of [...DEFAULT, ...Object.keys(NUDGES)]) if (scored.length < 3 && free(k)) scored.push(k);
  return scored.slice(0, 3);
}

/** The action a tap on a nudge records (self-contained, so undo and resume replay it exactly): {k:"r", d, x: weights, l: label, f: the shown ids}. */
export const refineAction = (key, shownIds) => ({ k: "r", d: key, x: NUDGES[key].fx, l: STR.refine.nudge[key], f: shownIds });
