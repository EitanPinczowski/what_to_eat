// "Like last time?": a past meal she rated well (howItWas 👍) on the same weekday within ±2 h of now. Pure; loaded lazily by the welcome screen.
import { isExcluded } from "./exclude.js";

const WINDOW_MIN = 120;
const WEEK = 7 * 864e5;
const DAY_MIN = 1440;

/** The best match as {id, f, at, day} or null. history: [{f, at, how}]; foods: [{id, has}] for the never list. Newest match wins. Not today's own meal. */
export function likeLastTime(history, now = new Date(), { never = [], foods = [] } = {}) {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best = null;
  for (const h of history ?? []) {
    if (!h?.f || !(h.how > 0)) continue;
    const t = new Date(h.at);
    if (Number.isNaN(+t) || t.getDay() !== now.getDay()) continue;
    if (now - t < WEEK - 864e5 / 2 && now - t >= 0 && t.toDateString() === now.toDateString()) continue; // today's meal is not "last time"
    const m = t.getHours() * 60 + t.getMinutes();
    const gap = Math.min(Math.abs(m - nowMin), DAY_MIN - Math.abs(m - nowMin));
    if (gap > WINDOW_MIN) continue;
    const food = byId.get(h.f);
    if (foods.length && !food) continue; // a food that no longer exists
    if (isExcluded(food ?? { id: h.f }, never)) continue;
    if (!best || t > best.t) best = { t, id: h.id, f: h.f, at: h.at };
  }
  return best ? { id: best.id, f: best.f, at: best.at, day: best.t.getDay() } : null;
}
