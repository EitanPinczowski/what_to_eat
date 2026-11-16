// Event log (item 29): what Store.put turns into events, that it never blocks or breaks a write, and the reader.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../js/store/memory.js";
import { eventsFor, record, loadEvents, deviceType, EVENT_KINDS } from "../js/store/events.js";

const ctx = { now: Date.UTC(2026, 10, 16, 18, 30), dv: "phone", w: "rain" };
const T0 = "2026-11-16T18:00:00.000Z";
const T1 = "2026-11-16T18:00:07.000Z";

test("eventsFor: sent, opened, step with seconds since the previous save, finish, push", () => {
  assert.deepEqual(eventsFor("live", "quiz", { sentAt: T0, finished: false }, null, ctx).map((e) => e.k), ["sent"]);
  assert.deepEqual(eventsFor("live", "quiz", { sentAt: T0, opened: T1, actions: [], n: 0, at: T1 }, { sentAt: T0 }, ctx).map((e) => e.k), ["opened"]);
  const step = eventsFor("live", "quiz", { opened: T0, actions: [{ k: "a", q: "hungry", i: 2 }], n: 1, at: T1 }, { opened: T0, actions: [], at: T0 }, ctx);
  assert.deepEqual(step.map((e) => [e.k, e.q, e.a, e.t, e.n]), [["step", "hungry", 2, 7, 1]]);
  const fin = eventsFor("live", "quiz", { opened: T0, finished: true, n: 9, at: T1 }, { opened: T0, finished: false }, ctx);
  assert.deepEqual(fin.map((e) => [e.k, e.t, e.n]), [["finish", 7, 9]]);
  const push = eventsFor("live", "quiz", { opened: T0, finished: true, push: { ok: true, codes: [201, 201] }, at: T1 }, { opened: T0, finished: true }, ctx);
  assert.deepEqual(push.map((e) => [e.k, e.ok, e.n]), [["push", true, 2]]);
  assert.equal(eventsFor("live", "quiz", { opened: T0, actions: [], n: 0, at: T1 }, { opened: T0, actions: [{ k: "a", q: "x", i: 0 }] }, ctx).length, 0, "undo is not a step");
});

test("eventsFor: every event carries hour, weekday, device and weather when known", () => {
  const [e] = eventsFor("live", "quiz", { sentAt: T0 }, null, ctx);
  assert.equal(e.dv, "phone");
  assert.equal(e.w, "rain");
  assert.equal(e.h, new Date(ctx.now).getHours());
  assert.equal(e.d, new Date(ctx.now).getDay());
  assert.ok(!("w" in eventsFor("live", "quiz", { sentAt: T0 }, null, { ...ctx, w: null })[0]), "no weather key when unknown");
});

test("eventsFor: guess with rank, vote, going, howItWas", () => {
  const g = eventsFor("history", "h1", { f: "pizza", top: ["sushi", "pizza"], at: T0 }, undefined, ctx);
  assert.deepEqual(g.map((e) => [e.k, e.f, e.r, e.n]), [["guess", "pizza", 2, 2]]);
  assert.equal(eventsFor("history", "h1", { f: "pizza", top: ["sushi"] }, undefined, ctx)[0].r, 0, "not in her top list = rank 0");
  assert.deepEqual(eventsFor("live", "vote", { o: ["a", "b"], p: "a" }, { o: ["a", "b"] }, ctx).map((e) => [e.k, e.p]), [["vote", "a"]]);
  const prev = { f: "pizza", top: ["pizza"] };
  assert.deepEqual(eventsFor("history", "h1", { ...prev, goAt: T1, place: "pl1" }, prev, ctx).map((e) => [e.k, e.p]), [["going", "pl1"]]);
  assert.deepEqual(eventsFor("history", "h1", { ...prev, how: -1 }, prev, ctx).map((e) => [e.k, e.a]), [["howItWas", -1]]);
  assert.deepEqual(eventsFor("history", "h1", { ...prev, how: 1 }, { ...prev, how: 1 }, ctx), []);
  for (const e of [...g]) assert.ok(EVENT_KINDS.includes(e.k));
});

test("deviceType", () => {
  assert.equal(deviceType("Mozilla/5.0 (Linux; Android 14; Pixel 7) Mobile Safari", 412), "phone");
  assert.equal(deviceType("Mozilla/5.0 (iPad; CPU OS 17)", 820), "tablet");
  assert.equal(deviceType("Mozilla/5.0 (Windows NT 10.0)", 1400), "desktop");
});

test("put writes events in the background and a failing event write never breaks put", async () => {
  const shared = { rooms: {} };
  const s = new MemoryStore("evroom000000000000000000", shared);
  await s.ready();
  await s.put("live", "quiz", { sentAt: T0, finished: false, at: T0 });
  await s.put("history", "h1", { f: "pizza", top: ["pizza"], at: T0 });
  for (let i = 0; i < 20 && (await loadEvents(s)).length < 2; i++) await new Promise((r) => setTimeout(r, 10));
  const ev = await loadEvents(s);
  assert.deepEqual(ev.map((e) => e.k).sort(), ["guess", "sent"]);
  assert.equal(Object.keys(s.cols).includes("events"), false, "events are not a live collection");

  const bad = new MemoryStore("evroom000000000000000000", shared);
  bad._writeDoc = async (col) => {
    if (col === "events") throw new Error("denied");
  };
  await bad.ready();
  await assert.doesNotReject(bad.put("live", "quiz", { sentAt: T1, at: T1 }));
  await assert.doesNotReject(record(bad, "live", "quiz", { sentAt: "x" }, null));
});
