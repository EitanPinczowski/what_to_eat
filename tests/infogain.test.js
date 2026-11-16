// Item 14: every step is chosen by expected information gain, with soft (noisy) answers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { buildFoods } from "../js/engine/foods.js";
import { FoodQuiz, NOISE_EPS } from "../js/engine/quiz.js";

const foods = buildFoods(FOODS);
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const q = (axis, k = 1) => QUESTIONS.find((x) => x.id === axis + k); // the first variant of an axis
const make = (qs = QUESTIONS) => new FoodQuiz(foods, qs, {}, { rnd: seeded(), pickBelow: 0 });

test("info gain: a splitting question beats a useless one", () => {
  const z = make();
  const ranked = z.ranked();
  const useless = { id: "nothing", text: "?", answers: [{ e: "a", t: "a", fx: {} }, { e: "b", t: "b", fx: {} }] };
  const split = { id: "split", text: "?", answers: [{ e: "a", t: "a", fx: { sweet: 3 } }, { e: "b", t: "b", fx: { salty: 3 } }] };
  assert.ok(z.value(useless, ranked) < 1e-9);
  assert.ok(z.value(split, ranked) > 0.05);
  assert.ok(z.value(q("hunger"), ranked) > z.value(useless, ranked));
});

test("information gain falls once a question's split is already known", () => {
  const z = make();
  const before = z.value(q("family"), z.ranked());
  z.answer(q("family"), 0); // sweet
  const sweetOnly = z.ranked().filter((x) => x.p > 0.002);
  assert.ok(z.value(q("family"), sweetOnly) < before);
});

test("one contradicting answer does not drop the true food out of the top 5", () => {
  const target = foods.find((f) => f.id === "shawarma");
  const z = make();
  for (const id of ["hunger", "world", "vibe", "family", "warmth", "bite"]) {
    const qq = q(id);
    const ds = qq.answers.map((a) => z.delta(target, qq, a));
    z.answer(qq, ds.indexOf(Math.max(...ds)));
  }
  assert.ok(z.ranked().slice(0, 5).some((x) => x.f.id === "shawarma"), "shawarma in top 5 before the slip");
  // she taps the opposite on the next question (a wrong answer)
  const qq = q("after");
  const ds2 = qq.answers.map((a) => z.delta(target, qq, a));
  z.answer(qq, ds2.indexOf(Math.min(...ds2)));
  const ids = z.ranked().slice(0, 5).map((x) => x.f.id);
  assert.ok(ids.includes("shawarma"), `shawarma survived one wrong answer, got ${ids}`);
  assert.ok(NOISE_EPS > 0);
});

test("a wrong world tap does not remove the right food", () => {
  const z = make();
  z.answer(q("hunger"), 1);
  z.answer(q("world"), 0); // home and familiar, but she wants sushi
  const r = z.ranked();
  assert.ok(r.findIndex((x) => x.f.id === "sushi") < r.length - 1);
  assert.ok(r.find((x) => x.f.id === "sushi").p > 0);
});

test("the hunger question is first; the same axis is never asked twice", () => {
  const z = make();
  const seen = [];
  for (let i = 0; i < 25; i++) {
    const s = z.next();
    if (s.type !== "q") break;
    seen.push(s.q);
    z.answer(s.q, 0);
  }
  assert.equal(seen[0].axis, "hunger");
  assert.equal(new Set(seen.map((x) => x.axis)).size, seen.length);
  assert.ok(seen.length <= 7);
});

test("grid and duel come only when they score best", () => {
  const z = make();
  z.answer(q("hunger"), 1);
  z.answer(q("family"), 0);
  z.answer(q("vibe"), 0);
  const ranked = z.ranked();
  const best = z.bestQuestion(ranked);
  const grid = z.gridGain(ranked);
  const [a, b] = z.duelPair(ranked);
  const duel = z.duelGain(ranked, a, b);
  const s = z.next();
  const top = Math.max(best?.v ?? 0, grid, duel);
  const kind = top === (best?.v ?? 0) ? "q" : top === grid ? "grid" : "duel";
  assert.equal(s.type, kind);
  // no question left worth asking: a grid or duel (the best remaining gain) comes instead of a question
  const only = new FoodQuiz(foods, QUESTIONS.filter((x) => x.axis === "hunger"), {}, { rnd: seeded(), pickBelow: 0 });
  only.answer(q("hunger"), 1);
  only.s.n = 3;
  assert.ok(["grid", "duel"].includes(only.next().type));
  // with the best question's gain forced to zero a grid/duel beats it; with them used up, a question is back
  z.s.gridDone = true;
  z.s.duels = 1;
  assert.equal(z.nextStep().type === "q" || z.nextStep().type === "pick" || z.nextStep().type === "guess", true);
});

test("undo returns to the very same step", () => {
  const z = make();
  const s1 = z.next();
  z.answer(s1.q, 0);
  const s2 = z.next();
  z.answer(s2.q, 0);
  z.undo();
  assert.equal(z.next().q?.id, s2.q.id);
});
