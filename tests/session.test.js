import { test } from "node:test";
import assert from "node:assert/strict";
import { withTimeout, ping, resultEntry } from "../js/ui/guest/session.js";
import { makeQuiz, applyAction } from "../js/ui/guest/quiz.js";
import { emptyRoom } from "../js/store/store.js";

test("withTimeout rejects slow promises", async () => {
  assert.equal(await withTimeout(Promise.resolve(1), 50), 1);
  await assert.rejects(withTimeout(new Promise(() => {}), 10), /timeout/);
});

test("ping posts a minimal message only when a topic is set", async () => {
  const calls = [];
  const f = async (url, o) => calls.push([url, o.body]);
  assert.equal(await ping("", "x", f), false);
  assert.equal(await ping("topic1", "נגה סיימה", f), true);
  assert.deepEqual(calls, [["https://ntfy.sh/topic1", "נגה סיימה"]]);
  assert.equal(await ping("t", "x", async () => { throw new Error("net"); }), false);
});

test("resultEntry trims and fills defaults", () => {
  const e = resultEntry({ result: { free: "מרק" }, food: null, trail: Array(50).fill("x".repeat(200)), top: ["a"] }, { note: "n".repeat(400) }, "2026-01-01");
  assert.equal(e.f, null);
  assert.equal(e.fn, "מרק");
  assert.equal(e.m, "any");
  assert.equal(e.note.length, 300);
  assert.equal(e.trail.length, 40);
  assert.equal(e.trail[0].length, 120);
});

test("replaying recorded actions rebuilds the same engine state", () => {
  const room = emptyRoom();
  const now = new Date(2026, 0, 1, 13);
  const a = makeQuiz(room, [], { now, rnd: () => 0.3 });
  const log = [{ k: "a", q: "hunger", i: 2 }, { k: "a", q: "vibe", i: -1 }, { k: "g", v: ["pizza"] }, { k: "x", f: "sushi", r: "no" }, { k: "d", a: "burger", b: "falafel", c: "a" }];
  for (const x of log) applyAction(a, x);
  const b = makeQuiz(room, [], { now, rnd: () => 0.9 });
  for (const x of log) applyAction(b, x);
  assert.deepEqual(b.s, a.s);
  applyAction(b, { k: "c", t: "פיצה" });
  assert.deepEqual(b.result, { f: "pizza" });
});
