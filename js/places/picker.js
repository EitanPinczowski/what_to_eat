// Place picker (PLAN.md §5.5, §7.4; spec-loops-places-design.md §2.7).
// score = 10 if it serves the food | 2 × shared cuisine tags · + 0.8 × rating · −3 if visited this week
import { CUISINE } from "../data/constants.js";
import { placeCuisines } from "./cuisine.js";
import { STR } from "../data/strings.js";

const WEEK = 7 * 864e5;
export const CLOSING_SOON_MIN = 45;
const DAY_MIN = 1440;
export const NOVEL_BONUS = 3; // "something new" toggle: bonus for places with no visits

const toMin = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function openStatus(place, now = new Date()) {
  const ranges = (place?.hours ?? []).map((r) => ({ d: Number(r?.d), o: toMin(r?.o), c: toMin(r?.c) })).filter((r) => r.d >= 0 && r.d <= 6 && r.o !== null && r.c !== null);
  if (!ranges.length) return { open: true, closesIn: null };
  const t = now.getDay() * DAY_MIN + now.getHours() * 60 + now.getMinutes();
  const week = 7 * DAY_MIN;
  for (const r of ranges) {
    const start = r.d * DAY_MIN + r.o;
    const end = r.d * DAY_MIN + r.c + (r.c <= r.o ? DAY_MIN : 0);
    for (const shift of [0, week]) {
      const left = end - (t + shift);
      if (t + shift >= start && left > 0) return { open: true, closesIn: left };
    }
  }
  return { open: false, closesIn: null };
}

/** Friday 16:00 → Saturday 19:00 (local time). */
export function isShabbat(now = new Date()) {
  const d = now.getDay();
  const h = now.getHours();
  return (d === 5 && h >= 16) || (d === 6 && h < 19);
}

export function scorePlaces(places, foods, { food = null, mode = null, city = null, now = new Date(), budget = null, novel = false, byCuisine = false, cuisine = null, all = false } = {}) {
  const byId = foods instanceof Map ? foods : new Map(foods.map((f) => [f.id, f]));
  const want = new Set((food?.tags ?? []).filter((t) => CUISINE.includes(t)));
  const shabbat = isShabbat(now);
  const wantC = cuisine ? [cuisine] : byCuisine ? (food?.cuisine ?? []) : [];
  const out = [];
  for (const p of places) {
    if (mode && mode !== "any" && mode !== "home" && !(p.modes ?? []).includes(mode)) continue;
    if (city && p.city && p.city !== city) continue;
    if (shabbat && p.shabbat) continue;
    const hrs = openStatus(p, now);
    if (!hrs.open) continue;
    let score = 0;
    let reason = "";
    const isNew = novel && !(p.visits ?? []).length;
    const sharedC = wantC.length ? placeCuisines(p, byId).filter((c) => wantC.includes(c)) : null;
    if (sharedC && !sharedC.length && !(isNew && !(p.foods ?? []).length)) continue; // category filter: only places of the result's cuisine
    if (food && isNew && !(p.foods ?? []).length) {
      reason = "new"; // a "want to try" place with no foods yet stays eligible
    } else if (food && (p.foods ?? []).includes(food.id)) {
      score = 10;
      reason = "serves";
    } else if (sharedC) {
      score = 2 * sharedC.length;
      reason = `cuisine:${sharedC.join(",")}`;
    } else if (food && !all) {
      const theirs = new Set((p.foods ?? []).flatMap((id) => byId.get(id)?.tags ?? []).filter((t) => CUISINE.includes(t)));
      const shared = [...want].filter((t) => theirs.has(t));
      if (!shared.length) continue;
      score = 2 * shared.length;
      reason = `style:${shared.join(",")}`;
    }
    score += 0.8 * (p.rating ?? 0);
    if (isNew) score += NOVEL_BONUS;
    if (isNew && !reason) reason = "new";
    const lastVisit = Math.max(0, ...(p.visits ?? []).map((v) => +new Date(v) || 0));
    if (lastVisit && now - lastVisit < WEEK) score -= 3;
    if (budget && p.price > budget) score -= 2 * (p.price - budget);
    out.push({ place: p, score: Math.round(score * 10) / 10, reason, ...(hrs.closesIn !== null && hrs.closesIn <= CLOSING_SOON_MIN ? { closesIn: hrs.closesIn } : {}) });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function pickPlaces(places, foods, q = {}) {
  if (q.cuisine !== undefined) return { list: scorePlaces(places, foods, q.cuisine ? q : { ...q, all: true }), noneOfKind: false };
  const hasCuisine = (q.food?.cuisine ?? []).length > 0;
  const list = scorePlaces(places, foods, { ...q, byCuisine: true });
  if (list.length || !hasCuisine) return { list, noneOfKind: false };
  return { list: scorePlaces(places, foods, q), noneOfKind: true };
}

/** What to type into Wolt / 10bis / Maps for a category (words in strings.js). */
export const cuisineSearch = (c) => STR.picker.search[c] ?? "";

/** Weighted random pick (weights = score, floored at 0.1). */
export function weightedPick(scored, rnd = Math.random) {
  if (!scored.length) return null;
  const w = scored.map((s) => Math.max(0.1, s.score));
  let x = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < scored.length; i++) if ((x -= w[i]) < 0) return scored[i];
  return scored.at(-1);
}

export const mapsUrl = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const recipeUrl = (food) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`מתכון ${food}`)}`;
export const woltUrl = (q) => `https://wolt.com/he/isr/search?q=${encodeURIComponent(q)}`;
export const tenbisUrl = (q) => `https://www.10bis.co.il/next/search?query=${encodeURIComponent(q)}`;
const MAP_LINK = /^https?:\/\/((www\.|maps\.)?google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i;
const WAZE_LINK = /^https?:\/\/(www\.)?(waze\.com|ul\.waze\.com)\//i;

/** Navigation links for a chosen place (plain URLs, no API). A saved Google Maps / Waze link is used as is for that app; otherwise "name + city" is searched. */
export function navLinks(place) {
  const q = [place?.name, place?.city].filter(Boolean).join(" ").trim();
  const link = String(place?.link ?? "").trim();
  const enc = encodeURIComponent(q);
  return {
    waze: WAZE_LINK.test(link) ? link : `https://waze.com/ul?q=${enc}&navigate=yes`,
    maps: MAP_LINK.test(link) ? link : `https://www.google.com/maps/dir/?api=1&destination=${enc}`,
  };
}
export const kioskUrl = () => mapsUrl("קיוסק");
