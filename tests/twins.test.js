// Item 15: near-twin foods can be told apart. With a perfect guest who answers every question by her own food,
// no other food may score as high as hers (otherwise it can never be the top guess). Deterministic, no randomness.
import test from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { buildFoods } from "../js/engine/foods.js";
import { FoodQuiz } from "../js/engine/quiz.js";

test("every food beats every other food when answered by its own best answers", () => {
  const z = new FoodQuiz(buildFoods(FOODS), QUESTIONS);
  const bad = [];
  for (const X of z.foods) {
    const tot = new Map(z.foods.map((f) => [f.id, 0]));
    for (const q of QUESTIONS) {
      const ds = q.answers.map((a) => z.delta(X, q, a));
      const max = Math.max(...ds);
      if (ds.every((d) => d === 0)) continue; // no answer fits her food: she leans, so nothing to compare
      const best = ds.map((d, i) => (d === max ? i : -1)).filter((i) => i >= 0);
      for (const f of z.foods) tot.set(f.id, tot.get(f.id) + best.reduce((s, i) => s + z.delta(f, q, q.answers[i]), 0) / best.length);
    }
    for (const [id, v] of tot) if (id !== X.id && v >= tot.get(X.id)) bad.push(`${X.id} <- ${id}`);
  }
  assert.deepEqual(bad, []);
});
