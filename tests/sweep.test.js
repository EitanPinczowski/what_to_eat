import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { buildFoods } from "../js/engine/foods.js";
import { sweepOrder, splitExtras } from "../js/ui/guest/sweep.js";
import { sweepStatus } from "../js/ui/owner/send-sweep.js";
import { MemoryStore } from "../js/store/memory.js";

const foods = buildFoods(FOODS);

test("sweepOrder: unrated only by default, all on request, shuffled", () => {
  const o = sweepOrder(foods, { pizza: { r: 4 }, sushi: { r: 0 } }, "unrated", () => 0.5);
  assert.equal(o.length, foods.length - 1);
  assert.ok(!o.includes("pizza") && o.includes("sushi"));
  const all = sweepOrder(foods, { pizza: { r: 4 } }, "all");
  assert.equal(all.length, foods.length);
  assert.notDeepEqual(all, foods.map((f) => f.id));
});

test("splitExtras splits on commas and newlines, dedupes", () => {
  assert.deepEqual(splitExtras("מרק עוף, פסטה\nפסטה ,  "), ["מרק עוף", "פסטה"]);
  assert.deepEqual(splitExtras(""), []);
});

test("sweepStatus", () => {
  assert.equal(sweepStatus(null, "נגה"), "עוד לא נפתח");
  assert.equal(sweepStatus({ at: "x", i: 3, n: 40 }, "נגה"), "נגה דירגה 3 מתוך 40");
  assert.match(sweepStatus({ at: "x", finished: true }, "נגה"), /סיימה/);
});

test("rate fallback import adds extras to the inbox", async () => {
  const s = await new MemoryStore().ready();
  await s.importResult({ v: 1, t: "rate", id: "z", r: { bamba: 3 }, x: ["מרק", "מרק"] });
  assert.deepEqual(s.get().inbox, ["מרק"]);
  assert.equal(s.get().ratings.bamba.r, 3);
});
