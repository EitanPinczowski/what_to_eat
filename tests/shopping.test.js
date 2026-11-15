import { test } from "node:test";
import assert from "node:assert/strict";
import { COLLECTIONS } from "../js/store/store.js";
import { MemoryStore } from "../js/store/memory.js";

const ROOM = "shoproom000000000000000";

test("shopping is a store collection", () => {
  assert.ok(COLLECTIONS.includes("shopping"));
});

test("add, dedupe, tick, clear done", async () => {
  const s = await new MemoryStore(ROOM).ready();
  assert.equal(await s.addShopping(["4 ביצים", " 1 בצל ", "", "4 ביצים"], "שקשוקה"), 2);
  let list = s.shopping();
  assert.deepEqual(list.map((i) => i.text), ["4 ביצים", "1 בצל"]);
  assert.equal(list[0].done, false);
  assert.equal(list[0].recipe, "שקשוקה");
  assert.ok(list[0].addedAt);
  assert.equal(await s.addShopping(["1 בצל", "2 שיני שום"], "פסטה"), 1);
  assert.equal(await s.tickShopping(list[0].id), true);
  assert.equal(s.shopping().find((i) => i.id === list[0].id).done, true);
  assert.equal(await s.addShopping(["4 ביצים"], "חביתה"), 1); // a ticked item can be bought again
  assert.equal(await s.tickShopping(list[0].id, false), true);
  assert.equal(s.shopping().find((i) => i.id === list[0].id).done, false);
  assert.equal(await s.tickShopping("missing"), false);
  await s.tickShopping(list[1].id, true);
  assert.equal(await s.clearDoneShopping(), 1);
  list = s.shopping();
  assert.equal(list.length, 3);
  assert.ok(list.every((i) => !i.done));
});

test("two stores in the same room see the same list", async () => {
  const shared = { rooms: {} };
  const a = await new MemoryStore(ROOM, shared).ready();
  const b = await new MemoryStore(ROOM, shared).ready();
  await a.addShopping(["חלב"], "פנקייקים");
  assert.deepEqual(b.shopping().map((i) => i.text), ["חלב"]);
});
