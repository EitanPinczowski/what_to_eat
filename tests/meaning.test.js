// R1 question meaning: one job per question, chips in her words, opener by moment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS } from "../js/data/questions.js";
import { FOODS } from "../js/data/foods.js";
import { buildFoods } from "../js/engine/foods.js";
import { FoodQuiz } from "../js/engine/quiz.js";
import { cravingSummary } from "../js/engine/mood.js";

test("light/heavy are judged by one job: only the `after` axis and a hungry dinosaur touch them", () => {
  const axes = new Set();
  for (const q of QUESTIONS) if (q.answers.some((a) => "light" in a.fx || "heavy" in a.fx)) axes.add(q.axis);
  const extra = [...axes].filter((a) => !["after", "hunger", "family"].includes(a));
  assert.deepEqual(extra, [], "light/heavy leaked into another axis");
});

test("chips speak her words: a short answer text, else the tag's adjective; the line keeps adjectives", () => {
  const r = cravingSummary([["family1", 0], ["mood1", 0]]);
  const sweet = r.chips.find((c) => c.tag === "sweet");
  assert.equal(sweet.words, "מתוק");
  assert.ok(r.chips.every((c) => c.words && c.label));
  const long = cravingSummary([["vibe1", 0]]).chips.find((c) => c.tag === "home");
  assert.ok(long.words.split(" ").length <= 3 && long.words);
  assert.ok(cravingSummary([["warmth1", 0, true]]).chips.every((c) => c.words === c.label));
});

test("opener by moment: the first question fits the hour", () => {
  const foods = buildFoods(FOODS);
  const first = (moment, salt) => new FoodQuiz(foods, QUESTIONS, {}, { moment, salt, rnd: () => 0.5 }).variant("hunger").id;
  for (let i = 0; i < 40; i++) {
    assert.notEqual(first("morning", String(i)), "hunger2");
    assert.notEqual(first("evening", String(i)), "hunger3");
    assert.notEqual(first("late", String(i)), "hunger3");
  }
  assert.ok(first(null, "x"));
});
