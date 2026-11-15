import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { RECIPES, recipesFor, recipeLinks, findRecipe } from "../js/data/recipes.js";

test("built-in recipes belong to real foods and are well formed", () => {
  const ids = new Set(FOODS.map((f) => f[0]));
  const seen = new Set();
  for (const [food, list] of Object.entries(RECIPES)) {
    assert.ok(ids.has(food), `unknown food ${food}`);
    assert.ok(list.length >= 2 && list.length <= 3, `${food} needs 2-3 recipes`);
    for (const r of list) {
      assert.ok(!seen.has(r.id), `duplicate id ${r.id}`);
      seen.add(r.id);
      assert.ok(r.title && r.min > 0);
      assert.ok(r.ing.length >= 4 && r.ing.length <= 10, `${r.id} ingredients`);
      assert.ok(r.steps.length >= 3 && r.steps.length <= 6, `${r.id} steps`);
      for (const t of [...r.ing, ...r.steps]) assert.ok(t.length <= 120, `${r.id} line too long`);
    }
  }
});

test("recipesFor returns built-in recipes, else 3 search links", () => {
  const a = recipesFor("shakshuka", "שקשוקה");
  assert.ok(a.recipes.length >= 2);
  assert.equal(a.links.length, 0);
  assert.equal(findRecipe(a.recipes[0].id).title, a.recipes[0].title);
  const b = recipesFor("sushi", "סושי");
  assert.equal(b.recipes.length, 0);
  assert.equal(b.links.length, 3);
  for (const l of b.links) assert.match(l.url, /^https:\/\/.+%D7%9E%D7%AA%D7%9B%D7%95%D7%9F|^https:\/\/.+q=/);
  assert.equal(recipesFor(null, "").links.length, 3);
  assert.equal(findRecipe("nope"), null);
  assert.ok(recipeLinks("x").every((l) => decodeURIComponent(l.url).includes("מתכון x")));
});
