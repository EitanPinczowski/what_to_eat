// "Rotate key": the data is copied to a new room, the old room is blanked and marked moved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../js/store/memory.js";
import { moveToNewRoom } from "../js/ui/owner/settings.js";
import { ROOM_KEY } from "../js/store/open.js";

const mem = () => ({ o: {}, getItem(k) { return this.o[k] ?? null; }, setItem(k, v) { this.o[k] = v; } });

test("rotate: copies, switches, blanks the old room and marks it moved", async () => {
  const shared = { rooms: {} };
  const old = await new MemoryStore("oldroom00000000000000000", shared).ready();
  await old.update((db) => (db.ratings.pizza = { r: 4 }));
  await old.put("history", "h1", { at: "2026-01-01", fn: "פיצה" });
  await old.put("places", "p1", { name: "x" });
  await old.put("feedback", "f1", { text: "secret feedback", at: "2026-01-01" });
  const storage = mem();
  const id = await moveToNewRoom(old, { storage, open: (rid) => new MemoryStore(rid, shared).ready() });
  assert.equal(storage.o[ROOM_KEY], id);
  const fresh = await new MemoryStore(id, shared).ready();
  assert.equal(fresh.get().ratings.pizza.r, 4);
  assert.equal(fresh.doc("history", "h1").fn, "פיצה");
  assert.equal(fresh.moved, false);
  // A client opening the old link now sees the tombstone, no data.
  const reopened = await new MemoryStore("oldroom00000000000000000", shared).ready();
  assert.equal(reopened.moved, true);
  assert.deepEqual(reopened.get().ratings, {});
  assert.equal(reopened.list("history").length, 0);
  assert.equal(reopened.list("places").length, 0);
  assert.equal(reopened.doc("feedback", "f1").text, undefined); // cannot be deleted by the rules: overwritten
  assert.equal(reopened.doc("feedback", "f1").moved, true);
});

test("rotate: no server ack in time throws a timeout and switches nothing", async () => {
  const shared = { rooms: {} };
  const old = await new MemoryStore("oldroom00000000000000000", shared).ready();
  const storage = mem();
  storage.setItem(ROOM_KEY, "oldroom00000000000000000");
  const hang = () => new Promise(() => {});
  await assert.rejects(moveToNewRoom(old, { storage, timeout: 30, open: async () => ({ importJSON: hang, update: hang }) }), /timeout/);
  assert.equal(storage.o[ROOM_KEY], "oldroom00000000000000000");
  assert.equal(old.moved, false);
});

test("rotate: a retire that never gets acked does not undo the move", async () => {
  const shared = { rooms: {} };
  const old = await new MemoryStore("oldroom00000000000000000", shared).ready();
  old.retire = () => new Promise(() => {});
  const storage = mem();
  const id = await moveToNewRoom(old, { storage, timeout: 30, open: (rid) => new MemoryStore(rid, shared).ready() });
  assert.equal(storage.o[ROOM_KEY], id);
});
