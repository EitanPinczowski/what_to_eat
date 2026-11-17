// R2 (2026-11-17): learning pools the plain-button wordings of one axis under "~axis:slot".
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { buildFoods } from "../js/engine/foods.js";
import { learnFrom, poolKey } from "../js/engine/learn.js";
import { FoodQuiz } from "../js/engine/quiz.js";

const foods = buildFoods(FOODS);
const q = (id) => QUESTIONS.find((x) => x.id === id);
const day = (i) => new Date(Date.UTC(2026, 10, 1 + i)).toISOString();
// Two wordings of body (slot 0, "tired"), each seen once, both ending in sushi; plus filler quizzes.
const hist = [
  { f: "sushi", ans: ["body1:0"], at: day(0) },
  { f: "sushi", ans: ["body2:0"], at: day(1) },
  ...["pizza", "burger", "falafel", "hummus"].map((f, i) => ({ f, ans: ["hunger1:1"], at: day(2 + i) })),
];

test("pool key: plain-button variants only", () => {
  assert.equal(poolKey(q("body1"), 0), "~body:0");
  assert.equal(poolKey(q("hunger4"), 0), null); // slider
  assert.equal(poolKey(q("mood5"), 0), null); // colour, own effects
  assert.equal(poolKey(q("family1"), 0), null); // multi-pick
});

test("each wording alone is seen once (too few); pooled, the axis learns", () => {
  const own = learnFrom(hist, foods);
  assert.equal(own["body1:0"], undefined);
  assert.equal(own["~body:0"], undefined); // no questions given: old behaviour, no pooled keys
  const pooled = learnFrom(hist, foods, QUESTIONS);
  assert.ok(pooled["~body:0"]?.japanese > 0, JSON.stringify(pooled["~body:0"]));
});

test("the engine uses the pooled bonus for any wording, and its own key first", () => {
  const learned = learnFrom(hist, foods, QUESTIONS);
  const z = new FoodQuiz(foods, QUESTIONS, {}, { learned });
  const plain = new FoodQuiz(foods, QUESTIONS);
  const sushi = z.byId.get("sushi");
  const b3 = q("body3");
  assert.ok(z.delta(sushi, b3, b3.answers[0]) > plain.delta(sushi, b3, b3.answers[0]));
  const own = new FoodQuiz(foods, QUESTIONS, {}, { learned: { ...learned, "body3:0": { japanese: -1 } } });
  assert.ok(own.delta(sushi, b3, b3.answers[0]) < plain.delta(sushi, b3, b3.answers[0]));
});
