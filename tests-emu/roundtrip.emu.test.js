// Item 32: two devices in one room, using the app's real FirebaseStore against the Firestore + Auth emulators.
// The Firebase SDK comes from npm here (the app loads it from gstatic); FirebaseStore takes it through its `sdk` option.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as app from "firebase/app";
import * as auth from "firebase/auth";
import * as fs from "firebase/firestore";
import { FirebaseStore } from "../js/store/firebase.js";

const [FHOST, FPORT] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const CONFIG = { apiKey: "fake", projectId: "demo-wte", authDomain: "demo-wte.firebaseapp.com" };
const newRoom = () => "rt" + Math.random().toString(36).slice(2, 12).padEnd(10, "0") + Date.now().toString(36).padEnd(12, "0").slice(0, 12); // 24 chars a-z0-9
let n = 0;

// An sdk where each device gets its own app and the emulators; the store itself is unchanged.
function sdkFor(name) {
  return {
    ...app,
    ...auth,
    ...fs,
    initializeApp: (cfg) => app.initializeApp(cfg, `${name}-${n++}`),
    initializeFirestore: (a) => {
      const db = fs.initializeFirestore(a, {});
      fs.connectFirestoreEmulator(db, FHOST, Number(FPORT));
      return db;
    },
    getAuth: (a) => {
      const au = auth.getAuth(a);
      auth.connectAuthEmulator(au, `http://${AUTH}`, { disableWarnings: true });
      return au;
    },
  };
}

const stores = [];
const device = async (name, room) => {
  const s = await new FirebaseStore(room, CONFIG, { sdk: sdkFor(name), storage: null }).ready();
  stores.push(s);
  return s;
};
const until = async (fn, ms = 8000) => {
  const t0 = Date.now();
  for (;;) {
    try {
      const v = fn();
      if (v) return v;
    } catch {}
    if (Date.now() - t0 > ms) throw new Error("timed out waiting: " + fn);
    await new Promise((r) => setTimeout(r, 40));
  }
};
after(async () => {
  for (const s of stores) {
    s.close();
    await s.sdk.terminate?.(s.db).catch(() => {});
  }
  setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref();
});

test("two devices: live/quiz and history written by one show up on the other", async () => {
  const room = newRoom();
  const eitan = await device("eitan", room);
  await eitan.update((db) => (db.settings.her = "N")); // creates the room doc (rules need a live room)
  const noga = await device("noga", room);
  assert.equal(noga.get().settings.her, "N");

  await noga.put("live", "quiz", { mode: "sit", n: 2, i: 1, finished: false, opened: "2026-11-16T10:00:00.000Z", actions: [{ k: "a", q: "q1", i: 0 }] });
  await until(() => eitan.doc("live", "quiz")?.i === 1);
  assert.equal(eitan.doc("live", "quiz").mode, "sit");

  await noga.put("live", "quiz", { mode: "sit", n: 2, i: 2, finished: true, opened: "2026-11-16T10:00:00.000Z", actions: [] });
  await until(() => eitan.doc("live", "quiz")?.finished === true);

  await eitan.put("history", "h1", { f: "pizza", m: "sit", at: "2026-11-16T10:05:00.000Z", top: ["pizza"] });
  await until(() => noga.doc("history", "h1")?.f === "pizza");
  assert.equal(noga.list("history")[0].f, "pizza");

  await eitan.remove("history", "h1");
  await until(() => !noga.doc("history", "h1"));
});

test("room doc edits travel between devices", async () => {
  const room = newRoom();
  const a = await device("a", room);
  const b = await device("b", room);
  await a.update((db) => (db.inbox = ["note"]));
  await until(() => b.get().inbox?.[0] === "note");
});

test("rules refuse a bad write through the real store, and it is reported", async () => {
  const room = newRoom();
  const a = await device("bad", room);
  await a.update((db) => (db.settings.her = "N")); // a live room, so only the field cap can refuse
  const errors = [];
  a.onSave((e) => e.state === "error" && errors.push(e));
  await assert.rejects(a.put("history", "bad1", { f: "x".repeat(200) }));
  assert.equal(errors.length, 1);
  assert.equal(a.pending, 0);
});

test("offline then online: the write is queued while offline and arrives after reconnect", async () => {
  const room = newRoom();
  const eitan = await device("eitan2", room);
  await eitan.update((db) => (db.settings.her = "N"));
  const noga = await device("noga2", room);
  const states = [];
  noga.onSave((e) => states.push(e.state));

  await new Promise((r) => setTimeout(r, 500)); // let the first listener snapshots land before going offline
  await fs.disableNetwork(noga.db);
  const write = noga.put("live", "quiz", { mode: "take", n: 1, i: 1, finished: true, opened: "2026-11-16T11:00:00.000Z", actions: [] });
  let landed = false;
  write.then(() => (landed = true));
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(landed, false, "write must not be acknowledged while offline");
  assert.equal(noga.pending, 1);
  assert.equal(noga.doc("live", "quiz").mode, "take", "local copy shows it at once");
  assert.equal(eitan.doc("live", "quiz")?.mode === "take", false, "the other device has not seen it");

  await fs.enableNetwork(noga.db);
  await write;
  assert.equal(noga.pending, 0);
  await until(() => eitan.doc("live", "quiz")?.mode === "take");
  assert.deepEqual([states[0], states.at(-1)], ["pending", "saved"]);
});

test("fast open: a doc edit before the first snapshot does not flicker back to the old value", async () => {
  const room = newRoom();
  const a = await device("fa", room);
  await a.update((db) => (db.settings.her = "N"));
  await a.put("history", "h1", { f: "old", m: "sit", at: "2026-11-16T10:00:00.000Z", top: [] });
  const saved = JSON.stringify({ roomId: room, room: a.get(), cols: a.cols });
  const storage = { getItem: () => saved, setItem() {} };
  const b = await new FirebaseStore(room, CONFIG, { sdk: sdkFor("fb"), storage, fast: true }).ready();
  stores.push(b);
  const seen = [];
  b.subscribe(() => seen.push(b.doc("history", "h1")?.f));
  await b.put("history", "h1", { f: "new", m: "sit", at: "2026-11-16T10:00:00.000Z", top: [] });
  await b._live;
  assert.equal(b.doc("history", "h1").f, "new");
  assert.ok(!seen.includes("old") || seen.indexOf("old") < seen.indexOf("new"), "no flicker back to old");
  await until(() => a.doc("history", "h1")?.f === "new");
});
