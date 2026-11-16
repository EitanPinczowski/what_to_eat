// R1c-1 (2026-11-17): food categories are food types (cuisines); Asian is split; sweets and snacks get their origin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { buildFoods } from "../js/engine/foods.js";
import { CUISINES, FOOD_CUISINES, KINDS, expandCuisines, mainCuisine } from "../js/data/cuisines.js";
import { STR } from "../js/data/strings.js";
import { catLabel } from "../js/ui/pics.js";
import { pickPlaces } from "../js/places/picker.js";

const foods = buildFoods(FOODS);
const byId = new Map(foods.map((f) => [f.id, f]));
const now = new Date(2026, 10, 17, 13, 0); // a Tuesday noon
const P = (id, o) => ({ id, name: id, city: "", modes: ["sit"], foods: [], price: 2, rating: 3, shabbat: false, hours: [], visits: [], ...o });

test("every seed food has a main cuisine from the food-type list, listed first", () => {
  for (const f of foods) {
    assert.ok(FOOD_CUISINES.includes(f.cuisine[0]), `${f.id}: ${f.cuisine}`);
    assert.equal(mainCuisine(f), f.cuisine[0]);
    for (const c of f.cuisine) assert.ok(CUISINES.includes(c), `${f.id}: unknown ${c}`);
  }
});

test("the label under a food is its food type; no dessert is labelled street food", () => {
  for (const f of foods) {
    assert.equal(catLabel(f), STR.cuisine.options[f.cuisine[0]][1], f.id);
    if (f.tags.includes("dessert")) assert.notEqual(catLabel(f), STR.cats.street, f.id);
  }
  assert.equal(catLabel(byId.get("pad_thai")), "תאילנדי");
  assert.equal(catLabel(byId.get("tiramisu")), "איטלקי");
  assert.equal(catLabel(byId.get("churros")), "מקסיקני");
  assert.equal(catLabel({ id: "x", tags: ["meal", "asian"], cuisine: [] }), STR.cats.meal); // custom food: old tag rule
});

test("every category has Hebrew words for its chip and for the Tabit/Ontopo search", () => {
  for (const c of CUISINES) {
    assert.ok(STR.cuisine.options[c]?.[1], c);
    assert.ok(STR.picker.search[c], c);
  }
  assert.deepEqual(KINDS, ["sweet", "snack"]);
});

test("an old place saved as asian still matches sushi and pad thai; the alias does not rewrite it", () => {
  assert.deepEqual(expandCuisines(["italian", "asian"]), ["italian", "japanese", "thai", "chinese", "indian"]);
  const old = P("sushi_bar", { cuisines: ["asian"] });
  for (const id of ["sushi", "pad_thai", "butter_chicken"]) {
    const { list } = pickPlaces([old, P("trattoria", { cuisines: ["italian"] })], foods, { food: byId.get(id), now });
    assert.deepEqual(list.map((x) => x.place.id), ["sushi_bar"], id);
  }
  assert.deepEqual(old.cuisines, ["asian"]);
  assert.deepEqual(pickPlaces([old], foods, { cuisine: "japanese", now }).list.map((x) => x.place.id), ["sushi_bar"]);
});

test("every picker chip finds foods; thin food types are known (R1c-3 adds foods)", () => {
  const count = (c) => foods.filter((f) => f.cuisine.includes(c)).length;
  for (const c of CUISINES) assert.ok(count(c) >= 1, c);
  const thin = FOOD_CUISINES.filter((c) => count(c) < 4);
  assert.deepEqual(thin, ["thai", "chinese", "indian"]); // when R1c-3 lands, this list must be empty
});
