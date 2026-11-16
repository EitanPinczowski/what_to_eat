// Item 18: learn faster (time-of-day / weekday favourites, rejections, free text reaches the inbox).
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { buildFoods } from "../js/engine/foods.js";
import { priorFrom, dayBand, dayKind, CTX_CAP, REJECT_CAP } from "../js/engine/prior.js";
import { rejectedIds } from "../js/ui/guest/quiz.js";
import { resultEntry } from "../js/ui/guest/session.js";
import { MemoryStore } from "../js/store/memory.js";

const foods = buildFoods(FOODS);
const now = new Date(2026, 5, 10, 20, 0); // Wednesday evening
const ago = (days, hour = 20) => new Date(now.getTime() - days * 864e5 + (hour - 20) * 36e5).toISOString();
const pr = (history) => priorFrom(foods, { now, history });

test("bands and day kinds", () => {
  assert.equal(dayBand(new Date(2026, 5, 10, 8)), "morning");
  assert.equal(dayBand(new Date(2026, 5, 10, 12)), "noon");
  assert.equal(dayBand(new Date(2026, 5, 10, 16)), "afternoon");
  assert.equal(dayBand(new Date(2026, 5, 10, 20)), "evening");
  assert.equal(dayBand(new Date(2026, 5, 10, 2)), "night");
  assert.equal(dayKind(new Date(2026, 5, 12)), "weekend"); // Friday
  assert.equal(dayKind(new Date(2026, 5, 13)), "weekend"); // Saturday
  assert.equal(dayKind(new Date(2026, 5, 14)), "weekday"); // Sunday
});

test("context prior: same band + day kind beats other times, and nothing changes without history", () => {
  const base = pr([]);
  const same = pr([{ f: "pizza", at: ago(7) }]); // Wednesday evening a week ago
  const otherBand = pr([{ f: "pizza", at: ago(7, 8) }]); // Wednesday morning
  const otherKind = pr([{ f: "pizza", at: ago(5) }]); // Friday evening
  const neither = pr([{ f: "pizza", at: ago(5, 8) }]);
  assert.ok(same.pizza > base.pizza);
  assert.ok(same.pizza > otherBand.pizza && same.pizza > otherKind.pizza);
  assert.ok(otherBand.pizza >= neither.pizza && otherKind.pizza >= neither.pizza);
  assert.equal(same.sushi, base.sushi);
});

test("context prior decays with age and is capped", () => {
  const fresh = pr([{ f: "pizza", at: ago(7) }]).pizza - pr([]).pizza;
  const old = pr([{ f: "pizza", at: ago(70) }]).pizza - pr([]).pizza;
  assert.ok(Math.abs(old / fresh - 0.5 ** (63 / 60)) < 0.02);
  const many = Array.from({ length: 40 }, (_, i) => ({ f: "pizza", at: ago(7 * (i + 1)) }));
  const lots = Array.from({ length: 40 }, () => ({ f: "pizza", at: ago(7) }));
  assert.ok(pr(lots).pizza - pr([]).pizza <= CTX_CAP + 1e-9);
  assert.ok(pr(many).pizza - pr([]).pizza <= CTX_CAP + 1e-9);
});

test("rejections lower a food, decay and are capped", () => {
  const base = pr([]).burger;
  const one = pr([{ f: "sushi", at: ago(3), rej: ["burger"] }]).burger;
  const older = pr([{ f: "sushi", at: ago(130), rej: ["burger"] }]).burger;
  assert.ok(one < base && older < base && older > one);
  const lots = Array.from({ length: 30 }, () => ({ at: ago(1), rej: ["burger"] }));
  assert.ok(base - pr(lots).burger <= REJECT_CAP + 1e-9);
  assert.ok(pr([{ at: "garbage", rej: ["burger"] }]).burger === base);
});

test("session records turned-down foods (no / none of these), not the one finally chosen", () => {
  const actions = [{ k: "x", f: "pizza", r: "no" }, { k: "x", f: "sushi", r: "close" }, { k: "n", f: ["burger", "tacos", "pizza"] }, { k: "c", f: "tacos" }];
  assert.deepEqual(rejectedIds(actions, "tacos"), ["pizza", "burger"]);
  const e = resultEntry({ result: { f: "tacos" }, food: { id: "tacos", name: "טאקוס" }, trail: [], rej: ["pizza", "burger"] }, {});
  assert.deepEqual(e.rej, ["pizza", "burger"]);
  assert.equal("rej" in resultEntry({ result: { f: "tacos" }, food: { id: "tacos", name: "x" }, trail: [] }, {}), false);
});

test("free text from a live quiz reaches the inbox once, even after Eitan dismisses it", async () => {
  const s = await new MemoryStore("room1").ready();
  const e = resultEntry({ result: { free: "מרק של סבתא" }, food: null, trail: [] }, {});
  await s.put("history", "h1", { ...e, src: "live" });
  await s.put("history", "h2", { ...resultEntry({ result: { f: "pizza" }, food: { id: "pizza", name: "פיצה" }, trail: [] }, {}), src: "live" });
  assert.equal(await s.collectInbox(), 1);
  assert.deepEqual(s.get().inbox, ["מרק של סבתא"]);
  await s.update((db) => db.inbox.splice(0, 1)); // dismissed
  assert.equal(await s.collectInbox(), 0);
  assert.deepEqual(s.get().inbox, []);
});
