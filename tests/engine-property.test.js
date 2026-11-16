// Item 33f: property tests on the quiz engine with a seeded random player (node:test, no libraries).
// For many seeds and every hunger / noise style: the quiz always ends, probabilities always sum to 1, undo returns the
// exact previous state, and nothing the engine offers is a skip or "don't know" option.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { buildFoods } from "../js/engine/foods.js";
import { FoodQuiz } from "../js/engine/quiz.js";

const foods = buildFoods(FOODS);
const SEEDS = 60;
const MAX_STEPS = 60;

/** mulberry32: small seeded generator. */
const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pickOf = (r, xs) => xs[Math.floor(r() * xs.length)];
const snapshot = (z) => structuredClone({ s: z.s, trail: z.trail, next: z.next() });

/** One random move for the step the engine shows. Returns false when the quiz is over. */
function randomMove(z, r, style) {
  const s = z.next();
  switch (s.type) {
    case "done":
      return false;
    case "q":
      z.answer(s.q, pickOf(r, s.order));
      return true;
    case "grid": {
      const veto = s.items.filter(() => r() < 0.3).map((f) => f.id);
      z.grid(s.items, veto);
      return true;
    }
    case "gut":
      z.gut(s.a, s.b, pickOf(r, ["a", "b"]));
      return true;
    case "duel":
      z.duel(s.a, s.b, pickOf(r, ["a", "b"]));
      return true;
    case "guess":
      z.guessResult(s.f, style === "always-no" ? "no" : pickOf(r, ["yes", "close", "no", "no"]));
      return true;
    case "pick":
      if (style === "reject-picks" && z.s.wrong < 10 && r() < 0.7) z.rejectPick(s.items);
      else z.choose(style === "free-text" ? "משהו שאין ברשימה" : pickOf(r, s.items));
      return true;
    default:
      throw new Error(`unknown step type ${s.type}`);
  }
}

const mk = (seed, opts = {}) => new FoodQuiz(foods, QUESTIONS, {}, { rnd: rng(seed * 7919 + 1), ...opts });
const STYLES = ["mixed", "always-no", "reject-picks", "free-text"];

test("the quiz always ends: any answers, any seed, hunger or not, every reply style", () => {
  for (const style of STYLES)
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = rng(seed);
      const z = mk(seed);
      if (seed % 3 === 0) z.s.big = true;
      let steps = 0;
      while (randomMove(z, r, style)) assert.ok(++steps <= MAX_STEPS, `${style} seed ${seed}: still going after ${MAX_STEPS} steps`);
      assert.equal(z.next().type, "done");
      assert.ok(z.result && (z.result.f || z.result.free), `${style} seed ${seed}: ended without a result`);
      if (z.result.f) assert.ok(z.byId.has(z.result.f));
    }
});

test("probabilities: ranked() sums to 1 and stays in [0,1] at every step", () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = rng(seed + 1000);
    const z = mk(seed);
    const check = () => {
      const ranked = z.ranked();
      if (!ranked.length) return;
      const sum = ranked.reduce((a, x) => a + x.p, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `seed ${seed}: sum ${sum}`);
      for (const x of ranked) assert.ok(x.p >= 0 && x.p <= 1 && Number.isFinite(x.p), `seed ${seed}: p ${x.p}`);
      for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].p >= ranked[i].p, "sorted, best first");
    };
    check();
    while (randomMove(z, r, "mixed")) check();
  }
});

test("undo returns the exact previous state and screen, for one step and for a whole walk", () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = rng(seed + 2000);
    const z = mk(seed);
    if (seed % 4 === 0) z.s.big = true;
    const history = [snapshot(z)];
    while (history.length < MAX_STEPS && randomMove(z, r, seed % 2 ? "mixed" : "always-no")) {
      // one step back, compare, then redo nothing: replay is not needed, a fresh walk below covers the whole stack
      history.push(snapshot(z));
    }
    // Undo all the way down; each state must equal the one recorded when it was current.
    for (let i = history.length - 2; i >= 0; i--) {
      assert.equal(z.undo(), true, `seed ${seed}: undo ${i}`);
      assert.deepEqual(snapshot(z), history[i], `seed ${seed}: state after undoing to step ${i}`);
    }
    assert.equal(z.undo(), false, "nothing left to undo at the start");
  }
});

test("undo then a different answer works (the redo path is a fresh branch)", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const r = rng(seed + 3000);
    const z = mk(seed);
    for (let i = 0; i < 3 && randomMove(z, r, "mixed"); i++);
    const before = snapshot(z);
    if (!randomMove(z, r, "mixed")) continue;
    z.undo();
    assert.deepEqual(snapshot(z), before);
    let steps = 0;
    while (randomMove(z, r, "mixed")) assert.ok(++steps <= MAX_STEPS);
    assert.equal(z.next().type, "done");
  }
});

const SKIPLIKE = /🤷|לא משנה|לא יודע|לא יודעת|לא מכירה|אין לי דעה|skip|don.?t know|dunno|pass\b/i;

test("no question or step the engine offers is a skip or don't-know option", () => {
  // The data: every answer of every question says something (has an effect) and none reads like a skip.
  for (const q of QUESTIONS) {
    assert.ok(q.answers.length >= 2, `${q.id}: at least two answers`);
    q.answers.forEach((a, i) => {
      // An effect-free answer is only fine as the middle of an ordered scale ("רגיל" on "how was the day"), never as an escape hatch.
      const middle = q.ordered && i === (q.answers.length - 1) / 2;
      assert.ok(Object.keys(a.fx).length > 0 || middle, `${q.id}: answer "${a.t}" has no effect (a hidden skip)`);
      assert.doesNotMatch(`${a.e} ${a.t}`, SKIPLIKE, `${q.id}: "${a.t}"`);
    });
  }
  // The steps: whatever the engine shows in a random walk, the order of a question is a permutation of real answers only.
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = rng(seed + 4000);
    const z = mk(seed);
    for (;;) {
      const s = z.next();
      if (s.type === "q") {
        assert.deepEqual([...s.order].sort((a, b) => a - b), s.q.answers.map((_, i) => i), `${s.q.id}: order lists each answer once`);
        assert.ok(s.order.every((i) => i >= 0), "no negative (skip) index offered");
      }
      if (s.type === "grid" || s.type === "pick") assert.ok(s.items.length >= 1 && s.items.every((f) => f.id));
      if (!randomMove(z, r, "mixed")) break;
    }
  }
});
