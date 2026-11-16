// Accuracy stats of the owner's history screen (kept out of learn.js: that file is in the start-up budget).
import { hitFrom, statsRank } from "./learn.js";

/** Accuracy stats from history entries with `stats` ({hit, steps, guesses, skips}). */
export function statsFrom(entries) {
  const st = entries.map((e) => e.stats).filter(Boolean);
  if (!st.length) return null;
  const skips = {};
  for (const s of st) for (const q of s.skips ?? []) skips[q] = (skips[q] ?? 0) + 1;
  const worst = Object.entries(skips).sort((a, b) => b[1] - a[1])[0];
  return {
    n: st.length,
    hitRate: st.filter((s) => hitFrom(statsRank(s)).hit).length / st.length,
    avgSteps: st.reduce((a, s) => a + (s.steps ?? 0), 0) / st.length,
    confusing: worst ? worst[0] : null,
  };
}

