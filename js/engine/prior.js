// Starting scores: ratings, recent meals (R2), time of day and season (R12).
import { jaccard } from "./similarity.js";

export const RATING_PRIOR = { 4: 2.5, 3: 1, 2: -0.8, 1: -8 };

export function priorFrom(foods, { ratings = {}, recent = [], now = new Date(), exp = {} } = {}) {
  const prior = {};
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
    prior[f.id] = s;
  }
  return prior;
}
