import { test } from "node:test";
import assert from "node:assert/strict";
import { checkinAt, canOffer, scheduleBody, acceptCheckin, mountCheckin } from "../js/ui/guest/checkin.js";
import { parseHash } from "../js/share/links.js";
import "../js/sw-format.js";

const sub = { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "p", auth: "a" }, extra: 1 };

test("checkinAt: next Israel calendar day, across the date line and month ends", () => {
  assert.equal(checkinAt(new Date("2026-11-16T10:00:00Z")), "2026-11-17");
  assert.equal(checkinAt(new Date("2026-11-16T22:30:00Z")), "2026-11-18"); // already the 17th in Israel
  assert.equal(checkinAt(new Date("2026-12-31T12:00:00Z")), "2027-01-01");
});

test("canOffer / scheduleBody", () => {
  assert.equal(canOffer("pizza", "off"), true);
  assert.equal(canOffer(null, "off"), false);
  assert.equal(canOffer("pizza", "blocked"), false);
  assert.equal(canOffer("pizza", "unsupported"), false);
  assert.deepEqual(scheduleBody(sub, "pizza", "2026-11-17"), { sub: { endpoint: sub.endpoint, keys: sub.keys }, food: "pizza", at: "2026-11-17" });
});

test("acceptCheckin: subscribes only when called, posts to schedule, maps outcomes", async () => {
  const calls = [];
  const mk = (over) => ({ subscribeThisDevice: async () => sub, boundRoomId: () => "r", SCHEDULE_URL: "u/schedule", postSigned: async (...a) => (calls.push(a), 201), ...over });
  assert.equal(await acceptCheckin("pizza", { push: mk(), now: new Date("2026-11-16T10:00:00Z") }), "ok");
  assert.equal(calls[0][0], "u/schedule");
  assert.deepEqual(calls[0][1].food, "pizza");
  assert.equal(calls[0][1].at, "2026-11-17");
  assert.equal(await acceptCheckin("pizza", { push: mk({ subscribeThisDevice: async () => { throw new Error("denied"); } }) }), "denied");
  assert.equal(await acceptCheckin("pizza", { push: mk({ postSigned: async () => 401 }) }), "fail");
});

test("mountCheckin: shows the question only; no subscribe without a tap", async () => {
  let subscribed = 0;
  const handlers = [];
  const el = { innerHTML: "", addEventListener: (_, f) => handlers.push(f) };
  const push = { pushFood: (f) => f, pushSupport: () => "off", subscribeThisDevice: async () => (subscribed++, sub) };
  await mountCheckin(el, "pizza", { push });
  assert.match(el.innerHTML, /רוצה שאזכיר לך מחר/);
  assert.equal(subscribed, 0);
  const el2 = { innerHTML: "x", addEventListener() {} };
  await mountCheckin(el2, "pizza", { push: { pushFood: (f) => f, pushSupport: () => "blocked" } });
  assert.equal(el2.innerHTML, "x");
});

test("#how routes; check-in notification text names the food", () => {
  assert.deepEqual(parseHash("#how"), { kind: "how" });
  const n = globalThis.wteFormatPush({ title: "t", body: "b", kind: "checkin", food: "pizza" }, { pizza: ["פיצה", "🍕"] });
  assert.equal(n.body, "איך היה הפיצה אתמול? 🍕");
  assert.equal(n.tag, "wte-checkin");
});
