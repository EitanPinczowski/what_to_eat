// Food photos (img/foods/{id}.jpg + credits.json from tools/fetch-photos.mjs). Emoji is the fallback.
import { html } from "./dom.js";

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

/** Photo when we have one, emoji otherwise. */
export function pic(food) {
  if (food && have.has(food.id)) return html`<img class="pic" src="img/foods/${food.id}.jpg" alt="" width="160" height="160" loading="lazy">`;
  return html`${food?.emoji ?? "🍽️"}`;
}
