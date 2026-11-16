// Recap mood lines (lazy: owner send-recap screen).
import { monthKey } from "./wrapped.js";
export const MIN_MOOD = 3; // quizzes with the same feeling before a mood line shows
const top = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];

const feelOf = (a) => {
  const [q, i] = String(a).split(":");
  const n = Number(i);
  if (/^mood[123]$/.test(q) && n >= 0 && n <= 2) return n;
  if (q === "mood4") return n === 0 ? 0 : n === 4 ? 2 : null;
  return null;
};

export function moodMemory(history, month) {
  const es = (history ?? []).filter((e) => monthKey(e.at) === month);
  const by = {};
  for (const e of es) {
    if (!Array.isArray(e.ans) || !e.fn) continue;
    for (const s of new Set(e.ans.map(feelOf).filter((x) => x !== null))) {
      const g = (by[s] ??= { n: 0, foods: {} });
      g.n++;
      g.foods[e.fn] = (g.foods[e.fn] ?? 0) + 1;
    }
  }
  return Object.entries(by)
    .filter(([, g]) => g.n >= MIN_MOOD)
    .map(([s, g]) => [Number(s), ...top(g.foods), g.n])
    .filter((r) => r[2] >= 2)
    .sort((a, b) => b[2] - a[2] || a[0] - b[0])
    .slice(0, 2)
    .map(([s, name, c]) => [s, String(name).slice(0, 40), c]);
}

