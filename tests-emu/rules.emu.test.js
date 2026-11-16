// Item 32: the real firestore.rules on the Firestore emulator (project demo-wte). Run with `npm run test:emu`.
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection } from "firebase/firestore";
import { COLLECTIONS } from "../js/store/store.js";

const ROOM = "abcdefghij0123456789abcd"; // 24 chars a-z0-9, like newId(24)
const OTHER = "zyxwvutsrq9876543210zyxw";
let env;

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-wte",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
  });
});
after(() => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  // A live room, written with the rules switched off.
  await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "rooms", ROOM), { v: 1, settings: {} }));
});

const db = () => env.authenticatedContext("anon1").firestore();
const anon = () => env.unauthenticatedContext().firestore();
const at = "2026-11-16T10:00:00.000Z";

test("signed-out clients can do nothing", async () => {
  await assertFails(getDoc(doc(anon(), "rooms", ROOM)));
  await assertFails(setDoc(doc(anon(), "rooms", ROOM, "history", "h1"), { f: "pizza" }));
  await assertFails(getDoc(doc(anon(), "rooms", ROOM, "history", "h1")));
});

test("room doc: get yes, list no, delete no, typed create/update", async () => {
  const d = db();
  await assertSucceeds(getDoc(doc(d, "rooms", ROOM)));
  await assertFails(getDocs(collection(d, "rooms")));
  await assertFails(deleteDoc(doc(d, "rooms", ROOM)));
  await assertSucceeds(setDoc(doc(d, "rooms", OTHER), { v: 1, settings: { her: "N" }, ratings: {}, custom: [] }));
  await assertSucceeds(updateDoc(doc(d, "rooms", ROOM), { inbox: ["x"] }));
  await assertFails(updateDoc(doc(d, "rooms", ROOM), { v: "one" })); // not a number
  await assertFails(updateDoc(doc(d, "rooms", ROOM), { settings: "x" })); // not a map
  await assertFails(updateDoc(doc(d, "rooms", ROOM), { custom: Array(301).fill("x") })); // list too long
  await assertFails(setDoc(doc(d, "rooms", "short"), { v: 1 })); // id too short
  await assertFails(setDoc(doc(d, "rooms", "ABCDEFGHIJ0123456789ABCD"), { v: 1 })); // id not a-z0-9
});

test("room doc: legacy extra keys are kept (no whitelist)", async () => {
  await assertSucceeds(updateDoc(doc(db(), "rooms", ROOM), { legacyThing: { a: 1 } }));
});

test("history: typed fields and size caps", async () => {
  const h = (id, x) => setDoc(doc(db(), "rooms", ROOM, "history", id), x);
  await assertSucceeds(h("h1", { f: "pizza", m: "sit", at, price: 60, trail: ["a"], top: ["pizza"] }));
  await assertFails(h("h2", { f: "x".repeat(41) }));
  await assertFails(h("h3", { price: "cheap" }));
  await assertFails(h("h4", { top: Array(11).fill("a") }));
  await assertFails(h("h5", { ans: "no" }));
  await assertFails(h("x".repeat(65), { f: "pizza" })); // doc id too long
  const big = Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`k${i}`, i]));
  await assertFails(h("h6", big)); // more than 60 keys
});

test("places: typed fields", async () => {
  const p = (id, x) => setDoc(doc(db(), "rooms", ROOM, "places", id), x);
  await assertSucceeds(p("p1", { name: "Pizza", city: "TLV", modes: ["sit"], price: 2, shabbat: false }));
  await assertFails(p("p2", { name: "x".repeat(121) }));
  await assertFails(p("p3", { modes: Array(9).fill("a") }));
  await assertFails(p("p4", { shabbat: "no" }));
});

test("live: only quiz, sweep and vote docs, typed", async () => {
  const l = (id, x) => setDoc(doc(db(), "rooms", ROOM, "live", id), x);
  await assertSucceeds(l("quiz", { mode: "sit", n: 3, i: 1, finished: false, actions: [{ k: "a", q: "q1", i: 0 }], opened: at }));
  await assertSucceeds(l("sweep", { mode: "sweep", n: 5, i: 0 }));
  await assertSucceeds(l("vote", { o: ["a", "b"], n: ["A", "B"], p: "a", pAt: at }));
  await assertFails(l("other", { n: 1 })); // unknown live doc
  await assertFails(l("quiz", { actions: Array(301).fill({}) }));
  await assertFails(l("quiz", { finished: "yes" }));
  await assertFails(l("vote", { o: ["a", "b", "c", "d"] })); // vote lists hold at most 3
  await assertFails(l("quiz", { opened: "x".repeat(41) }));
});

test("feedback, errors, shopping: capped strings; unknown collections refused", async () => {
  const w = (col, id, x) => setDoc(doc(db(), "rooms", ROOM, col, id), x);
  await assertSucceeds(w("feedback", "f1", { text: "ok", at }));
  await assertFails(w("feedback", "f2", { text: "x".repeat(501) }));
  await assertSucceeds(w("errors", "e1", { msg: "boom", stack: "s", screen: "home", ua: "UA", at }));
  await assertFails(w("errors", "e2", { stack: "x".repeat(1501) }));
  await assertSucceeds(w("shopping", "s1", { text: "milk", done: false, addedAt: at }));
  await assertFails(w("shopping", "s2", { done: "no" }));
  await assertFails(w("secrets", "z1", { a: 1 }));
  await assertFails(getDoc(doc(db(), "rooms", ROOM, "secrets", "z1")));
});

test("subcollection writes need an existing, un-retired room", async () => {
  await assertFails(setDoc(doc(db(), "rooms", OTHER, "history", "h1"), { f: "pizza" })); // room does not exist
  await assertSucceeds(setDoc(doc(db(), "rooms", ROOM, "history", "h1"), { f: "pizza" }));
  await assertSucceeds(updateDoc(doc(db(), "rooms", ROOM), { moved: true, at })); // retire (tombstone)
  await assertFails(setDoc(doc(db(), "rooms", ROOM, "history", "h2"), { f: "pizza" }));
  await assertFails(setDoc(doc(db(), "rooms", ROOM, "events", "e1"), { k: "sent", at }));
});

test("events: create-only, fixed keys, typed, deletable", async () => {
  const e = (id, x) => setDoc(doc(db(), "rooms", ROOM, "events", id), x);
  await assertSucceeds(e("e1", { k: "sent", at, s: at, h: 10, d: 1, dv: "phone", w: "hot" }));
  await assertSucceeds(e("e2", { k: "step", at, q: "q1", a: 2, n: 3, t: 4 }));
  await assertSucceeds(e("e3", { k: "push", at, ok: true, n: 1 }));
  await assertFails(e("e4", { k: "bogus", at })); // unknown kind
  await assertFails(e("e5", { k: "sent" })); // missing at
  await assertFails(e("e6", { k: "sent", at, name: "Noga" })); // key outside the allow-list
  await assertFails(e("e7", { k: "sent", at, h: 24 })); // hour out of range
  await assertFails(e("e8", { k: "sent", at, d: 1.5 })); // not an int
  await assertFails(e("e9", { k: "sent", at, t: "5" }));
  await assertFails(e("x".repeat(65), { k: "sent", at }));
  await assertFails(updateDoc(doc(db(), "rooms", ROOM, "events", "e1"), { n: 2 })); // no update
  await assertSucceeds(getDoc(doc(db(), "rooms", ROOM, "events", "e1")));
  await assertSucceeds(getDocs(collection(db(), "rooms", ROOM, "events")));
  await assertSucceeds(deleteDoc(doc(db(), "rooms", ROOM, "events", "e1"))); // trimming the log
});

test("delete list: every collection of the store can be deleted; the log tombstone write is allowed", async () => {
  for (const c of COLLECTIONS) {
    const ref = doc(db(), "rooms", ROOM, c, c === "live" ? "quiz" : "d1");
    await assertSucceeds(setDoc(ref, c === "live" ? { n: 1 } : { at }));
    await assertSucceeds(setDoc(ref, c === "live" ? { moved: true, at } : { moved: true, at })); // rotate-key tombstone shape
    await assertSucceeds(deleteDoc(ref));
  }
  await assertFails(deleteDoc(doc(db(), "rooms", ROOM, "secrets", "z1"))); // collections outside the list stay protected
});
