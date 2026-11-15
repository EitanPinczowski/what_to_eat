// Pure weather -> small prior bump. Weather arrives as a parameter ({temp, rain}); nothing is fetched here.
export const WEATHER_CAP = 0.6;
export const COLD_C = 14;
export const HOT_C = 30;

/** "cold" | "hot" | "rain" | null from {temp (C), rain (mm or bool)}. Garbage in -> null. */
export function weatherKind(w) {
  if (!w || typeof w !== "object") return null;
  const temp = Number(w.temp);
  if (Number.isFinite(temp) && temp <= COLD_C) return "cold";
  if (w.rain === true || Number(w.rain) > 0.2) return "rain";
  if (Number.isFinite(temp) && temp >= HOT_C) return "hot";
  return null;
}

/** Small bump for one food's tags; capped at WEATHER_CAP. */
export function weatherBump(tags, w) {
  const kind = weatherKind(w);
  if (!kind) return 0;
  const has = (t) => tags.includes(t);
  let s = 0;
  if (kind === "hot") {
    if (has("cold")) s += 0.25;
    if (has("light")) s += 0.2;
    if (has("healthy")) s += 0.1;
    if (has("fruit")) s += 0.1;
    if (has("dessert") && has("cold") && has("creamy")) s += 0.2; // ice cream
    if (has("heavy")) s -= 0.1;
  } else {
    if (has("comfort")) s += 0.35;
    if (has("hot")) s += 0.15;
    if (has("saucy")) s += 0.1; // soups and stews
  }
  return Math.max(-WEATHER_CAP, Math.min(WEATHER_CAP, s));
}
