// Food photos (img/foods/{id}.jpg + credits.json from tools/fetch-photos.mjs). Emoji is the fallback.
import { html, raw } from "./dom.js";
import { STR } from "../data/strings.js";

let have = new Set();

export async function loadPics(f = globalThis.fetch) {
  try {
    const r = await f("img/foods/credits.json", { cache: "no-cache" });
    have = new Set(r.ok ? Object.keys(await r.json()) : []);
  } catch {
    have = new Set();
  }
  return have;
}

export const setPics = (ids) => (have = new Set(ids));

/** Photo when we have one, emoji otherwise. size: "big" (160) or "sm" (thumb). */
export function pic(food, size = "big") {
  const px = size === "sm" ? 64 : 160;
  if (food && have.has(food.id)) return html`<img class="pic" src="img/foods/${food.id}.jpg" alt="" width="${px}" height="${px}" loading="lazy" data-size="${size}">`;
  return html`${food?.emoji ?? "🍽️"}`;
}

/** Category key for the small label under a food (design revision 1.6). Order matters. */
export function category(food) {
  const t = new Set(food?.tags ?? []);
  if (t.has("breakfast")) return "breakfast";
  if (t.has("street")) return "street";
  if (t.has("dessert") || (t.has("snack") && t.has("sweet"))) return "sweet";
  if (t.has("snack")) return "snack";
  if (t.has("cook") || t.has("home")) return "home";
  if (t.has("healthy") || t.has("fruit")) return "fresh";
  return "meal";
}

export const catLabel = (food) => STR.cats[category(food)];

/** Photo/emoji + name + category label, for buttons and lists. */
export function foodLabel(food, size = "sm") {
  const p = food && have.has(food.id) ? pic(food, size) : html`<span class="em">${food.emoji ?? "🍽️"}</span>`;
  return html`${raw(p)}<span class="fname">${food.name}</span><small class="cat">${catLabel(food)}</small>`;
}

/** True when a photo file exists for this food id. */
export const hasPic = (id) => have.has(id);
