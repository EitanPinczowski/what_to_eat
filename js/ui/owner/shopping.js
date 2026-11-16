// Owner: recipe detail + the shared shopping list (a `shopping` collection in the room, so both phones see it).
import { STR } from "../../data/strings.js";
import { findRecipe } from "../../data/recipes.js";
import { render, html, raw, toast, saveFailed, topbar } from "../dom.js";

const S = STR.shop;

/** Shopping items grouped by recipe: [[recipe, items]], the ones with no recipe last (recipe ""). */
export function groupShopping(items) {
  const g = new Map();
  for (const i of items) g.set(i.recipe || "", [...(g.get(i.recipe || "") ?? []), i]);
  return [...g].sort(([a], [b]) => !a - !b);
}
const K = STR.picker;

/** Recipe options for the picker's cook mode: built-in recipe buttons, or search links. `r` = recipesFor(). */
export function recipeBlock(r, foodName) {
  if (r.recipes.length)
    return html`<section class="card stack" data-testid="recipes"><b>${K.recipesTitle(foodName)}</b><div class="sub">${K.recipesPick}</div>
      ${r.recipes.map((x) => raw(html`<button class="btn" data-on="recipeOpen" data-arg="${x.id}"><b>${x.title}</b> <span class="sub">${K.recipeMin(x.min)} · ${x.ing.length} ${S.ingTitle}</span></button>`))}</section>`;
  return html`<section class="card stack" data-testid="recipe-links"><b>${K.recipeLinksTitle}</b>
    ${r.links.map((l) => raw(html`<a class="btn" href="${l.url}" target="_blank" rel="noopener">🔎 ${l.title}</a>`))}</section>`;
}

export function shoppingViews({ root, store, stack, views, common, ctx }) {
  store.subscribe((what) => {
    if (what === "shopping" && ["shopping", "recipe"].includes(stack.top)) views[stack.top]();
  });

  views.recipe = () => {
    const r = findRecipe(ctx.recipeId);
    if (!r) return common.back();
    const have = new Set(store.shopping().filter((i) => !i.done).map((i) => i.text));
    const all = r.ing.every((t) => have.has(t));
    render(root, html`${raw(topbar(r.title))}
      <p class="sub">${K.recipeMin(r.min)}</p>
      <section class="card"><b>${S.ingTitle}</b><ul class="plain">${r.ing.map((t) => raw(html`<li>${t}</li>`))}</ul></section>
      <section class="card"><b>${S.stepsTitle}</b><ol>${r.steps.map((t) => raw(html`<li>${t}</li>`))}</ol></section>
      <button class="btn btn-ghost" data-on="go" data-arg="shopping">${S.openList}</button>
      <button class="btn btn-primary act" data-on="addAll" data-testid="add-shopping" ${all ? "disabled" : ""}>${S.add}</button>`, {
      ...common,
      addAll: () => {
        store.addShopping(r.ing, r.title).then((n) => toast(S.added(n))).catch(saveFailed);
      },
    });
  };

  views.shopping = () => {
    const items = store.shopping();
    const left = items.filter((i) => !i.done).length;
    const groups = groupShopping(items);
    render(root, html`${raw(topbar(S.title))}
      ${items.length ? raw(html`<p class="sub" data-testid="shop-left">${S.left(left)}</p>`) : raw(html`<p class="sub">${S.empty}</p>`)}
      ${groups.map(([r, is]) => raw(html`<section data-testid="shop-group"><h3 class="sub">${r || (groups.length > 1 ? S.other : "")}</h3>
        <ul class="foods shoplist">${is.map((i) => raw(html`<li><label class="row"><input type="checkbox" data-input="tick" data-arg="${i.id}" ${i.done ? "checked" : ""}>
          <span style="${i.done ? "text-decoration:line-through;opacity:.6" : ""}">${i.text}</span></label></li>`))}</ul></section>`))}
      ${items.some((i) => i.done) ? raw(html`<button class="btn btn-ghost" data-on="clear" data-testid="shop-clear">${S.clear}</button>`) : ""}`, {
      ...common,
      tick: (_v, _e, el) => store.tickShopping(el.dataset.arg, el.checked).catch(saveFailed),
      clear: () => store.clearDoneShopping().then((n) => toast(S.cleared(n))).catch(saveFailed),
    });
  };
}
