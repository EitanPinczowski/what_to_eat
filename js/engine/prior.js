// Starting scores: ratings, recent meals (R2), time of day and season (R12).
import { jaccard } from "./similarity.js";
import { weatherBump } from "./weather.js";

export const RATING_PRIOR = { 4: 2.5, 3: 1, 2: -0.8, 1: -8 };

// Item 18: what she chose before at a similar time of day / kind of day, and what she turned down. Nudges only.
export const HALF_LIFE_DAYS = 60;
export const CTX_BOOST = 0.6; // per fresh choice in the same band and day kind
export const CTX_CAP = 1;
export const REJECT_PENALTY = 0.4; // per fresh rejection
export const REJECT_CAP = 1;
const DAY = 864e5;

/** morning 5-11 · noon 11-15 · afternoon 15-18 · evening 18-22 · night 22-5. */
export function dayBand(d) {
  const h = d.getHours();
  return h >= 5 && h < 11 ? "morning" : h >= 11 && h < 15 ? "noon" : h >= 15 && h < 18 ? "afternoon" : h >= 18 && h < 22 ? "evening" : "night";
}
/** Israel's weekend: Friday and Saturday. */
export const dayKind = (d) => (d.getDay() === 5 || d.getDay() === 6 ? "weekend" : "weekday");

/** Per food: {boost >= 0 from similar-context choices, pen >= 0 from rejections}, both decayed by age and capped. */
export function contextFrom(history, now) {
  const boost = {};
  const pen = {};
  const band = dayBand(now);
  const kind = dayKind(now);
  for (const h of history ?? []) {
    const at = new Date(h.at);
    const age = (now - at) / DAY;
    if (!(age >= -1)) continue; // bad or future date
    const w = 0.5 ** (Math.max(0, age) / HALF_LIFE_DAYS);
    if (h.f) {
      const ctx = (dayBand(at) === band ? 0.6 : 0) + (dayKind(at) === kind ? 0.4 : 0);
      if (dayBand(at) === band && dayKind(at) === kind) boost[h.f] = (boost[h.f] ?? 0) + CTX_BOOST * w;
      else if (ctx) boost[h.f] = (boost[h.f] ?? 0) + CTX_BOOST * w * ctx * 0.3; // a half match counts a little
    }
    for (const id of Array.isArray(h.rej) ? h.rej : []) pen[id] = (pen[id] ?? 0) + REJECT_PENALTY * w;
  }
  for (const k of Object.keys(boost)) boost[k] = Math.min(CTX_CAP, boost[k]);
  for (const k of Object.keys(pen)) pen[k] = Math.min(REJECT_CAP, pen[k]);
  return { boost, pen };
}

export function priorFrom(foods, { ratings = {}, recent = [], now = new Date(), exp = {}, weather = null, history = [] } = {}) {
  const prior = {};
  const ctx = contextFrom(history, now);
  const recentFoods = foods.filter((f) => recent.includes(f.id));
  const hour = now.getHours();
  const month = now.getMonth() + 1;
  const morning = hour >= 6 && hour < 11;
  const late = hour >= 22 || hour < 3;
  for (const f of foods) {
    let s = RATING_PRIOR[ratings[f.id]?.r ?? ratings[f.id]] ?? 0;
    if (recent.includes(f.id)) s -= 1.5;
    else if (recentFoods.length) s -= 0.8 * Math.max(...recentFoods.map((r) => jaccard(f.tags, r.tags)));
    if (f.tags.includes("breakfast")) s += morning ? 0.5 : -0.5;
    if (late && (f.tags[0] === "snack" || f.tags[0] === "dessert")) s += 0.5;
    if (f.season && !f.season.includes(month)) s -= 1.5;
    if (exp[f.id] && !ratings[f.id]?.r) s += exp[f.id]; // "how was it?" never overrides her own rating
    if (weather) s += weatherBump(f.tags, weather); // small, capped; null = unchanged
    s += (recent.includes(f.id) ? 0 : ctx.boost[f.id] ?? 0) - (ctx.pen[f.id] ?? 0); // just eaten: no favourite boost
    prior[f.id] = s;
  }
  return prior;
}
