// Owner: recipe detail + the shared shopping list (a `shopping` collection in the room, so both phones see it).
import { STR } from "../../data/strings.js";
import { findRecipe } from "../../data/recipes.js";
import { render, html, raw, toast, saveFailed } from "../dom.js";

const S = STR.shop;
const K = STR.picker;

/** Recipe options for the picker's cook mode: built-in recipe buttons, or search links. `r` = recipesFor(). */
export function recipeBlock(r, foodName) {
  if (r.recipes.length)
    return html`<section class="card stack" data-testid="recipes"><b>${K.recipesTitle(foodName)}</b><div class="sub">${K.recipesPick}</div>
      ${r.recipes.map((x) => raw(html`<button class="btn" data-on="recipeOpen" data-arg="${x.id}"><b>${x.title}</b> <span class="sub">${K.recipeMin(x.min)} · ${x.ing.length} ${S.ingTitle}</span></button>`))}</section>`;
  return html`<section class="card stack" data-testid="recipe-links"><b>${K.recipeLinksTitle}</b>
    ${r.links.map((l) => raw(html`<a class="btn" href="${l.url}" target="_blank" rel="noopener">🔎 ${l.title}</a>`))}</section>`;
}

export function shoppingViews({ root, store, stack, views, back, common, ctx }) {
  store.subscribe((what) => {
    if (what === "shopping" && ["shopping", "recipe"].includes(stack.top)) views[stack.top]();
  });

  views.recipe = () => {
    const r = findRecipe(ctx.recipeId);
    if (!r) return common.back();
    const have = new Set(store.shopping().filter((i) => !i.done).map((i) => i.text));
    const all = r.ing.every((t) => have.has(t));
    render(root, html`${raw(back)}
      <h2 class="q">${r.title}</h2>
      <p class="sub">${K.recipeMin(r.min)}</p>
      <section class="card"><b>${S.ingTitle}</b><ul class="plain">${r.ing.map((t) => raw(html`<li>${t}</li>`))}</ul></section>
      <section class="card"><b>${S.stepsTitle}</b><ol>${r.steps.map((t) => raw(html`<li>${t}</li>`))}</ol></section>
      <button class="btn btn-primary" data-on="addAll" data-testid="add-shopping" ${all ? "disabled" : ""}>${S.add}</button>
      <button class="btn btn-ghost" data-on="go" data-arg="shopping">${S.openList}</button>`, {
      ...common,
      addAll: () => {
        store.addShopping(r.ing, r.title).then((n) => toast(S.added(n))).catch(saveFailed);
      },
    });
  };

  views.shopping = () => {
    const items = store.shopping();
    const left = items.filter((i) => !i.done).length;
    render(root, html`${raw(back)}
      <h2 class="q">${S.title}</h2>
      ${items.length ? raw(html`<p class="sub" data-testid="shop-left">${S.left(left)}</p>`) : raw(html`<p class="sub">${S.empty}</p>`)}
      <ul class="shoplist">${items.map((i) => raw(html`<li><label class="row"><input type="checkbox" data-input="tick" data-arg="${i.id}" ${i.done ? "checked" : ""}>
        <span style="${i.done ? "text-decoration:line-through;opacity:.6" : ""}">${i.text}</span>${i.recipe ? raw(html` <span class="sub">${S.fromRecipe(i.recipe)}</span>`) : ""}</label></li>`))}</ul>
      ${items.some((i) => i.done) ? raw(html`<button class="btn btn-ghost" data-on="clear" data-testid="shop-clear">${S.clear}</button>`) : ""}`, {
      ...common,
      tick: (_v, _e, el) => store.tickShopping(el.dataset.arg, el.checked).catch(saveFailed),
      clear: () => store.clearDoneShopping().then((n) => toast(S.cleared(n))).catch(saveFailed),
    });
  };
}
