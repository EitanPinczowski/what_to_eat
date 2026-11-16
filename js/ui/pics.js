// Food art: Fluent Emoji (3D, MIT) as img/emoji/<id>.webp, listed in js/data/emoji-art.json. Unlisted or failing: the native emoji (onerror).
import { html, raw } from "./dom.js";
import { STR } from "../data/strings.js";
import { mainCuisine } from "../data/cuisines.js";

let have = new Set();

/** js/data/emoji-art.json (id -> true) is fetched, not imported, so it stays out of the start-up graph and the shell. Failure: native emoji everywhere. */
export const loadPics = (f = globalThis.fetch) => f("js/data/emoji-art.json").then((r) => r.json()).then((m) => setPics(Object.keys(m)), () => setPics([]));
export const setPics = (ids) => (have = new Set(ids));

export const artSrc = (id) => `img/emoji/${id}.webp`;

export function pic(food, size = "big") {
  const px = size === "sm" ? 40 : 112, e = food?.emoji ?? "🍽️";
  if (!food || !have.has(food.id)) return html`${e}`;
  return html`<img class="pic" src="${artSrc(food.id)}" alt="${food.name ?? ""}" data-emoji="${e}" draggable="false" width="${px}" height="${px}" loading="lazy" decoding="async" data-size="${size}" onerror="this.outerHTML=this.dataset.emoji">`;
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

// Label under a food: its food type (R1c-1), else the tag kind.
export const catLabel = (food) => {
  const c = mainCuisine(food);
  return c ? STR.cuisine.options[c][1] : STR.cats[category(food)];
};

/** Illustration/emoji + name + category label, for buttons and lists. */
export function foodLabel(food, size = "sm") {
  const p = food && have.has(food.id) ? pic(food, size) : html`<span class="em">${food.emoji ?? "🍽️"}</span>`;
  return html`${raw(p)}<span class="fname">${food.name}</span><small class="cat">${catLabel(food)}</small>`;
}

/** True when an illustration is listed for this food id. */
export const hasPic = (id) => have.has(id);

// Answer art (quiz answer emojis): img/emoji/q-<codepoints>.webp, listed in js/data/emoji-q.json. Not in the shell; the runtime emoji cache keeps them. Missing or failing: the native emoji.
let qHave = new Set();
export const loadQPics = (f = globalThis.fetch) => f("js/data/emoji-q.json").then((r) => r.json()).then((l) => setQPics(l), () => setQPics([]));
export const setQPics = (keys) => (qHave = new Set(keys));
export const cpKey = (e) => [...e.replace(/️/g, "")].map((c) => c.codePointAt(0).toString(16)).join("-");
export const qPic = (e) => (qHave.has(cpKey(e)) ? html`<img class="qpic" src="img/emoji/q-${cpKey(e)}.webp" alt="" data-emoji="${e}" draggable="false" width="40" height="40" loading="lazy" decoding="async" onerror="this.outerHTML=this.dataset.emoji">` : html`${e}`);
