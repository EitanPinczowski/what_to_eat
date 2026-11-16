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

  test(`${name}: places without cuisines get them from their food list; saved cuisines win; foods are kept`, async () => {
    const a = await make().ready();
    await a.put("places", "old", { name: "ישן", foods: ["pizza", "sushi"] });
    await a.put("places", "own", { name: "שלה", foods: ["pizza"], cuisines: ["cafe"] });
    await a.put("places", "none", { name: "בלי" });
    assert.deepEqual(a.doc("places", "old").cuisines, ["italian", "asian"]);
    assert.deepEqual(a.doc("places", "old").foods, ["pizza", "sushi"]);
    assert.deepEqual(a.doc("places", "own").cuisines, ["cafe"]);
    assert.deepEqual(a.doc("places", "none").cuisines, []);
    assert.deepEqual(a.list("places").find((x) => x.id === "old").cuisines, ["italian", "asian"]);
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
    onSnapshot: (ref, cb) => { if (ref.path.split("/").length > 2) Promise.resolve().then(() => cb({ metadata: {}, forEach: (f) => [...docs.keys()].filter((k) => k.startsWith(ref.path + "/")).forEach((k) => f(snap(k))) })); return () => calls.push("unsub"); },
    setDoc: async (ref, d) => (calls.push(`set ${ref.path}`), docs.set(ref.path, d)),
    deleteDoc: async (ref) => (calls.push(`del ${ref.path}`), docs.delete(ref.path)),
    updateDoc: async (ref, d) => (calls.push(`upd ${ref.path} ${Object.keys(d).join(",")}`), docs.set(ref.path, { ...docs.get(ref.path), ...d })),
    deleteField: () => undefined,
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

import { cleanResult } from "../js/store/store.js";
import { fallbackPayload } from "../js/ui/guest/session.js";
import { buildResultLink } from "../js/share/links.js";

test("cleanResult: strict shape, known foods only, ratings 1-4, size caps", () => {
  const ok = { v: 1, t: "rate", id: "a1", r: { pizza: 4, sushi: 1 }, n: { sushi: "אולי" }, x: ["מרק"] };
  assert.deepEqual(cleanResult(ok), { t: "rate", id: "a1", r: { pizza: 4, sushi: 1 }, n: { sushi: "אולי" }, x: ["מרק"] });
  for (const bad of [
    { ...ok, r: { nope: 4 } },
    { ...ok, r: { pizza: 5 } },
    { ...ok, r: { pizza: "4" } },
    { ...ok, r: { pizza: 2.5 } },
    { ...ok, r: {} },
    { ...ok, id: "bad id!" },
    { ...ok, n: { bamba: "x" } },
    { ...ok, n: { sushi: "x".repeat(201) } },
    { ...ok, x: Array(31).fill("a") },
    { ...ok, id: undefined },
    null,
  ])
    assert.equal(cleanResult(bad), null, JSON.stringify(bad)?.slice(0, 60));
  const q = { v: 1, t: "quiz", id: "q1", f: "pizza", fn: "פיצה", fe: "🍕", m: "take", price: 2, trail: ["a"], extra: "dropped" };
  assert.equal(cleanResult(q).fn, "פיצה");
  assert.equal("extra" in cleanResult(q), false);
  for (const bad of [{ ...q, f: "nope" }, { ...q, m: "teleport" }, { ...q, price: 9 }, { ...q, fn: "x".repeat(81) }, { ...q, trail: Array(41).fill("a") }, { ...q, at: "garbage" }, { ...q, fn: 5 }])
    assert.equal(cleanResult(bad), null);
  assert.ok(cleanResult({ ...q, f: "mycustom" }, new Set(["mycustom"])));
});

test("importResult refuses a crafted rating payload and leaves ratings alone", async () => {
  const s = await new MemoryStore(ROOM).ready();
  await s.update((db) => (db.ratings.pizza = { r: 3 }));
  assert.deepEqual(await s.importResult({ v: 1, t: "rate", id: "evil", r: { pizza: 1, ghost: 4 } }), { fresh: false });
  assert.equal(s.get().ratings.pizza.r, 3);
  assert.equal(s.checkResult({ v: 1, t: "rate", id: "evil", r: { ghost: 4 } }).bad, true);
});

test("the #r= fallback payload stays small", () => {
  const entry = { at: "2026-01-01T00:00:00Z", f: "pizza", fn: "פ".repeat(80), fe: "🍕", m: "take", price: 2, note: "נ".repeat(300), trail: Array.from({ length: 40 }, () => "ש".repeat(120)), top: Array(5).fill("pizza"), ans: Array(30).fill("q:1"), stats: { hit: true } };
  const link = buildResultLink("https://x.io/app/", fallbackPayload("id1", entry));
  assert.ok(link.length < 2500, `link ${link.length}`);
  assert.ok(cleanResult(fallbackPayload("id1", entry)));
});

test("firebase fast open: ready() answers from this room's saved copy, the live data follows, writes wait for it", async () => {
  const storage = fakeStorage();
  const mk = (docs) => {
    const snap = (path) => ({ id: path.split("/").pop(), exists: () => docs.has(path), data: () => docs.get(path), metadata: {} });
    let release;
    const gate = new Promise((r) => (release = r));
    const calls = [];
    return {
      release,
      calls,
      sdk: {
        initializeApp: () => ({}), initializeFirestore: () => ({}), persistentLocalCache: () => ({}), persistentMultipleTabManager: () => ({}),
        getAuth: () => ({}), signInAnonymously: () => gate,
        doc: (parent, ...segs) => ({ path: [parent.path, ...segs].filter(Boolean).join("/") }),
        collection: (parent, c) => ({ path: `${parent.path}/${c}` }),
        getDoc: async (ref) => snap(ref.path),
        onSnapshot: (ref, cb) => { if (ref.path.split("/").length > 2) Promise.resolve().then(() => cb({ metadata: {}, forEach: (f) => [...docs.keys()].filter((k) => k.startsWith(ref.path + "/")).forEach((k) => f(snap(k))) })); return () => {}; },
        setDoc: async (ref, d) => (calls.push(`set ${ref.path}`), docs.set(ref.path, d)),
        deleteDoc: async () => {},
        updateDoc: async (ref, d) => (calls.push(`upd ${ref.path} ${Object.keys(d).join(",")}`), docs.set(ref.path, { ...docs.get(ref.path), ...d })),
        deleteField: () => undefined,
      },
    };
  };
  // first run: no copy, so ready() waits for the live data (and a copy is saved)
  const a = mk(new Map([["rooms/" + ROOM, { v: 1, settings: { city: "חיפה" } }], [`rooms/${ROOM}/history/h1`, { fn: "פיצה" }]]));
  a.release();
  const s1 = await new FirebaseStore(ROOM, {}, { sdk: a.sdk, fast: true, storage }).ready();
  assert.equal(s1.doc("history", "h1").fn, "פיצה");
  await s1.put("live", "quiz", { step: 1 });
  await new Promise((r) => setTimeout(r, 900));
  s1.close();
  assert.ok(storage.getItem(`wte.snap:${ROOM}`));
  // second run: the connection is still pending, yet ready() has the copy; live data then replaces it
  const b = mk(new Map([["rooms/" + ROOM, { v: 1, settings: { city: "עכו" } }], [`rooms/${ROOM}/history/h1`, { fn: "סושי" }]]));
  const s2 = await new FirebaseStore(ROOM, {}, { sdk: b.sdk, fast: true, storage }).ready();
  assert.equal(s2.doc("history", "h1").fn, "פיצה");
  let told = 0;
  s2.subscribe(() => told++);
  const w = s2.put("history", "h2", { fn: "x" });
  assert.deepEqual(b.calls, [], "no write before the connection is up");
  b.release();
  await w;
  assert.equal(s2.doc("history", "h1").fn, "סושי");
  assert.ok(told > 0);
  assert.ok(b.calls.some((c) => c.endsWith("history/h2")));
  s2.close();
  // another room never reads this copy
  const c = mk(new Map([["rooms/other", { v: 1 }]]));
  c.release();
  const s3 = await new FirebaseStore("other", {}, { sdk: c.sdk, fast: true, storage }).ready();
  assert.equal(s3.list("history").length, 0);
  s3.close();
});

// ---- item 5: save only what changed ----
test("update() sends only the changed top-level keys (firebase)", async () => {
  const docs = new Map([["rooms/" + ROOM, { v: 1, settings: { city: "חיפה" }, ratings: { pizza: { r: 4 } }, inbox: [] }]]);
  const calls = [];
  const snap = (path) => ({ id: path.split("/").pop(), exists: () => docs.has(path), data: () => docs.get(path), metadata: {} });
  const sdk = {
    initializeApp: () => ({}), initializeFirestore: () => ({}), persistentLocalCache: () => ({}), persistentMultipleTabManager: () => ({}),
    getAuth: () => ({}), signInAnonymously: async () => {},
    doc: (parent, ...segs) => ({ path: [parent.path, ...segs].filter(Boolean).join("/") }),
    collection: (parent, c) => ({ path: `${parent.path}/${c}` }),
    getDoc: async (ref) => snap(ref.path),
    onSnapshot: (ref, cb) => { if (ref.path.split("/").length > 2) Promise.resolve().then(() => cb({ metadata: {}, forEach: (f) => [...docs.keys()].filter((k) => k.startsWith(ref.path + "/")).forEach((k) => f(snap(k))) })); return () => {}; },
    setDoc: async (ref, d, o) => (calls.push(`set ${o?.merge ? "merge " : ""}${ref.path}`), docs.set(ref.path, o?.merge ? { ...docs.get(ref.path), ...d } : d)),
    updateDoc: async (ref, d) => (calls.push(`upd ${Object.keys(d).join(",")}`), docs.set(ref.path, { ...docs.get(ref.path), ...d })),
    deleteField: () => undefined,
  };
  const s = await new FirebaseStore(ROOM, {}, { sdk }).ready();
  await s.update((db) => (db.inbox = ["x"]));
  await s.update((db) => (db.settings.city = "חיפה")); // same value: nothing to write
  await s.update((db) => (db.ratings.pizza.r = 4));
  assert.deepEqual(calls, ["upd inbox"]);
  await s.update((db) => ((db.exp = { a: 1 }), (db.learned = { b: 2 })));
  assert.deepEqual(calls.at(-1).split(" ")[1].split(",").sort(), ["exp", "learned"]);
  s.close();
  // a room doc that does not exist yet is created whole (merge)
  const fresh = new Map();
  calls.length = 0;
  const sdk2 = { ...sdk, getDoc: async (ref) => ({ exists: () => fresh.has(ref.path), data: () => fresh.get(ref.path), metadata: {} }), setDoc: async (ref, d, o) => (calls.push(`set ${o?.merge ? "merge" : "full"}`), fresh.set(ref.path, d)) };
  const s2 = await new FirebaseStore(ROOM, {}, { sdk: sdk2 }).ready();
  await s2.update((db) => (db.inbox = ["y"]));
  await s2.update((db) => (db.inbox = ["z"]));
  assert.equal(calls[0], "set merge");
  assert.ok(fresh.get("rooms/" + ROOM).settings, "the first write carries the whole valid doc");
  s2.close();
});

test("two clients editing different keys do not overwrite each other", async () => {
  const shared = { rooms: {} };
  const ma = await new MemoryStore(ROOM, shared).ready();
  const mb = await new MemoryStore(ROOM, shared).ready();
  await ma.update((db) => (db.inbox = ["a"]));
  mb.room = { ...mb.room, inbox: [] }; // b still holds its old copy, yet its edit of another key keeps a's
  await mb.update((db) => (db.ratings.pizza = { r: 3 }));
  assert.deepEqual(shared.rooms[ROOM].room.inbox, ["a"]);
  assert.equal(shared.rooms[ROOM].room.ratings.pizza.r, 3);
  const storage = fakeStorage();
  const a = await new LocalStore(ROOM, { storage, win: fakeWin() }).ready();
  const b = await new LocalStore(ROOM, { storage, win: fakeWin() }).ready();
  await a.update((db) => (db.inbox = ["a"]));
  await b.update((db) => (db.ratings.pizza = { r: 3 }));
  const stored = JSON.parse(storage.getItem(a.key)).room;
  assert.deepEqual(stored.inbox, ["a"]);
  assert.equal(stored.ratings.pizza.r, 3);
});

test("firebase fast open: an early edit neither clobbers live fields nor flickers back", async () => {
  const storage = fakeStorage();
  storage.setItem(`wte.snap:${ROOM}`, JSON.stringify({ roomId: ROOM, room: { v: 1, settings: { city: "ישן" }, inbox: [] }, cols: {} }));
  const docs = new Map([["rooms/" + ROOM, { v: 1, settings: { city: "ישן" }, inbox: ["live-only"], ratings: { pizza: { r: 2 } } }]]);
  let release;
  const gate = new Promise((r) => (release = r));
  const calls = [];
  const snap = (path) => ({ id: path, exists: () => docs.has(path), data: () => docs.get(path), metadata: {} });
  const sdk = {
    initializeApp: () => ({}), initializeFirestore: () => ({}), persistentLocalCache: () => ({}), persistentMultipleTabManager: () => ({}),
    getAuth: () => ({}), signInAnonymously: () => gate,
    doc: (parent, ...segs) => ({ path: [parent.path, ...segs].filter(Boolean).join("/") }),
    collection: (parent, c) => ({ path: `${parent.path}/${c}` }),
    getDoc: async (ref) => snap(ref.path), onSnapshot: (ref, cb) => { if (ref.path.split("/").length > 2) Promise.resolve().then(() => cb({ metadata: {}, forEach: () => {} })); return () => {}; },
    setDoc: async () => calls.push("set"),
    updateDoc: async (ref, d) => (calls.push(Object.keys(d).join(",")), docs.set(ref.path, { ...docs.get(ref.path), ...d })),
    deleteField: () => undefined,
  };
  const s = await new FirebaseStore(ROOM, {}, { sdk, fast: true, storage }).ready();
  const w = s.update((db) => (db.settings.city = "חדש"));
  release();
  await w;
  assert.deepEqual(calls, ["settings"], "only the edited field is written");
  assert.deepEqual(docs.get("rooms/" + ROOM).inbox, ["live-only"], "live fields survive");
  assert.equal(s.get().settings.city, "חדש", "the edit stays on screen after the live data arrived");
  assert.deepEqual(s.get().inbox, ["live-only"]);
  s.close();
});

// ---- item 6: pending-write count for the save marker ----
test("onSave: pending while a write waits, saved when it lands, error when it fails", async () => {
  const s = await new MemoryStore(ROOM).ready();
  const seen = [];
  s.onSave((e) => seen.push(`${e.state}:${e.pending}`));
  await s.update((db) => (db.inbox = ["x"]));
  await s.put("live", "quiz", { step: 1 });
  assert.deepEqual(seen, ["pending:1", "saved:0", "pending:1", "saved:0"]);
  assert.equal(s.pending, 0);
  seen.length = 0;
  s._writeDoc = async () => {
    throw new Error("offline");
  };
  await assert.rejects(s.put("live", "quiz", { step: 2 }), /offline/);
  assert.deepEqual(seen, ["pending:1", "error:0"]);
  await s.update(() => {}); // nothing changed: no write, no event
  assert.equal(seen.length, 2);
});

test("firebase: start-up issues no getDocs; the first snapshot of each listener carries the data", async () => {
  const docs = new Map([["rooms/" + ROOM, { v: 1 }], [`rooms/${ROOM}/history/h1`, { fn: "פיצה" }]]);
  const snap = (path) => ({ id: path.split("/").pop(), exists: () => docs.has(path), data: () => docs.get(path), metadata: {} });
  const sdk = {
    initializeApp: () => ({}), initializeFirestore: () => ({}), persistentLocalCache: () => ({}), persistentMultipleTabManager: () => ({}),
    getAuth: () => ({}), signInAnonymously: async () => {},
    doc: (parent, ...segs) => ({ path: [parent.path, ...segs].filter(Boolean).join("/") }),
    collection: (parent, c) => ({ path: `${parent.path}/${c}` }),
    getDoc: async (ref) => snap(ref.path),
    getDocs: async () => { throw new Error("getDocs must not be called"); },
    onSnapshot: (ref, cb) => { if (ref.path.split("/").length > 2) Promise.resolve().then(() => cb({ metadata: {}, forEach: (f) => [...docs.keys()].filter((k) => k.startsWith(ref.path + "/")).forEach((k) => f(snap(k))) })); return () => {}; },
  };
  const s = await new FirebaseStore(ROOM, {}, { sdk }).ready();
  assert.equal(s.list("history").length, 1);
});

// R0 (2026-11-17): her result without a budget had price: null, and the deployed rules refused a present null.
test("put: top-level nulls are left out of the written doc (her result with no budget saves)", async () => {
  const shared = { rooms: {} };
  const s = await new MemoryStore(ROOM, shared).ready();
  await s.put("history", "h1", { at: "2026-11-17", f: null, fn: "פיצה", price: null, m: "any", stats: { hit: true, x: null } });
  const d = s.doc("history", "h1");
  assert.equal("price" in d, false);
  assert.equal("f" in d, false);
  assert.equal(d.fn, "פיצה");
  assert.deepEqual(d.stats, { hit: true, x: null }); // nested values are kept as they are
  const other = await new MemoryStore(ROOM, shared).ready();
  assert.equal("price" in other.doc("history", "h1"), false); // what reached the shared backend has no null either
});
