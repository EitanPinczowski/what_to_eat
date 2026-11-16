// Item 33d: data written by older versions loads without crashing and every reader copes with the missing fields.
import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate, emptyRoom, COLLECTIONS } from "../js/store/store.js";
import { LocalStore } from "../js/store/local.js";
import { FirebaseStore } from "../js/store/firebase.js";
import { MemoryStore } from "../js/store/memory.js";
import { statsFrom, learnFrom } from "../js/engine/learn.js";
import { wrappedSummary } from "../js/engine/wrapped.js";
import { insightsFor } from "../js/engine/insights.js";
import { buildFoods } from "../js/engine/foods.js";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { priorFrom } from "../js/engine/prior.js";
import { pickPlaces } from "../js/places/picker.js";
import { OLD_ROOMS, OLD_ROOM_V0, oldLocalRecord, OLD_HISTORY } from "./fixtures/old-data.js";

const ROOM = "oldroom000000000000000000";
const storage = (initial) => {
  const m = new Map(initial ? [[`mabalach_v1:${ROOM}`, typeof initial === "string" ? initial : JSON.stringify(initial)]] : []);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};
const noWin = { addEventListener() {} };

test("migrate: every old room shape becomes a full current room", () => {
  for (const r of OLD_ROOMS) {
    const m = migrate(r);
    assert.equal(m.v, 1);
    for (const k of Object.keys(emptyRoom())) assert.ok(k in m, k);
    assert.equal(typeof m.settings, "object");
    assert.ok(Array.isArray(m.custom) && Array.isArray(m.inbox) && Array.isArray(m.imported));
  }
  assert.deepEqual(migrate(OLD_ROOM_V0).favs, ["pizza"], "legacy keys are kept, not dropped");
  assert.equal(migrate(OLD_ROOM_V0).settings.city, "", "missing settings are filled in");
});

test("LocalStore: an old record opens, reads and writes", async () => {
  const s = await new LocalStore(ROOM, { storage: storage(oldLocalRecord()), win: noWin }).ready();
  for (const c of COLLECTIONS) assert.ok(Array.isArray(s.list(c)), c);
  assert.equal(s.list("history").length, 6);
  assert.equal(s.get().settings.her, "נגה");
  await s.update((db) => (db.settings.city = "רעננה"));
  await s.put("history", "new1", { f: "pizza", at: new Date().toISOString() });
  assert.equal(s.list("history").length, 7);
  s.vote();
  s.shopping();
});

test("LocalStore: damaged or foreign storage content does not crash", async () => {
  for (const bad of ["", "not json", "[]", "42", '{"room":5,"cols":7}', '{"cols":{"history":null,"mystery":{"a":1}}}']) {
    const s = await new LocalStore(ROOM, { storage: storage(bad), win: noWin }).ready();
    assert.equal(s.get().v, 1);
    for (const c of COLLECTIONS) assert.ok(Array.isArray(s.list(c)), `${c} after ${bad}`);
  }
});

test("FirebaseStore fast open: an old saved snapshot is used or ignored, never crashes", async () => {
  const snapKey = `wte.snap:${ROOM}`;
  const never = () => new Promise(() => {});
  const sdk = { initializeApp: () => ({}), initializeFirestore: () => ({}), persistentLocalCache: () => ({}), persistentMultipleTabManager: () => ({}), signInAnonymously: async () => ({}), getAuth: () => ({}), doc: () => ({}), collection: () => ({}), getDoc: never, getDocs: never, onSnapshot: () => () => {} };
  const old = { roomId: ROOM, room: OLD_ROOM_V0, cols: { history: OLD_HISTORY(), places: {} } }; // a snapshot without most collections
  const mk = (raw) => ({ getItem: (k) => (k === snapKey ? raw : null), setItem() {} });
  const s = await new FirebaseStore(ROOM, {}, { sdk, fast: true, storage: mk(JSON.stringify(old)) }).ready();
  assert.equal(s.list("history").length, 6);
  assert.deepEqual(s.list("live"), []);
  for (const raw of [null, "junk", JSON.stringify({ roomId: "other", room: {}, cols: {} }), JSON.stringify({ roomId: ROOM, room: { moved: true }, cols: {} }), JSON.stringify({ roomId: ROOM })]) {
    const s2 = new FirebaseStore(ROOM, {}, { sdk, fast: true, storage: mk(raw) });
    assert.equal(s2._readSnap(), null, String(raw));
  }
});

test("engine readers cope with old history, places and rooms", async () => {
  const s = await new MemoryStore(ROOM).ready();
  const rec = oldLocalRecord();
  for (const [id, d] of Object.entries(rec.cols.history)) await s.put("history", id, d);
  for (const [id, d] of Object.entries(rec.cols.places)) await s.put("places", id, d);
  const history = s.list("history");
  const foods = buildFoods(FOODS, s.get().custom);
  assert.doesNotThrow(() => statsFrom(history));
  assert.doesNotThrow(() => learnFrom(history, foods));
  assert.doesNotThrow(() => wrappedSummary(history, new Date().toISOString().slice(0, 7), s.cols.places));
  assert.doesNotThrow(() => insightsFor({ history, events: [], places: s.cols.places, foods, questions: QUESTIONS }));
  assert.doesNotThrow(() => priorFrom(foods, { ratings: s.get().ratings, history, exp: s.get().exp }));
  const places = s.list("places");
  assert.equal(places.length, 3);
  assert.ok(places.every((p) => Array.isArray(p.cuisines)), "places without cuisines get them from their foods");
  assert.doesNotThrow(() => pickPlaces(places, foods, { mode: "take" }));
});
