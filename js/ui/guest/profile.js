// Her profile (W4a): "never for me" and her hearts. Lazy: loaded only from the small link on her welcome screen.
// Reads and writes the room doc through the Store (room.never, room.fav). The big-text toggle lives here too (localStorage wte-big-text).
import { FOODS } from "../../data/foods.js";
import { STR } from "../../data/strings.js";
import { buildFoods } from "../../engine/foods.js";
import { cleanList, toggle, NEVER_DEFAULT } from "../../engine/exclude.js";
import { render, html, raw } from "../dom.js";
import { BIG_KEY, bigText } from "./quiz.js";

const P = STR.profile;

/** Ingredient keys that appear in the food list, with her words for them. */
const ingredientKeys = (foods) => [...new Set(foods.flatMap((f) => f.has ?? []))].filter((k) => P.ing[k]);

/** What an entry is called on screen: an ingredient word, a food name, or the raw text. */
export const entryName = (key, foods) => P.ing[key] ?? foods.find((f) => f.id === key)?.name ?? key;

/** openProfile(root, store, {onBack}): draws the screen; every change is saved through store.update. */
export function openProfile(root, store, { onBack } = {}) {
  const read = () => store.get();
  const foods = buildFoods(FOODS, read().custom ?? []);
  const save = (key, list) => store.update((r) => (r[key] = cleanList(list))).catch(() => {}); // harmless: the screen shows the local state
  const draw = () => {
    const room = read();
    const never = cleanList(room.never ?? NEVER_DEFAULT);
    const fav = cleanList(room.fav ?? []);
    const left = [
      ...ingredientKeys(foods).filter((k) => !never.includes(k)).map((k) => [k, P.ing[k], P.ingredients]),
      ...foods.filter((f) => !never.includes(f.id)).map((f) => [f.id, f.name, P.foods]),
    ];
    const chip = (key, n, attr) => html`<button class="chip" data-on="${attr}" data-arg="${key}" title="${P.remove(n)}">${n} ✕</button>`;
    render(root, html`<div class="qbar"><button class="btn back" data-on="back" aria-label="${P.back}">→</button></div>
      <section class="card stack" data-testid="profile">
        <h2 class="title">${P.title}</h2>
        <p class="sub">${P.sub}</p>
        <h3 class="sub">${P.never}</h3>
        <div class="chips" data-testid="never-list">${never.length ? never.map((k) => raw(chip(k, entryName(k, foods), "unnever"))) : raw(html`<span class="sub">${P.none}</span>`)}</div>
        <p class="sub">${P.add}</p>
        <select name="pick" data-testid="never-pick" aria-label="${P.add}"><option value="">${P.pickPlaceholder}</option>${left.map(([k, n]) => raw(html`<option value="${k}">${n}</option>`))}</select>
        <button class="btn" data-on="addNever" data-testid="never-add">${P.addBtn}</button>
        <h3 class="sub">${P.big}</h3>
        <button class="btn" data-on="big" data-testid="big-text" aria-pressed="${bigText()}">${P.bigSub}</button>
        <h3 class="sub">${P.favs}</h3>
        <div class="chips" data-testid="fav-list">${fav.length ? fav.map((k) => raw(chip(k, entryName(k, foods), "unfav"))) : raw(html`<span class="sub">${P.favNone}</span>`)}</div>
      </section>`, {
      back: () => onBack?.(),
      qback: () => onBack?.(),
      big: () => {
        try { globalThis.localStorage?.setItem(BIG_KEY, bigText() ? "0" : "1"); } catch { /* harmless: it just will not be remembered */ }
        root.classList?.toggle("big-text", bigText());
        draw();
      },
      unnever: (k) => (save("never", never.filter((x) => x !== k)), draw()),
      unfav: (k) => (save("fav", fav.filter((x) => x !== k)), draw()),
      addNever: () => {
        const v = root.querySelector("[data-testid=never-pick]")?.value;
        if (v) save("never", [...never, v]);
        draw();
      },
    });
  };
  draw();
}

/** The heart on a result: toggles one food in room.fav through the Store; resolves to the new on/off. */
export async function toggleFav(store, id) {
  let on = false;
  await store.update((r) => {
    r.fav = toggle(r.fav ?? [], id);
    on = r.fav.includes(id);
  });
  try { globalThis.localStorage?.setItem("wte-fav", JSON.stringify(store.get().fav)); } catch { /* harmless: the recap just shows no hearts */ }
  return on;
}
