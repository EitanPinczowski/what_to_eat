// Place picker (PLAN.md §5.5, §7.4; spec-loops-places-design.md §2.7).
// score = 10 if it serves the food | 2 × shared cuisine tags · + 0.8 × rating · −3 if visited this week
//         · −2 per price step above her budget. Closed-on-Shabbat places hide Fri evening → Sat evening.
import { CUISINE } from "../data/constants.js";

const WEEK = 7 * 864e5;

/** Friday 16:00 → Saturday 19:00 (local time). */
export function isShabbat(now = new Date()) {
  const d = now.getDay();
  const h = now.getHours();
  return (d === 5 && h >= 16) || (d === 6 && h < 19);
}

/**
 * @param {object[]} places  Place[] ({id, name, city, modes, foods, price, rating, visits, shabbat})
 * @param {Map<string,object>|object[]} foods  all foods (to read cuisine tags of what a place serves)
 * @param {{food?: object, mode?: string, city?: string, now?: Date, budget?: number|null}} q
 * @returns {{place, score, reason}[]} best first
 */
export function scorePlaces(places, foods, { food = null, mode = null, city = null, now = new Date(), budget = null } = {}) {
  const byId = foods instanceof Map ? foods : new Map(foods.map((f) => [f.id, f]));
  const want = new Set((food?.tags ?? []).filter((t) => CUISINE.includes(t)));
  const shabbat = isShabbat(now);
  const out = [];
  for (const p of places) {
    if (mode && mode !== "any" && mode !== "home" && !(p.modes ?? []).includes(mode)) continue;
    if (city && p.city && p.city !== city) continue;
    if (shabbat && p.shabbat) continue;
    let score = 0;
    let reason = "";
    if (food && (p.foods ?? []).includes(food.id)) {
      score = 10;
      reason = "serves";
    } else if (food) {
      const theirs = new Set((p.foods ?? []).flatMap((id) => byId.get(id)?.tags ?? []).filter((t) => CUISINE.includes(t)));
      const shared = [...want].filter((t) => theirs.has(t));
      if (!shared.length) continue;
      score = 2 * shared.length;
      reason = `style:${shared.join(",")}`;
    }
    score += 0.8 * (p.rating ?? 0);
    const lastVisit = Math.max(0, ...(p.visits ?? []).map((v) => +new Date(v) || 0));
    if (lastVisit && now - lastVisit < WEEK) score -= 3;
    if (budget && p.price > budget) score -= 2 * (p.price - budget);
    out.push({ place: p, score: Math.round(score * 10) / 10, reason });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Weighted random pick (weights = score, floored at 0.1). */
export function weightedPick(scored, rnd = Math.random) {
  if (!scored.length) return null;
  const w = scored.map((s) => Math.max(0.1, s.score));
  let x = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < scored.length; i++) if ((x -= w[i]) < 0) return scored[i];
  return scored.at(-1);
}

// Fallbacks when no saved place fits.
export const mapsUrl = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const recipeUrl = (food) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`מתכון ${food}`)}`;
export const woltUrl = (q) => `https://wolt.com/he/isr/search?q=${encodeURIComponent(q)}`;
export const tenbisUrl = (q) => `https://www.10bis.co.il/next/search?query=${encodeURIComponent(q)}`;
export const kioskUrl = () => mapsUrl("קיוסק");
