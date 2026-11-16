import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { buildFoods } from "../js/engine/foods.js";
import { learnFrom } from "../js/engine/learn.js";
import { prunedVariants, variantImpact, MIN_VARIANTS } from "../js/engine/prune.js";
import { FoodQuiz } from "../js/engine/quiz.js";
import { insightsHtml } from "../js/ui/owner/insights.js";

const foods = buildFoods(FOODS);
const e = (f, ans, at, how) => ({ f, ans, at, ...(how ? { how } : {}) });
const day = (n) => new Date(2026, 4, 1 + n).toISOString();
const base = [e("sushi", ["mood1:2"], day(0)), e("poke", ["mood1:2"], day(1)), e("sushi", ["mood1:2"], day(2)), e("burger", ["mood1:0"], day(3)), e("burger", ["mood1:0"], day(4))];

test("learnFrom: bounded, deterministic, and old quizzes weigh less (half-life 60 days)", () => {
  const L = learnFrom(base, foods);
  assert.deepEqual(L, learnFrom(base, foods));
  for (const fx of Object.values(L)) for (const v of Object.values(fx)) assert.ok(Math.abs(v) <= 1.5);
  // the same answer once meant sushi (long ago), now means burgers: the newer habit wins when decayed, the old one when all weigh the same
  const habit = (oldAt, newAt) => [0, 1, 2, 3].map((i) => e("sushi", ["m:1"], oldAt(i))).concat([0, 1, 2, 3, 4].map((i) => e("burger", ["m:1"], newAt(i)))).concat([e("pizza", ["m:0"], newAt(5)), e("pizza", ["m:0"], newAt(6))]);
  const fresh = learnFrom(habit((i) => day(i - 400), (i) => day(i)), foods)["m:1"];
  const flat = learnFrom(habit((i) => day(i), (i) => day(i + 4)), foods)["m:1"];
  assert.ok(fresh.meaty > flat.meaty); // burger tag
});

test("learnFrom: howItWas raises or lowers the tags of that food for the answers chosen then", () => {
  const L0 = learnFrom(base, foods)["mood1:2"].japanese;
  const up = learnFrom(base.map((x, i) => (i === 0 ? { ...x, how: 1 } : x)), foods)["mood1:2"].japanese;
  const down = learnFrom(base.map((x, i) => (i === 0 ? { ...x, how: -1 } : x)), foods)["mood1:2"].japanese;
  assert.ok(up > L0 && down < L0);
  const many = learnFrom(Array.from({ length: 30 }, (_, i) => e("sushi", ["mood1:2"], day(i), 1)).concat(base.slice(3)), foods);
  assert.ok(Object.values(many).every((fx) => Object.values(fx).every((v) => Math.abs(v) <= 1.5)));
});

// A history where answering the variant q never changes the top 3 (an answer with no effect on the foods) is dropped after 20 asks.
test("prunedVariants: 20+ asks and <10% impact drop a variant, never below 2 per axis", () => {
  const axis = QUESTIONS[0].axis;
  const vs = QUESTIONS.filter((q) => q.axis === axis);
  const hist = Array.from({ length: 25 }, (_, k) => ({ f: "pizza", at: day(k), ans: vs.map((q) => `${q.id}:0`) }));
  const drop = prunedVariants(hist, foods, QUESTIONS);
  const impact = variantImpact(hist, foods, QUESTIONS);
  for (const d of drop) assert.ok(impact[d.id].asked >= 20 && d.rate < 10);
  for (const a of new Set(QUESTIONS.map((q) => q.axis))) {
    const n = QUESTIONS.filter((q) => q.axis === a).length;
    assert.ok(n - drop.filter((d) => d.axis === a).length >= Math.min(n, MIN_VARIANTS));
  }
  assert.deepEqual(prunedVariants(hist.slice(0, 5), foods, QUESTIONS), []);
});

test("FoodQuiz: dropped variants leave the rotation but an axis keeps at least 2", () => {
  const axis = QUESTIONS[0].axis;
  const vs = QUESTIONS.filter((q) => q.axis === axis);
  const z = new FoodQuiz(foods, QUESTIONS, {}, { rnd: () => 0.5, drop: [vs[0].id] });
  for (let i = 0; i < 20; i++) {
    z.s.asked = [`x${i}`];
    assert.notEqual(z.variant(axis).id, vs[0].id);
  }
  const all = new FoodQuiz(foods, QUESTIONS, {}, { rnd: () => 0.5, drop: vs.map((q) => q.id) });
  assert.ok(all.variant(axis));
});

test("insights screen lists pruned variants", () => {
  const x = { enough: true, month: {}, funnel: [], decision: null, places: [], rejected: [], weather: [], weekday: [], useless: [], pruned: [{ id: "q1", text: "שאלה", asked: 22, rate: 4 }] };
  assert.match(insightsHtml(x), /שאלה · שינתה ב-4%/);
});
