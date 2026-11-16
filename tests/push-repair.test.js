// Item 7: notifications repair themselves (prune dead, replace on change, delivery receipt, service worker resubscribe).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { epHash, pruneDead, reconcile, sendReport, mergeDead, notifyReport, repairOnStart, VAPID_PUBLIC_KEY } from "../js/push.js";
import { MemoryStore } from "../js/store/memory.js";
import { receiptLine } from "../js/ui/owner/app.js";

const sub = (n) => ({ endpoint: `https://fcm.googleapis.com/wp/${n}`, keys: { p256dh: "p", auth: "a" } });

test("epHash is stable, short and differs per endpoint", () => {
  assert.equal(epHash(sub(1).endpoint), epHash(sub(1).endpoint));
  assert.notEqual(epHash(sub(1).endpoint), epHash(sub(2).endpoint));
  assert.match(epHash("x"), /^[0-9a-f]{8}$/);
});

test("pruneDead drops only the named subscriptions", () => {
  const l = [sub(1), sub(2), sub(3)];
  assert.deepEqual(pruneDead(l, [epHash(sub(2).endpoint)]), [sub(1), sub(3)]);
  assert.deepEqual(pruneDead(l, []), l);
  assert.deepEqual(pruneDead(undefined, ["x"]), []);
});

test("reconcile replaces this phone's old endpoint with the current one, keeps other phones", () => {
  const l = [sub(1), sub(2)];
  assert.deepEqual(reconcile(l, sub(9), sub(1).endpoint).map((s) => s.endpoint.slice(-1)), ["2", "9"]);
  assert.deepEqual(reconcile(l, sub(2), sub(2).endpoint), l);
  assert.deepEqual(reconcile(l, sub(9), "").map((s) => s.endpoint.slice(-1)), ["1", "2", "9"]);
  assert.deepEqual(reconcile(l, null, sub(1).endpoint), l);
});

test("sendReport: receipt with ok/codes, 410 becomes a dead hash", () => {
  const r = sendReport([sub(1), sub(2)], [201, 410], "T");
  assert.deepEqual(r.receipt, { sentAt: "T", ok: true, codes: [201, 410] });
  assert.deepEqual(r.dead, [epHash(sub(2).endpoint)]);
  assert.equal(sendReport([sub(1)], [0], "T").receipt.ok, false);
  assert.deepEqual(mergeDead(["a"], ["a", "b"]), ["a", "b"]);
});

test("notifyReport posts to the relay and reports; null when nothing is stored", async () => {
  const f = async (_u, o) => ({ status: JSON.parse(o.body).sub.endpoint.endsWith("2") ? 410 : 201 });
  const r = await notifyReport({ push: [sub(1), sub(2)] }, "quiz", f, { food: "pizza" });
  assert.equal(r.receipt.ok, true);
  assert.deepEqual(r.receipt.codes, [201, 410]);
  assert.deepEqual(r.dead, [epHash(sub(2).endpoint)]);
  assert.equal(await notifyReport({ push: [] }, "quiz", f), null);
});

const fakeEnv = (cur, perm = "granted") => {
  const mem = {};
  return {
    win: { PushManager: {}, Notification: { permission: perm } },
    nav: { serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => (cur ? { toJSON: () => cur, endpoint: cur.endpoint } : null), subscribe: async () => ({ toJSON: () => sub(7) }) } }) } },
    st: { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = v), removeItem: (k) => delete mem[k] },
    mem,
  };
};

test("repairOnStart: prunes what her sends found dead and clears the list from the live doc", async () => {
  const s = await new MemoryStore("pushroom0000000000000000").ready();
  await s.update((db) => (db.settings.push = [sub(1), sub(2)]));
  await s.put("live", "quiz", { opened: "o", dead: [epHash(sub(1).endpoint)] });
  const out = await repairOnStart(s, fakeEnv(null, "default"));
  assert.equal(out.pruned, 1);
  assert.deepEqual(s.get().settings.push, [sub(2)]);
  assert.equal(s.doc("live", "quiz").dead, undefined);
  assert.equal(s.doc("live", "quiz").opened, "o");
});

test("repairOnStart: replaces this phone's stale entry with its current subscription", async () => {
  const s = await new MemoryStore("pushroom0000000000000001").ready();
  await s.update((db) => (db.settings.push = [sub(1), sub(2)]));
  const env = fakeEnv(sub(5));
  env.st.setItem("wte.pushEp", sub(1).endpoint);
  const out = await repairOnStart(s, env);
  assert.equal(out.replaced, true);
  assert.deepEqual(s.get().settings.push.map((x) => x.endpoint.slice(-1)), ["2", "5"]);
  assert.equal(env.mem["wte.pushEp"], sub(5).endpoint);
  assert.equal((await repairOnStart(s, env)).replaced, false);
});

test("repairOnStart: creates a missing subscription when notifications were on; does nothing when they never were or are blocked", async () => {
  const s = await new MemoryStore("pushroom0000000000000002").ready();
  const env = fakeEnv(null);
  env.st.setItem("wte.pushEp", sub(1).endpoint);
  assert.equal((await repairOnStart(s, env)).replaced, true);
  assert.equal(s.get().settings.push[0].endpoint, sub(7).endpoint);
  const t = await new MemoryStore("pushroom0000000000000003").ready();
  assert.equal((await repairOnStart(t, fakeEnv(sub(5)))).replaced, false);
  assert.equal((await repairOnStart(t, fakeEnv(sub(5), "denied"))).replaced, false);
  assert.deepEqual(t.get().settings.push ?? [], []);
});

test("sw.js: pushsubscriptionchange resubscribes with the same key and tells open pages", async () => {
  const src = readFileSync("sw.js", "utf8");
  assert.ok(src.includes(`VAPID_PUBLIC_KEY = "${VAPID_PUBLIC_KEY}"`), "sw.js key matches js/push.js");
  const handlers = {};
  const posted = [];
  const subscribed = [];
  const self = {
    addEventListener: (n, f) => (handlers[n] = f),
    location: { href: "https://x.test/sw.js" },
    registration: { pushManager: { subscribe: async (o) => (subscribed.push(o), { toJSON: () => sub(8) }) } },
    clients: { matchAll: async () => [{ postMessage: (m) => posted.push(m) }] },
  };
  vm.runInNewContext(src, { self, importScripts() {}, atob, Uint8Array, URL, console });
  assert.equal(typeof handlers.pushsubscriptionchange, "function");
  let waited;
  handlers.pushsubscriptionchange({ waitUntil: (p) => (waited = p), oldSubscription: { options: { applicationServerKey: "OLDKEY" } } });
  await waited;
  assert.equal(subscribed[0].applicationServerKey, "OLDKEY");
  assert.deepEqual(JSON.parse(JSON.stringify(posted)), [{ type: "wte-sub-changed", sub: sub(8) }]);
  handlers.pushsubscriptionchange({ waitUntil: (p) => (waited = p) });
  await waited;
  assert.equal(subscribed[1].applicationServerKey.length, 65);
});

test("receiptLine shows the delivery receipt only on a finished quiz", () => {
  assert.equal(receiptLine(null), "");
  assert.equal(receiptLine({ finished: true }), "");
  assert.equal(receiptLine({ finished: true, push: { ok: true, codes: [201] } }), "ההתראה אליך נשלחה ✓");
  assert.ok(receiptLine({ finished: true, push: { ok: false, codes: [410] } }).includes("✗"));
  assert.equal(receiptLine({ finished: false, push: { ok: true } }), "");
});
