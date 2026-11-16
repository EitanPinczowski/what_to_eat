// W5b: face-off weights, fridge magnets, holidays and heatwave, mood memory, the chef.
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS } from "../js/data/questions.js";
import { FoodQuiz, FINALIST_W, typeOf } from "../js/engine/quiz.js";
import { FOODS } from "../js/data/foods.js";
import { buildFoods } from "../js/engine/foods.js";
import { holidayOf, heatwave, seasonBump, HOLIDAYS } from "../js/data/holidays.js";
import { priorFrom } from "../js/engine/prior.js";
import { moodMemory } from "../js/engine/mood-memory.js";
import { applyAction } from "../js/ui/guest/quiz.js";
import { chefHtml, STATES } from "../js/ui/guest/chef.js";
import { STR } from "../js/data/strings.js";
import { PLAY } from "../js/data/strings-play.js";

const byId = (id) => QUESTIONS.find((q) => q.id === id);
const foods = buildFoods(FOODS, []);
const fresh = () => new FoodQuiz(foods, QUESTIONS, {}, { shuffle: false });
const delta = (z, f) => z.s.score[f];

test("the bank has a magnets and a face-off variant, in the right axes and stages", () => {
  assert.equal(typeOf(byId("family4")), "magnets");
  assert.equal(byId("family4").answers.length, 6);
  assert.equal(byId("family4").stage, 3);
  assert.equal(typeOf(byId("mood7")), "faceoff");
  assert.equal(byId("mood7").answers.length, 4);
  assert.equal(byId("mood7").stage, 2);
});

test("face-off: winner counts fully, finalist FINALIST_W (0.4); pairs stay 0.6 each", () => {
  const q = byId("mood7"), a = fresh(), b = fresh(), c = fresh(), d = fresh();
  a.answer(q, [0, 2]);
  b.answer(q, 0); // the winner alone
  c.answer(q, 2); // the finalist alone
  d.answer(byId("family4"), [0, 1]);
  assert.equal(FINALIST_W, 0.4);
  for (const f of foods.slice(0, 40)) {
    const w = delta(b, f.id), fin = delta(c, f.id);
    assert.ok(Math.abs(delta(a, f.id) - (w + 0.4 * fin)) < 1e-9, f.id);
  }
  const m = byId("family4"), e = fresh();
  e.answer(m, 0);
  const g = fresh();
  g.answer(m, 1);
  for (const f of foods.slice(0, 40)) assert.ok(Math.abs(delta(d, f.id) - 0.6 * (delta(e, f.id) + delta(g, f.id))) < 1e-9);
  assert.ok(a.trail[0].includes("›"));
});

test("undo and resume replay a face-off and a pair exactly", () => {
  const log = [{ k: "a", q: "mood7", i: [1, 3] }, { k: "a", q: "family4", i: [2, 4] }, { k: "a", q: "hunger1", i: 1 }];
  const z = fresh();
  for (const a of log) applyAction(z, a);
  const again = fresh();
  for (const a of JSON.parse(JSON.stringify(log))) applyAction(again, a); // as saved and reloaded
  assert.deepEqual(again.s.score, z.s.score);
  assert.deepEqual(again.trail, z.trail);
  const before = fresh();
  applyAction(before, log[0]);
  const snap = structuredClone(before.s.score);
  applyAction(before, log[1]);
  assert.ok(before.undo());
  assert.deepEqual(before.s.score, snap);
});

test("holidays: dates for 2026-2029, only the 3 holidays", () => {
  assert.deepEqual(Object.keys(HOLIDAYS).sort(), ["hanukkah", "purim", "shavuot"]);
  assert.equal(holidayOf(new Date(2026, 11, 8)), "hanukkah");
  assert.equal(holidayOf(new Date(2027, 11, 31)), "hanukkah");
  assert.equal(holidayOf(new Date(2028, 2, 12)), "purim");
  assert.equal(holidayOf(new Date(2029, 4, 20)), "shavuot");
  assert.equal(holidayOf(new Date(2026, 10, 16)), null);
  for (const rows of Object.values(HOLIDAYS)) for (const [a, b] of rows) assert.ok(a <= b && /^\d{4}-\d\d-\d\d$/.test(a) && /^2\d\d\d/.test(a));
});

test("holidays and a 32+ heatwave nudge the prior; the opening lines exist", () => {
  const f = buildFoods(FOODS, []);
  const day = new Date(2026, 11, 8, 13), plain = new Date(2026, 10, 16, 13);
  const h = priorFrom(f, { now: day }), p = priorFrom(f, { now: plain });
  assert.ok(h.sufganiya - p.sufganiya > 0.9);
  const hot = priorFrom(f, { now: plain, weather: { temp: 33 } }), warm = priorFrom(f, { now: plain, weather: { temp: 31 } });
  const ice = f.find((x) => x.tags.includes("cold") && x.tags.includes("light"));
  assert.ok(hot[ice.id] - warm[ice.id] > 0.4);
  assert.ok(heatwave({ temp: 32 }) && !heatwave({ temp: 31.9 }) && !heatwave(null) && !heatwave({}));
  assert.equal(seasonBump(ice, null, false), 0);
  for (const k of ["hanukkah", "purim", "shavuot", "heat"]) assert.ok(STR.holiday[k]);
});

test("mood memory: only with at least 3 matching quizzes, at most 2 lines", () => {
  const e = (fn, ans) => ({ at: "2026-10-05T10:00:00Z", fn, f: fn, ans });
  assert.deepEqual(moodMemory([e("ראמן", ["mood1:0"]), e("ראמן", ["mood2:0"])], "2026-10"), []); // 2 quizzes
  const three = [e("ראמן", ["mood1:0"]), e("ראמן", ["mood2:0"]), e("פיצה", ["mood4:0"])];
  assert.deepEqual(moodMemory(three, "2026-10"), [[0, "ראמן", 2]]);
  const many = [...three, e("סושי", ["mood1:2"]), e("סושי", ["mood3:2"]), e("סושי", ["mood1:2"]), e("חומוס", ["mood1:1"])];
  const mm = moodMemory(many, "2026-10");
  assert.ok(mm.length <= 2);
  assert.ok(PLAY.moodLine(0, "ראמן", 3).includes("ראמן 3 פעמים"));
});

test("the chef has 4 states and a label", () => {
  assert.deepEqual(STATES, ["idle", "nod", "drool", "cheer"]);
  for (const s of STATES) assert.ok(chefHtml(s).includes(`data-state="${s}"`));
  assert.ok(chefHtml("zzz").includes('data-state="idle"'));
});
