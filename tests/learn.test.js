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
  assert.deepEqual(learnFrom([e("sushi", ["mood1:2"])], foods), {});
  // Every time she says "mood1: fancy" she picks sushi/poke (japanese); other times burgers.
  const hist = [e("sushi", ["mood1:2"]), e("poke", ["mood1:2"]), e("sushi", [["mood1", 2]]), e("burger", ["mood1:0"]), e("burger", ["mood1:0"])];
  assert.equal(hist.length, MIN_QUIZZES);
  const L = learnFrom(hist, foods);
  assert.ok(L["mood1:2"].japanese > 0);
  assert.ok(L["mood1:0"].japanese < 0);
  for (const m of Object.values(L)) for (const v of Object.values(m)) assert.ok(Math.abs(v) <= 1.5);
});

test("learned bonuses apply only to tags the answer doesn't already score", () => {
  const q = QUESTIONS.find((x) => x.id === "mood1");
  const z = new FoodQuiz(foods, QUESTIONS, {}, { learned: { "mood1:2": { japanese: 1, fancy: 1 } } });
  const plain = new FoodQuiz(foods, QUESTIONS);
  const sushi = z.byId.get("sushi");
  assert.equal(z.delta(sushi, q, q.answers[2]) - plain.delta(sushi, q, q.answers[2]), 1);
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

test("hitFrom: the one definition of first-guess hit, top-3 hit and rank", async () => {
  const { hitFrom, rankIn, statsRank } = await import("../js/engine/learn.js");
  assert.deepEqual(hitFrom(1), { rank: 1, hit: true, first: true, top3: true });
  assert.deepEqual(hitFrom(3), { rank: 3, hit: true, first: false, top3: true });
  assert.deepEqual(hitFrom(4), { rank: 4, hit: true, first: false, top3: false });
  assert.deepEqual(hitFrom(0), { rank: 0, hit: false, first: false, top3: false });
  assert.equal(rankIn(["a", "b", "c"], "c"), 3);
  assert.equal(rankIn(["a"], "z"), 0);
  assert.equal(statsRank({ hit: true, guesses: 2 }), 2);
  assert.equal(statsRank({ hit: true }), 1);
  assert.equal(statsRank({ hit: false, guesses: 3 }), 0);
  assert.equal(statsRank(undefined), 0);
});
