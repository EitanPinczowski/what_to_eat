import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyRoom, migrate, COLLECTIONS, VOTE_NONE } from "../js/store/store.js";
import { MemoryStore } from "../js/store/memory.js";
import { LocalStore } from "../js/store/local.js";
import { FirebaseStore } from "../js/store/firebase.js";

const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};
const fakeWin = () => {
  const ls = [];
  return { addEventListener: (t, f) => ls.push(f), fire: (e) => ls.forEach((f) => f(e)) };
};
const ROOM = "testroom0000000000000000";

test("migrate fills defaults and keeps data", () => {
  const r = migrate({ ratings: { a: { r: 4 } }, settings: { her: "X" } });
  assert.equal(r.v, 1);
  assert.equal(r.settings.her, "X");
  assert.equal(r.settings.me, emptyRoom().settings.me);
  assert.deepEqual(r.ratings, { a: { r: 4 } });
  assert.deepEqual(migrate(null), emptyRoom());
});

for (const [name, make] of [
  ["memory", () => new MemoryStore(ROOM)],
  ["local", () => new LocalStore(ROOM, { storage: fakeStorage(), win: fakeWin() })],
]) {
  test(`${name}: update, get returns a copy, subscribe`, async () => {
    const s = await make().ready();
    const seen = [];
    const un = s.subscribe((w) => seen.push(w));
    await s.update((db) => (db.ratings.sushi = { r: 4 }));
    assert.equal(s.get().ratings.sushi.r, 4);
    s.get().ratings.sushi.r = 1;
    assert.equal(s.get().ratings.sushi.r, 4);
    un();
    await s.update((db) => (db.inbox = ["x"]));
    assert.deepEqual(seen, ["room"]);
  });

  test(`${name}: collections put/list/doc/remove, newest first`, async () => {
    const s = await make().ready();
    await s.put("history", "a", { at: "2026-01-01", fn: "פיצה" });
    await s.put("history", "b", { at: "2026-02-01", fn: "סושי" });
    assert.deepEqual(s.list("history").map((d) => d.id), ["b", "a"]);
    assert.equal(s.doc("history", "a").fn, "פיצה");
    await s.remove("history", "a");
    assert.equal(s.doc("history", "a"), null);
    await assert.rejects(s.put("secrets", "x", {}));
  });

  test(`${name}: importResult dedupes quiz and rate payloads`, async () => {
    const s = await make().ready();
    const q = { v: 1, t: "quiz", id: "r1", at: "2026-03-01", f: null, fn: "מרק של סבתא", fe: "🍲", m: "home", trail: ["a"] };
    assert.deepEqual(await s.importResult(q), { fresh: true });
    assert.deepEqual(await s.importResult(q), { fresh: false });
    assert.equal(s.list("history")[0].fn, "מרק של סבתא");
    assert.deepEqual(s.get().inbox, ["מרק של סבתא"]);
    const r = { v: 1, t: "rate", id: "r2", r: { bamba: 4, sushi: 1 }, n: { sushi: "רק עם סלמון" } };
    assert.deepEqual(await s.importResult(r), { fresh: true });
    assert.deepEqual(await s.importResult(r), { fresh: false });
    assert.deepEqual(s.get().ratings.sushi, { r: 1, n: "רק עם סלמון" });
    assert.deepEqual(await s.importResult({ t: "quiz" }), { fresh: false });
  });

  test(`${name}: export/import JSON round-trip`, async () => {
    const a = await make().ready();
    await a.update((db) => (db.ratings.pizza = { r: 3 }));
    await a.put("places", "p1", { name: "פיצה האט", foods: ["pizza"] });
    const b = await make().ready();
    await b.importJSON(a.exportJSON());
    assert.equal(b.get().ratings.pizza.r, 3);
    assert.equal(b.doc("places", "p1").name, "פיצה האט");
    await assert.rejects(b.importJSON("{}"));
  });

  test(`${name}: error log keeps 50`, async () => {
    const s = await make().ready();
    for (let i = 0; i < 53; i++) await s.logError({ msg: `e${i}` });
    assert.equal(s.list("errors").length, 50);
  });
}

test("memory: two stores on one room see each other live", async () => {
  const shared = { rooms: {} };
  const owner = await new MemoryStore(ROOM, shared).ready();
  const guest = await new MemoryStore(ROOM, shared).ready();
  let got = null;
  owner.subscribe((w) => (got = w));
  await guest.put("live", "quiz", { step: 5, opened: true });
  assert.equal(got, "live");
  assert.equal(owner.doc("live", "quiz").step, 5);
  await guest.update((db) => (db.ratings.krembo = { r: 4 }));
  assert.equal(owner.get().ratings.krembo.r, 4);
});

test("local: persists and reacts to storage events from other tabs", async () => {
  const storage = fakeStorage();
  const win = fakeWin();
  const a = await new LocalStore(ROOM, { storage, win }).ready();
  await a.update((db) => (db.settings.city = "רעננה"));
  const b = await new LocalStore(ROOM, { storage, win: fakeWin() }).ready();
  assert.equal(b.get().settings.city, "רעננה");
  await b.put("live", "quiz", { step: 2 });
  win.fire({ key: a.key });
  assert.equal(a.doc("live", "quiz").step, 2);
  storage.setItem(a.key, "{broken");
  assert.deepEqual((await new LocalStore(ROOM, { storage, win: fakeWin() }).ready()).get(), emptyRoom());
});

test("firebase: reads and writes through the SDK (fake)", async () => {
  const docs = new Map([["rooms/" + ROOM, { v: 1, ratings: { pizza: { r: 4 } } }], [`rooms/${ROOM}/history/h1`, { fn: "פיצה" }]]);
  const calls = [];
  const snap = (path) => ({ id: path.split("/").pop(), exists: () => docs.has(path), data: () => docs.get(path), metadata: {} });
  const sdk = {
    initializeApp: () => ({}),
    initializeFirestore: () => ({}),
    persistentLocalCache: () => ({}),
    persistentMultipleTabManager: () => ({}),
    getAuth: () => ({}),
    signInAnonymously: async () => calls.push("auth"),
    doc: (parent, ...segs) => ({ path: [parent.path, ...segs].filter(Boolean).join("/") }),
    collection: (parent, c) => ({ path: `${parent.path}/${c}` }),
    getDoc: async (ref) => snap(ref.path),
    getDocs: async (ref) => ({ forEach: (f) => [...docs.keys()].filter((k) => k.startsWith(ref.path + "/")).forEach((k) => f(snap(k))) }),
    onSnapshot: () => () => calls.push("unsub"),
    setDoc: async (ref, d) => (calls.push(`set ${ref.path}`), docs.set(ref.path, d)),
    deleteDoc: async (ref) => (calls.push(`del ${ref.path}`), docs.delete(ref.path)),
  };
  const s = await new FirebaseStore(ROOM, {}, { sdk }).ready();
  assert.equal(calls[0], "auth");
  assert.equal(s.get().ratings.pizza.r, 4);
  assert.equal(s.doc("history", "h1").fn, "פיצה");
  await s.put("live", "quiz", { step: 1 });
  await s.remove("history", "h1");
  await s.update((db) => (db.inbox = ["x"]));
  assert.ok(calls.includes(`set rooms/${ROOM}/live/quiz`));
  assert.ok(calls.includes(`del rooms/${ROOM}/history/h1`));
  assert.deepEqual(docs.get("rooms/" + ROOM).inbox, ["x"]);
  s.close();
  assert.equal(calls.filter((c) => c === "unsub").length, 1 + COLLECTIONS.length);
});

for (const [name, make] of [
  ["memory", () => new MemoryStore(ROOM)],
  ["local", () => new LocalStore(ROOM, { storage: fakeStorage(), win: fakeWin() })],
]) {
  test(`${name}: her place vote — send 2-3 places, she picks or says neither`, async () => {
    const s = await make().ready();
    for (const id of ["a", "b", "c", "d"]) await s.put("places", id, { name: `מקום ${id}` });
    assert.equal(s.vote(), null);
    assert.equal(await s.sendVote(["a"]), false, "needs at least 2");
    assert.equal(await s.sendVote(["a", "b", "c", "d"]), false, "at most 3");
    assert.equal(await s.sendVote(["a", "zzz"]), false, "unknown ids are dropped");
    assert.equal(await s.sendVote(["a", "a"]), false, "duplicates collapse");
    assert.equal(await s.sendVote(["a", "b", "c"]), true);
    let v = s.vote();
    assert.deepEqual(v.ids, ["a", "b", "c"]);
    assert.deepEqual(v.names, ["מקום a", "מקום b", "מקום c"]);
    assert.equal(v.pick, null);
    assert.equal(await s.castVote("d"), false, "not offered");
    assert.equal(await s.castVote("b"), true);
    assert.equal(s.vote().pick, "b");
    assert.equal(await s.castVote(VOTE_NONE), true);
    assert.equal(s.vote().pick, VOTE_NONE);
    assert.equal(s.doc("live", "quiz"), null, "the quiz doc is untouched");
    await s.sendVote(["c", "d"]); // a new offer clears the old answer
    assert.equal(s.vote().pick, null);
    await s.clearVote();
    assert.equal(s.vote(), null);
    assert.equal(await s.castVote("c"), false);
  });
}

test("vote doc stays small (fits the room rules' caps)", async () => {
  const s = await new MemoryStore(ROOM).ready();
  for (const id of ["a", "b"]) await s.put("places", id, { name: "ש".repeat(100) });
  await s.sendVote(["a", "b"]);
  await s.castVote("a");
  const d = s.doc("live", "vote");
  assert.ok(Object.keys(d).length <= 6);
  assert.ok(d.n.every((n) => n.length <= 40));
});
