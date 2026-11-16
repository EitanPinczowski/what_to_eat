// Food photos: img/foods/<id>-160|400.webp listed in js/data/photos.js. Unlisted or failing: emoji (onerror).
import { html, raw } from "./dom.js";
import { STR } from "../data/strings.js";

let have = new Set();

/** js/data/photos.json (id -> true) is fetched, not imported, so it stays out of the start-up graph and the shell. Failure: emoji everywhere. */
export const loadPics = (f = globalThis.fetch) => f("js/data/photos.json").then((r) => r.json()).then((m) => setPics(Object.keys(m)), () => setPics([]));
export const setPics = (ids) => (have = new Set(ids));

export const photoSrc = (id, px = 400) => `img/foods/${id}-${px}.webp`;

export function pic(food, size = "big") {
  const px = size === "sm" ? 64 : 160, e = food?.emoji ?? "🍽️";
  if (!food || !have.has(food.id)) return html`${e}`;
  const [a, b] = [160, 400].map((n) => photoSrc(food.id, n));
  return html`<img class="pic" src="${a}" srcset="${a} 160w, ${b} 400w" sizes="${px}px" alt="${food.name ?? ""}" data-emoji="${e}" draggable="false" width="${px}" height="${px}" loading="lazy" decoding="async" data-size="${size}" onerror="this.outerHTML=this.dataset.emoji">`;
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

/** True when a photo is listed for this food id. */
export const hasPic = (id) => have.has(id);
