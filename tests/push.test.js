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
