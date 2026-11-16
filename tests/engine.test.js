import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { buildFoods } from "../js/engine/foods.js";
import { jaccard } from "../js/engine/similarity.js";
import { priorFrom } from "../js/engine/prior.js";
import { moodFor } from "../js/engine/mood.js";
import { FoodQuiz } from "../js/engine/quiz.js";

const foods = buildFoods(FOODS);
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const quiz = (prior = {}) => new FoodQuiz(foods, QUESTIONS, prior, { rnd: seeded() });
const q = (id) => QUESTIONS.find((x) => x.id === id);

test("jaccard", () => {
  assert.equal(jaccard(["a", "b"], ["a", "b"]), 1);
  assert.equal(jaccard(["a"], ["b"]), 0);
  assert.equal(jaccard(["a", "b"], ["b", "c"]), 1 / 3);
  assert.equal(jaccard([], []), 0);
});

test("buildFoods adds custom foods, skips duplicate ids", () => {
  const all = buildFoods(FOODS, [{ id: "x", name: "X", emoji: "❓", tags: ["meal"] }, { id: "pizza", name: "P", emoji: "", tags: [] }]);
  assert.equal(all.length, FOODS.length + 1);
  assert.equal(all.at(-1).custom, true);
  assert.deepEqual(foods.find((f) => f.id === "krembo").season, [11, 12, 1, 2, 3]);
});

test("prior: ratings, recent (R2), time of day and season (R12)", () => {
  const noon = new Date(2026, 6, 1, 13);
  const p = priorFrom(foods, { ratings: { sushi: { r: 4 }, pizza: { r: 1 } }, recent: ["shawarma"], now: noon });
  assert.ok(Math.abs(p.sushi - 2.5) < 0.1);
  assert.ok(Math.abs(p.pizza + 8) < 0.2);
  assert.equal(p.shawarma, -1.5);
  assert.ok(p.meorav < 0 && p.meorav > -0.8, "similar to recent is lowered");
  assert.ok(p.krembo <= -1.5 && p.krembo > -1.7, "krembo out of season in July");
  assert.ok(p.omelette < 0, "breakfast off-hours");
  const morning = priorFrom(foods, { now: new Date(2026, 0, 1, 8) });
  assert.equal(morning.omelette, 0.5);
  assert.equal(morning.krembo, 0);
  const late = priorFrom(foods, { now: new Date(2026, 0, 1, 23) });
  assert.equal(late.bamba, 0.5);
});

test("starters come first in order: hunger, then cuisine (item 14); the rest is by information gain", () => {
  const z = quiz();
  const ids = [];
  for (let i = 0; i < 2; i++) {
    const s = z.next();
    assert.equal(s.type, "q");
    ids.push(s.q.id);
    z.answer(s.q, 0);
  }
  assert.deepEqual(ids, ["hunger", "cuisine"]);
});

test("ordered questions keep their order, others shuffle (R10)", () => {
  const z = quiz();
  assert.deepEqual(z.next().order, [0, 1, 2, 3]);
  z.answer(q("hunger"), 2);
  let shuffled = false;
  for (let i = 0; i < 10; i++) {
    const s = new FoodQuiz(foods, QUESTIONS, {}, { rnd: seeded(i + 2) }).qStep(q("vibe"));
    if (s.order.join() !== "0,1,2,3") shuffled = true;
  }
  assert.ok(shuffled);
});

test("answers move scores; skip does not (R5)", () => {
  const z = quiz();
  z.answer(q("hunger"), 0); // snack
  assert.ok(z.s.score.bamba > z.s.score.burger);
  const before = { ...z.s.score };
  z.answer(q("vibe"), -1);
  assert.deepEqual(z.s.score, before);
  assert.equal(z.n, 2);
  assert.match(z.trail.at(-1), /🤷‍♀️/);
});

test("🦖 hunger halves healthy effects (R11)", () => {
  const z = quiz();
  z.answer(q("hunger"), 3);
  assert.equal(z.s.big, true);
  const vibeLight = q("vibe").answers[2];
  const f = z.byId.get("poke");
  assert.equal(z.delta(f, q("vibe"), vibeLight), 2.5 + 2.5 * 0.5);
});

test("weight w scales playful questions (R8)", () => {
  const z = quiz();
  assert.equal(z.delta(z.byId.get("pizza"), q("flight"), q("flight").answers[0]), 3 * 0.7);
});

test("need: spice question is skipped when nothing spicy is in play", () => {
  const z = quiz();
  const top = foods.filter((f) => f.tags[0] === "dessert").map((f) => ({ f, p: 1 }));
  assert.equal(z.value(q("spice"), top), 0);
  assert.ok(z.value(q("temp"), top) > 0);
});

test("grid vetoes lower the food and spread to similar foods; the grid comes once", () => {
  const z = new FoodQuiz(foods, QUESTIONS, {}, { rnd: seeded(), pickBelow: 0 });
  z.answer(q("hunger"), 2);
  const items = z.ranked().slice(0, 9).map((x) => x.f);
  const before = { ...z.s.score };
  z.grid(items, ["shawarma"]);
  assert.equal(z.s.score.shawarma, before.shawarma - 6 - 0);
  assert.ok(z.s.score.meorav < before.meorav);
  assert.ok(z.s.gridDone);
  assert.notEqual(z.next().type, "grid");
});

test("duel picks the most different of the top 2–7 and scores the winner", () => {
  const z = quiz();
  z.answer(q("hunger"), 2);
  const ranked = z.ranked();
  const [a, b] = z.duelPair(ranked);
  assert.equal(a.id, ranked[0].f.id);
  assert.ok(ranked.slice(1, 7).some((x) => x.f.id === b.id));
  const before = z.s.score[b.id];
  z.duel(z.food(a.id), z.food(b.id), "b");
  assert.ok(z.s.score[b.id] > before);
  assert.equal(z.s.duels, 1);
});

test("guess: yes finishes, close/no reject and spread; 4 wrong → pick", () => {
  const z = quiz();
  const pizza = z.food("pizza");
  z.guessResult(pizza, "close");
  assert.ok(z.s.rejected.includes("pizza"));
  assert.ok(!z.ranked().some((x) => x.f.id === "pizza"));
  for (const id of ["sushi", "falafel", "bamba"]) z.guessResult(z.food(id), "no");
  const s = z.next();
  assert.equal(s.type, "pick");
  assert.equal(s.items.length, 8);
  z.choose(s.items[0]);
  assert.equal(z.next().type, "done");
  assert.equal(z.result.f, s.items[0].id);
});

test("guess yes ends the quiz", () => {
  const z = quiz();
  z.guessResult(z.food("sushi"), "yes");
  assert.deepEqual(z.next(), { type: "done", result: { f: "sushi" } });
});

test("free text: match a known food or keep the text", () => {
  const z = quiz();
  assert.equal(z.match("פיצה").id, "pizza");
  assert.equal(z.match(" שווארמה ").id, "shawarma");
  assert.equal(z.match("קרמבו").id, "krembo");
  assert.equal(z.match("משהו שלא קיים בכלל"), null);
  z.choose("מרק תירס של סבתא");
  assert.deepEqual(z.result, { free: "מרק תירס של סבתא" });
});

test("undo restores the previous state and trail", () => {
  const z = quiz();
  z.answer(q("hunger"), 0);
  const snap = JSON.stringify(z.s);
  z.answer(q("vibe"), 1);
  assert.ok(z.undo());
  assert.equal(JSON.stringify(z.s), snap);
  assert.equal(z.trail.length, 1);
  assert.ok(z.undo());
  assert.equal(z.undo(), false);
});

test("probabilities sum to 1", () => {
  const z = quiz();
  const sum = z.ranked().reduce((a, x) => a + x.p, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("a full run ends within 20 steps", () => {
  const z = quiz();
  for (let i = 0; i < 20 && !z.result; i++) {
    const s = z.next();
    if (s.type === "q") z.answer(s.q, s.order[0]);
    else if (s.type === "grid") z.grid(s.items, []);
    else if (s.type === "duel") z.duel(s.a, s.b, "a");
    else if (s.type === "guess") z.guessResult(s.f, i > 8 ? "yes" : "no");
    else if (s.type === "pick") z.choose(s.items[0]);
  }
  assert.ok(z.result);
});

test("mood title follows the food's tags", () => {
  assert.equal(moodFor(foods.find((f) => f.id === "hamin")), "פחמימה מחבקת 🫶");
  assert.equal(moodFor(foods.find((f) => f.id === "doritos")), "יום ג׳אנק מגיע לך 😈");
  assert.equal(moodFor(null), "בדיוק מה שבא לך 😋");
});

test("🦖 express quiz: hunger, cuisine, two best questions, then a pick of 3 distinct foods (item 17)", () => {
  const z = quiz();
  z.answer(q("hunger"), 3);
  let s;
  for (let i = 0; i < 10; i++) {
    s = z.next();
    if (s.type === "q") z.answer(s.q, 0);
    else if (s.type === "guess") z.guessResult(s.f, "no");
    else if (s.type === "duel") z.duel(s.a, s.b, "none");
    else if (s.type === "grid") z.grid(s.items, []);
    else break;
  }
  assert.equal(s.type, "pick");
  assert.equal(s.express, true);
  assert.equal(s.items.length, 3);
  assert.equal(new Set(s.items.map((f) => f.id)).size, 3);
  assert.equal(z.n, 4);
  assert.deepEqual(z.s.asked.slice(0, 2), ["hunger", "cuisine"]);
});

test("item 13: unsure at guess time → 3 distinct options; sure → one guess; none → they are out and the quiz goes on", () => {
  const z = quiz();
  const low = z.guessStep(z.ranked());
  assert.equal(low.type, "pick");
  assert.equal(low.unsure, true);
  assert.equal(new Set(low.items.map((f) => f.id)).size, 3);
  const zd = new FoodQuiz(foods, QUESTIONS, {}, { rnd: seeded(), pickDistinct: true });
  const dist = zd.guessStep(zd.ranked());
  for (const a of dist.items) for (const b of dist.items) if (a !== b) assert.ok(jaccard(zd.byId.get(a.id).set, zd.byId.get(b.id).set) < 0.6, `${a.id}/${b.id} are near-twins`);
  const sure = quiz({ pizza: 30 });
  const g = sure.guessStep(sure.ranked());
  assert.equal(g.type, "guess");
  assert.equal(g.f.id, "pizza");
  assert.ok(g.p >= 0.5);

  const n0 = z.n;
  z.rejectPick(low.items);
  assert.equal(z.n, n0 + 1);
  const live = new Set(z.live().map((f) => f.id));
  for (const f of low.items) assert.ok(!live.has(f.id), `${f.id} is penalised out`);
  const s = z.next();
  assert.notEqual(s.type, "done");
  if (s.type === "pick") for (const f of s.items) assert.ok(!low.items.some((x) => x.id === f.id));
  assert.ok(z.undo());
  assert.equal(z.n, n0);
  assert.equal(z.live().length, foods.length);
  z.choose(low.items[1]); // tapping one option = the result
  assert.equal(z.result.f, low.items[1].id);
});
