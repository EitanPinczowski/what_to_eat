// A doc edit made before the live connection's first snapshot must not flicker back to the old server value.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FirebaseStore, mergePending } from "../js/store/firebase.js";

test("mergePending: newer updatedAt wins, a pending write beats an older or undated server copy", () => {
  const cols = { places: { a: { n: "srv", updatedAt: "2026-01-02" }, b: { n: "srv", updatedAt: "2026-01-01" }, c: { n: "srv" }, d: { n: "srv" } }, live: {} };
  const pd = { places: { a: { n: "loc", updatedAt: "2026-01-01" }, b: { n: "loc", updatedAt: "2026-01-02" }, c: { n: "loc" }, d: null, e: { n: "new" } } };
  const m = mergePending(cols, pd);
  assert.deepEqual([m.places.a.n, m.places.b.n, m.places.c.n, m.places.d, m.places.e.n], ["srv", "loc", "loc", undefined, "new"]);
  assert.equal(cols.places.b.n, "srv"); // input untouched
});

test("FirebaseStore fast open: an edit before the first snapshot survives it", async () => {
  const ROOM = "flickerroom000000000000";
  let fire;
  const snap = (docs) => ({ forEach: (f) => Object.entries(docs).forEach(([id, d]) => f({ id, data: () => d })), metadata: {} });
  const sdk = {
    initializeApp: () => ({}), initializeFirestore: () => ({}), persistentLocalCache: () => ({}), persistentMultipleTabManager: () => ({}),
    signInAnonymously: async () => ({}), getAuth: () => ({}), doc: () => ({}), collection: (_r, c) => ({ c }),
    getDoc: async () => ({ exists: () => false }), setDoc: async () => {}, deleteDoc: async () => {},
    onSnapshot: (ref, cb) => {
      if (ref.c === "places") fire = () => cb(snap({ p1: { name: "old" } }));
      else if (ref.c) cb(snap({}));
      return () => {};
    },
  };
  const old = { roomId: ROOM, room: { v: 1 }, cols: { places: { p1: { name: "old" } } } };
  const storage = { getItem: () => JSON.stringify(old), setItem() {} };
  const s = await new FirebaseStore(ROOM, {}, { sdk, fast: true, storage }).ready();
  const pending = s.put("places", "p1", { name: "new" });
  assert.equal(s.doc("places", "p1").name, "new");
  fire();
  await s._live;
  assert.equal(s.doc("places", "p1").name, "new");
  await pending;
  s.close();
});
