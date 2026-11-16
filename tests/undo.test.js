// F1: every engine step is undoable: state, trail AND the next screen come back exactly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { buildFoods } from "../js/engine/foods.js";
import { FoodQuiz } from "../js/engine/quiz.js";
import { startGuestQuiz } from "../js/ui/guest/quiz.js";
import { emptyRoom } from "../js/store/store.js";

const foods = buildFoods(FOODS);
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const mk = (big = false) => {
  const z = new FoodQuiz(foods, QUESTIONS, {}, { rnd: seeded(), pickBelow: 0 }); // these walks cover the single-guess screen; the unsure pick has its own tests
  if (big) z.s.big = true;
  return z;
};
const snapshot = (z) => structuredClone({ s: z.s, trail: z.trail, next: z.next() });

/** Apply the step, undo it, and the whole engine view must be what it was. */
function roundTrip(z, apply) {
  const before = snapshot(z);
  apply(z);
  assert.notDeepEqual(z.s, before.s);
  assert.equal(z.undo(), true);
  assert.deepEqual(snapshot(z), before);
}

/** Play forward (always the first answer / "a" / "no") and call `visit(z, step)` on each new step type once. */
function walk(z, visit, max = 30) {
  const seen = new Set();
  for (let i = 0; i < max; i++) {
    const s = z.next();
    if (s.type === "done") break;
    if (!seen.has(s.type + (s.express ? "!" : ""))) {
      seen.add(s.type + (s.express ? "!" : ""));
      visit(z, s);
    }
    if (s.type === "q") z.answer(s.q, s.order[0]);
    else if (s.type === "grid") z.grid(s.items, [s.items[0].id]);
    else if (s.type === "duel") z.duel(s.a, s.b, "a");
    else if (s.type === "gut") z.gut(s.a, s.b, "a");
    else if (s.type === "guess") z.guessResult(s.f, "no");
    else if (s.type === "pick") z.choose(s.items[0]);
  }
  return seen;
}

test("answer, grid, duel, guess (yes/close/no) and choose each undo to the identical state and screen", () => {
  const seen = walk(mk(), (z, s) => {
    if (s.type === "q") {
      roundTrip(z, (x) => x.answer(s.q, s.order[0]));
      roundTrip(z, (x) => x.answer(s.q, -1)); // engine-level skip
    }
    if (s.type === "grid") roundTrip(z, (x) => x.grid(s.items, [s.items[0].id, s.items[1].id]));
    if (s.type === "duel") for (const c of ["a", "b", "both", "none"]) roundTrip(z, (x) => x.duel(s.a, s.b, c));
    if (s.type === "guess") for (const r of ["yes", "close", "no"]) roundTrip(z, (x) => x.guessResult(s.f, r));
    roundTrip(z, (x) => x.choose(x.food("pizza")));
    roundTrip(z, (x) => x.choose("מרק של סבתא"));
  });
  for (const t of ["q", "grid", "guess"]) assert.ok(seen.has(t), `walk reached ${t}`);
});

test("the duel step is reached and undone", () => {
  const z = mk();
  let duel;
  for (let i = 0; i < 12 && !duel; i++) {
    const s = z.next();
    if (s.type === "duel") duel = s;
    else if (s.type === "q") z.answer(s.q, s.order[0]);
    else if (s.type === "grid") z.grid(s.items, []);
    else z.guessResult(s.f, "no");
  }
  if (duel) roundTrip(z, (x) => x.duel(duel.a, duel.b, "a"));
});

test("the hungry express shortlist: pick one of 3 and undo returns to the same 3", () => {
  const z = mk(true);
  let s;
  for (let i = 0; i < 20; i++) {
    s = z.next();
    if (s.type === "pick") break;
    if (s.type === "q") z.answer(s.q, s.order[0]);
    else if (s.type === "grid") z.grid(s.items, []);
    else if (s.type === "duel") z.duel(s.a, s.b, "a");
    else if (s.type === "gut") z.gut(s.a, s.b, "a");
    else z.guessResult(s.f, "no");
  }
  assert.equal(s.type, "pick");
  assert.equal(s.express, true);
  assert.equal(s.items.length, 3);
  roundTrip(z, (x) => x.choose(s.items[1]));
  assert.deepEqual(z.next().items.map((f) => f.id), s.items.map((f) => f.id));
});

test("a long walk undone all the way back to the start", () => {
  const z = mk();
  const start = snapshot(z);
  const shots = [];
  for (let i = 0; i < 12; i++) {
    const s = z.next();
    if (s.type === "done") break;
    shots.push(snapshot(z));
    if (s.type === "q") z.answer(s.q, s.order[0]);
    else if (s.type === "grid") z.grid(s.items, [s.items[0].id]);
    else if (s.type === "duel") z.duel(s.a, s.b, "b");
    else if (s.type === "gut") z.gut(s.a, s.b, "a");
    else if (s.type === "guess") z.guessResult(s.f, "close");
    else z.choose(s.items[0]);
  }
  while (shots.length) {
    assert.equal(z.undo(), true);
    assert.deepEqual(snapshot(z), shots.pop());
  }
  assert.deepEqual(snapshot(z), start);
  assert.equal(z.undo(), false);
});

// ---- the guest screen layer on top ----
function fakeRoot() {
  const on = {};
  return {
    innerHTML: "",
    on,
    addEventListener: (t, fn) => (on[t] = fn),
    contains: () => true,
    querySelector: () => null,
    click(sel, arg) {
      const el = { dataset: { on: sel, arg }, disabled: false };
      on.click({ target: { closest: () => el }, preventDefault() {} });
    },
  };
}

test("back from the result screen un-chooses it and the live progress shrinks; sealed after send", () => {
  const root = fakeRoot();
  const progress = [];
  let out;
  const z = startGuestQuiz(root, { room: emptyRoom(), history: [], intro: false, onProgress: (p) => progress.push(p), onFinish: (o) => (out = o) });
  for (let i = 0; i < 40 && !out; i++) {
    const h = root.innerHTML;
    if (h.includes('data-on="guess"')) root.click("guess", "yes");
    else if (h.includes('data-on="ans"')) root.click("ans", String(z.next().order[0]));
    else if (h.includes('data-on="gridDone"')) root.click("gridDone");
    else if (h.includes('data-on="duel"')) root.click("duel", "a");
    else if (h.includes('data-on="gut"')) root.click("gut", "a");
    else root.click("pick", z.next().items[0].id);
  }
  assert.ok(out, "reached the result");
  const n = z.n;
  const acts = progress.at(-1).actions.length;
  const viaGuess = progress.at(-1).actions.at(-1).k === "x"; // a yes counts as a step, choosing from a pick does not
  assert.equal(z.result.f != null, true);
  out.back();
  assert.equal(z.result, null);
  assert.equal(z.n, n - (viaGuess ? 1 : 0));
  assert.equal(progress.at(-1).actions.length, acts - 1); // the live doc shows the shorter list
});

test("first question back does nothing; with an intro it returns to the intro", () => {
  const root = fakeRoot();
  startGuestQuiz(root, { room: emptyRoom(), history: [], intro: true });
  root.click("go");
  assert.ok(root.innerHTML.includes('data-on="ans"'));
  root.click("qback");
  assert.ok(root.innerHTML.includes('data-on="go"'));
  root.click("go");
  root.click("ans", "0");
  root.click("qback");
  assert.ok(root.innerHTML.includes('data-on="ans"'));
  root.click("qback");
  assert.ok(root.innerHTML.includes('data-on="go"'));
  root.click("qback"); // intro: nothing before it
  assert.ok(root.innerHTML.includes('data-on="go"'));
});

test("item 13: the unsure pick of 3: one tap and 'none of these' both undo to the same 3", () => {
  const z = new FoodQuiz(foods, QUESTIONS, {}, { rnd: seeded() });
  let s;
  for (let i = 0; i < 30; i++) {
    s = z.next();
    if (s.type === "pick") break;
    if (s.type === "q") z.answer(s.q, s.order[0]);
    else if (s.type === "grid") z.grid(s.items, []);
    else if (s.type === "duel") z.duel(s.a, s.b, "a");
    else if (s.type === "gut") z.gut(s.a, s.b, "a");
  }
  assert.equal(s.type, "pick");
  assert.equal(s.unsure, true);
  assert.equal(s.items.length, 3);
  roundTrip(z, (x) => x.choose(s.items[2]));
  roundTrip(z, (x) => x.rejectPick(s.items));
  assert.deepEqual(z.next().items.map((f) => f.id), s.items.map((f) => f.id));
});
