import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { buildFoods } from "../js/engine/foods.js";
import { learnFrom, statsFrom, nudgeExp, MIN_QUIZZES } from "../js/engine/learn.js";
import { priorFrom } from "../js/engine/prior.js";
import { FoodQuiz } from "../js/engine/quiz.js";

const foods = buildFoods(FOODS);

test("learnFrom needs ≥5 quizzes, then learns answer→tag bonuses within ±1.5", () => {
  const e = (f, ans) => ({ f, ans });
  assert.deepEqual(learnFrom([e("sushi", ["vibe:1"])], foods), {});
  // Every time she says "vibe: fancy" she picks sushi/poke (japanese); other times burgers.
  const hist = [e("sushi", ["vibe:1"]), e("poke", ["vibe:1"]), e("sushi", [["vibe", 1]]), e("burger", ["vibe:3"]), e("burger", ["vibe:3"])];
  assert.equal(hist.length, MIN_QUIZZES);
  const L = learnFrom(hist, foods);
  assert.ok(L["vibe:1"].japanese > 0);
  assert.ok(L["vibe:3"].japanese < 0);
  for (const m of Object.values(L)) for (const v of Object.values(m)) assert.ok(Math.abs(v) <= 1.5);
});

test("learned bonuses apply only to tags the answer doesn't already score", () => {
  const q = QUESTIONS.find((x) => x.id === "vibe");
  const z = new FoodQuiz(foods, QUESTIONS, {}, { learned: { "vibe:1": { japanese: 1, fancy: 1 } } });
  const plain = new FoodQuiz(foods, QUESTIONS);
  const sushi = z.byId.get("sushi");
  assert.equal(z.delta(sushi, q, q.answers[1]) - plain.delta(sushi, q, q.answers[1]), 1);
});

test("statsFrom: hit rate, average steps, most skipped question", () => {
  assert.equal(statsFrom([{}]), null);
  const st = statsFrom([{ stats: { hit: true, steps: 8, skips: ["temp"] } }, { stats: { hit: false, steps: 12, skips: ["temp", "how"] } }]);
  assert.equal(st.hitRate, 0.5);
  assert.equal(st.avgSteps, 10);
  assert.equal(st.confusing, "temp");
});

test("nudgeExp ±0.5 within ±1; prior uses it only for unrated foods", () => {
  let exp = nudgeExp({}, "pizza", true);
  exp = nudgeExp(exp, "pizza", true);
  exp = nudgeExp(exp, "pizza", true);
  assert.equal(exp.pizza, 1);
  assert.equal(nudgeExp({}, "x", false).x, -0.5);
  const now = new Date(2026, 0, 1, 13);
  assert.equal(priorFrom(foods, { exp: { pizza: 1 }, now }).pizza, 1);
  assert.equal(priorFrom(foods, { exp: { pizza: 1 }, ratings: { pizza: { r: 3 } }, now }).pizza, 1);
  assert.equal(priorFrom(foods, { exp: { pizza: -1 }, ratings: { pizza: { r: 4 } }, now }).pizza, 2.5);
});
