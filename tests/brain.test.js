import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { buildFoods } from "../js/engine/foods.js";
import { ratingStats, filterFoods, makeCustomFood } from "../js/ui/owner/brain.js";

const foods = buildFoods(FOODS);

test("ratingStats counts every food once", () => {
  const st = ratingStats(foods, { pizza: { r: 4 }, sushi: { r: 1 }, bamba: { r: 0 } });
  assert.equal(st[4], 1);
  assert.equal(st[1], 1);
  assert.equal(st[0], foods.length - 2);
});

test("filterFoods by text (name or tag label) and rating", () => {
  assert.deepEqual(filterFoods(foods, {}, { q: "פיצה" }).map((f) => f.id), ["pizza"]);
  assert.ok(filterFoods(foods, {}, { q: "יפני" }).some((f) => f.id === "sushi"));
  assert.deepEqual(filterFoods(foods, { pizza: { r: 4 } }, { r: "4" }).map((f) => f.id), ["pizza"]);
  assert.equal(filterFoods(foods, {}, { r: "0" }).length, foods.length);
});

test("makeCustomFood validates and puts the kind first", () => {
  assert.equal(makeCustomFood({ name: "  " }), null);
  const f = makeCustomFood({ name: "מרק של סבתא", emoji: "", kind: "meal", tags: ["hot", "meal", "bogus", "hot"] });
  assert.match(f.id, /^c_[a-z0-9]{8}$/);
  assert.equal(f.emoji, "🍽️");
  assert.deepEqual(f.tags, ["meal", "hot"]);
  assert.deepEqual(makeCustomFood({ name: "x", kind: "nope" }).tags, ["meal"]);
});
