import { test } from "node:test";
import assert from "node:assert/strict";
import { addSub, removeSub, hasSub, kindFor, notifyAll, MAX_SUBS } from "../js/push.js";

const sub = (n) => ({ endpoint: `https://fcm.googleapis.com/wp/${n}`, keys: { p256dh: "p", auth: "a" } });

test("addSub de-duplicates by endpoint, caps at 4 (newest kept), ignores junk", () => {
  let l = addSub([], sub(1));
  l = addSub(l, sub(1));
  assert.equal(l.length, 1);
  for (let i = 2; i <= 6; i++) l = addSub(l, sub(i));
  assert.equal(l.length, MAX_SUBS);
  assert.deepEqual(l.map((s) => s.endpoint.slice(-1)), ["3", "4", "5", "6"]);
  assert.equal(addSub(l, { endpoint: "http://x" }).length, MAX_SUBS);
  assert.equal(addSub(undefined, sub(1)).length, 1);
});

test("removeSub / hasSub", () => {
  const l = [sub(1), sub(2)];
  assert.deepEqual(removeSub(l, sub(1).endpoint), [sub(2)]);
  assert.equal(hasSub(l, sub(2).endpoint), true);
  assert.equal(hasSub(l, "nope"), false);
  assert.deepEqual(removeSub(undefined, "x"), []);
});

test("kindFor maps guest events and rejects the rest", () => {
  for (const k of ["quiz", "vote", "sweep", "test"]) assert.equal(kindFor(k), k);
  assert.equal(kindFor("pizza"), null);
});

test("notifyAll posts only subscription + kind, never throws, skips without subs", async () => {
  const calls = [];
  const f = async (url, o) => (calls.push({ url, body: JSON.parse(o.body) }), { status: 201 });
  assert.deepEqual(await notifyAll({}, "quiz", f), []);
  assert.deepEqual(await notifyAll({ push: [sub(1)] }, "bogus", f), []);
  assert.deepEqual(await notifyAll({ push: [sub(1), sub(2)], her: "נגה" }, "vote", f), [201, 201]);
  assert.deepEqual(Object.keys(calls[0].body).sort(), ["kind", "sub"]);
  assert.equal(calls[0].body.kind, "vote");
  const bad = async () => { throw new Error("net"); };
  assert.deepEqual(await notifyAll({ push: [sub(1)] }, "sweep", bad), [0]);
});

// ---- F4: the notification names the food; optional "opened" ping ----
import { readFileSync } from "node:fs";
import { FOODS } from "../js/data/foods.js";
import { relayBody, pushFood, notifyOpened, FOOD_RE } from "../js/push.js";
import "../js/sw-names.js";
import "../js/sw-format.js";

test("relayBody: food only for kind quiz and only when it matches the relay regex", () => {
  assert.equal(relayBody(sub(1), "quiz", "pizza").food, "pizza");
  assert.deepEqual(Object.keys(relayBody(sub(1), "quiz", "pizza")).sort(), ["food", "kind", "sub"]);
  for (const bad of [undefined, null, "", "Pizza", "pi zza", "a-b", "x".repeat(31), 5]) assert.equal("food" in relayBody(sub(1), "quiz", bad), false, String(bad));
  assert.equal("food" in relayBody(sub(1), "vote", "pizza"), false);
  assert.ok(FOOD_RE.test("x".repeat(30)));
});

test("pushFood: seed foods yes, custom foods and free text no; every seed id passes the regex", () => {
  assert.equal(pushFood({ id: "pizza", name: "פיצה" }), "pizza");
  assert.equal(pushFood({ id: "my_thing", custom: true }), null);
  assert.equal(pushFood(null), null);
  assert.equal(pushFood(undefined), null);
  for (const f of FOODS) assert.ok(FOOD_RE.test(f[0]), f[0]);
});

test("notifyAll sends food in the POST body when asked", async () => {
  const bodies = [];
  const f = async (_u, o) => (bodies.push(JSON.parse(o.body)), { status: 201 });
  await notifyAll({ push: [sub(1)] }, "quiz", f, { food: "pizza" });
  await notifyAll({ push: [sub(1)] }, "quiz", f, { food: null });
  assert.equal(bodies[0].food, "pizza");
  assert.equal("food" in bodies[1], false);
});

test("opened ping: only when the setting is on, and once per session state", async () => {
  const sent = [];
  const f = async (_u, o) => (sent.push(JSON.parse(o.body).kind), { status: 201 });
  const s = { push: [sub(1)] };
  const off = { sent: false };
  await notifyOpened(s, off, f);
  assert.deepEqual(sent, []);
  const on = { sent: false };
  await notifyOpened({ ...s, notifyOpen: true }, on, f);
  await notifyOpened({ ...s, notifyOpen: true }, on, f);
  assert.deepEqual(sent, ["opened"]);
  assert.equal(kindFor("opened"), "opened");
});

test("sw-names.js matches js/data/foods.js (run tools/gen-sw-names.mjs when it fails)", () => {
  const names = globalThis.WTE_FOOD_NAMES;
  assert.equal(Object.keys(names).length, FOODS.length);
  for (const f of FOODS) assert.deepEqual(names[f[0]], [f[1], f[2]], f[0]);
});

test("wteFormatPush: names the food, falls back to the relay body, tags per kind", () => {
  const fmt = globalThis.wteFormatPush;
  const names = globalThis.WTE_FOOD_NAMES;
  const n = fmt({ title: "t", body: "נגה סיימה", kind: "quiz", food: "pizza" }, names);
  assert.equal(n.body, "נגה בחרה: פיצה 🍕");
  assert.equal(n.tag, "wte-quiz");
  assert.equal(fmt({ body: "x", kind: "quiz", food: "pizza" }, names, "דנה").body, "דנה בחרה: פיצה 🍕");
  for (const food of ["nope", "__proto__", "Pizza", 5, null]) assert.equal(fmt({ body: "generic", kind: "quiz", food }, names).body, "generic", String(food));
  assert.equal(fmt({ body: "generic", kind: "quiz" }, names).body, "generic");
  assert.equal(fmt({ body: "b", kind: "opened" }, names).tag, "wte-opened");
  assert.equal(fmt(null, names).title, "מה בא לך?");
  assert.equal(fmt({ kind: "../x" }, names).tag, "wte-msg");
});

test("sw.js loads the classic helpers, precaches them and renotifies per kind", () => {
  const sw = readFileSync("sw.js", "utf8");
  assert.match(sw, /importScripts\("js\/sw-names\.js", "js\/sw-format\.js"\)/);
  assert.ok(sw.includes('"js/sw-names.js"') && sw.includes('"js/sw-format.js"'));
  assert.match(sw, /renotify: true/);
});

// ---- W8: signed relay calls ----
import { createHmac, createHash } from "node:crypto";
import { bindRoom, signHeaders, newPushKey, PUSH_KEY_RE } from "../js/push.js";

test("signHeaders: room hash + HMAC-SHA256 of the exact body, matching node's crypto", async () => {
  const key = "k".repeat(64);
  const h = await signHeaders("room123", key, '{"a":"שלום"}');
  assert.equal(h["x-wte-room"], createHash("sha256").update("room123").digest("hex"));
  assert.equal(h["x-wte-sig"], createHmac("sha256", key).update('{"a":"שלום"}').digest("hex"));
  assert.ok(PUSH_KEY_RE.test(newPushKey()));
  assert.notEqual(newPushKey(), newPushKey());
});

test("notifyAll signs when a room is bound, creating the pushKey through the Store; raw room id never sent", async () => {
  const room = { settings: {} };
  const store = { roomId: "roomabc", get: () => room, update: async (fn) => fn(room) };
  bindRoom(store);
  const calls = [];
  const f = async (url, o) => (calls.push(o), { status: 201 });
  await notifyAll({ push: [sub(1)] }, "vote", f);
  assert.ok(PUSH_KEY_RE.test(room.pushKey));
  const o = calls[0];
  assert.equal(o.headers["x-wte-sig"], createHmac("sha256", room.pushKey).update(o.body).digest("hex"));
  assert.equal(o.headers["x-wte-room"], createHash("sha256").update("roomabc").digest("hex"));
  assert.ok(!JSON.stringify(o).includes("roomabc"));
  const key = room.pushKey;
  await notifyAll({ push: [sub(1)] }, "vote", f);
  assert.equal(room.pushKey, key); // reused, not regenerated
  bindRoom(null);
  await notifyAll({ push: [sub(1)] }, "vote", f);
  assert.equal(calls[2].headers["x-wte-sig"], undefined);
});

test("notifyAll offers the key once when the relay says unregistered", async () => {
  const room = { settings: {}, pushKey: "ab".repeat(32) };
  bindRoom({ roomId: "roomxyz", get: () => room, update: async () => {} });
  const seen = [];
  const f = async (url, o) => (seen.push(o.headers["x-wte-key"]), seen.length === 1 ? { status: 401, json: async () => ({ error: "unregistered" }) } : { status: 201 });
  assert.deepEqual(await notifyAll({ push: [sub(1)] }, "vote", f), [201]);
  assert.deepEqual(seen, [undefined, room.pushKey]);
  const g = async () => ({ status: 401, json: async () => ({ error: "sig" }) });
  assert.deepEqual(await notifyAll({ push: [sub(1)] }, "vote", g), [401]);
  bindRoom(null);
});
