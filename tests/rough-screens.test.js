// Item 28: shopping grouped by recipe, brain grouped by category, place form + settings with collapsible extras.
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupShopping } from "../js/ui/owner/shopping.js";
import { groupFoods } from "../js/ui/owner/brain.js";
import { settingsViews } from "../js/ui/owner/settings.js";
import { placesViews } from "../js/ui/owner/places.js";
import { MemoryStore } from "../js/store/memory.js";
import { FOODS } from "../js/data/foods.js";
import { buildFoods } from "../js/engine/foods.js";
import { STR } from "../js/data/strings.js";
import { category } from "../js/ui/pics.js";

test("groupShopping: one group per recipe in first-seen order, loose items last", () => {
  const items = [{ id: 1, text: "a", recipe: "שקשוקה" }, { id: 2, text: "b" }, { id: 3, text: "c", recipe: "פסטה" }, { id: 4, text: "d", recipe: "שקשוקה" }];
  const g = groupShopping(items);
  assert.deepEqual(g.map(([r]) => r), ["שקשוקה", "פסטה", ""]);
  assert.deepEqual(g[0][1].map((i) => i.id), [1, 4]);
  assert.deepEqual(groupShopping([]), []);
});

test("groupFoods: by category in STR.cats order, empty groups left out, every food once", () => {
  const foods = buildFoods(FOODS, []);
  const g = groupFoods(foods);
  const order = Object.keys(STR.cats);
  assert.deepEqual(g.map(([c]) => c), order.filter((c) => g.some(([k]) => k === c)));
  assert.equal(g.reduce((n, [, l]) => n + l.length, 0), foods.length);
  for (const [c, l] of g) assert.ok(l.every((f) => category(f) === c));
});

function fakeRoot() {
  return { innerHTML: "", addEventListener() {}, contains: () => true, querySelector: () => null, querySelectorAll: () => [] };
}

test("settings: technical parts sit in a 'מתקדם' section that is collapsed by default", async () => {
  const store = new MemoryStore("room-1234567890123456789");
  await store.ready();
  const root = fakeRoot();
  const views = {};
  settingsViews({ root, store, views, common: {}, base: "https://x.test/", mode: "local" });
  views.settings();
  const h = root.innerHTML;
  const m = h.match(/<details data-k="adv"([^>]*)>([^]*)<\/details>/);
  assert.ok(m, "advanced section exists");
  assert.doesNotMatch(m[1], /\bopen\b/);
  assert.match(m[2], new RegExp(STR.settings.adv));
  for (const key of ["rejoin", "paste", "export", "restore", "rotate", "reset", "problems"]) assert.ok(m[2].includes(key) || m[2].includes(`data-testid="${key}"`), key);
  const outside = h.replace(m[0], "");
  for (const bad of ['data-on="rotate"', 'data-on="reset"', 'data-on="export"', 'data-submit="rejoin"']) assert.ok(!outside.includes(bad), bad);
  assert.ok(outside.includes('data-submit="save"') && outside.includes('data-testid="push"'));
});

test("place form: link, note, Shabbat and hours are behind 'עוד פרטים' (collapsed)", async () => {
  const store = new MemoryStore("room-1234567890123456789");
  await store.ready();
  const root = fakeRoot();
  const views = {};
  const ctx = { place: { name: "", city: "", modes: [], foods: [], cuisines: [], price: 2, rating: 3, link: "", note: "", shabbat: false, hours: [], visits: [] } };
  placesViews({ root, store, stack: { push() {}, back() {}, top: "placeForm" }, views, common: {}, ctx });
  views.placeForm();
  const h = root.innerHTML;
  const m = h.match(/<details data-k="more"([^>]*)>([^]*)<\/details>/);
  assert.ok(m && !/\bopen\b/.test(m[1]));
  assert.match(m[2], new RegExp(STR.places.more));
  for (const f of ['data-input="link"', 'data-input="note"', 'data-input="shabbat"', 'data-input="hour"']) assert.ok(m[2].includes(f) && !h.replace(m[0], "").includes(f), f);
  assert.ok(h.includes('data-input="name"') && h.includes('data-testid="cuisine-chips"'));
});
