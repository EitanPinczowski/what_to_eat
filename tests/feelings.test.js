// W1: the feelings quiz bank and its staged engine: sliders, answer pairs, known axes, variant rotation, the craving line, the question cap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS, AXES } from "../js/data/questions.js";
import { STR } from "../js/data/strings.js";
import { buildFoods } from "../js/engine/foods.js";
import { FoodQuiz, lerpFx, bucketOf } from "../js/engine/quiz.js";
import { cravingSummary } from "../js/engine/mood.js";
import { seenFrom } from "../js/engine/learn.js";
import { knownFrom, novelEffects } from "../js/engine/prior.js";

const foods = buildFoods(FOODS);
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const q = (id) => QUESTIONS.find((x) => x.id === id);
const mk = (opts = {}) => new FoodQuiz(foods, QUESTIONS, {}, { rnd: seeded(), ...opts });
const DAY = 864e5;

/** Play to the end, always answering `pick(step)`; returns the engine. */
function play(z, pick = (s) => s.order[0]) {
  for (let i = 0; i < 40; i++) {
    const s = z.next();
    if (s.type === "done") break;
    if (s.type === "q") z.answer(s.q, pick(s));
    else if (s.type === "grid") z.grid(s.items, []);
    else if (s.type === "duel") z.duel(s.a, s.b, "a");
    else if (s.type === "guess") z.guessResult(s.f, "no");
    else if (s.type === "pick") (s.unsure ? z.rejectPick(s.items) : z.choose(s.items[0]));
  }
  return z;
}

test("guard: the first question is hunger with 3 answers, whatever the salt, seen history or weather", () => {
  for (let k = 0; k < 40; k++) {
    const seen = k % 3 ? [["hunger1"], ["hunger2"]].slice(0, k % 3) : [];
    const s = mk({ salt: String(k), seen }).next();
    assert.equal(s.type, "q");
    assert.equal(s.q.axis, "hunger");
    assert.equal(s.q.answers.length, 3);
    assert.ok(!s.q.slider);
  }
});

test("guard: no answer the engine offers is empty or a skip; no question has more than 4 buttons (a slider has 5 stops)", () => {
  for (const x of QUESTIONS) {
    const buttons = x.slider ? 0 : x.answers.length;
    assert.ok(buttons <= 4, x.id);
    for (const a of x.answers) assert.ok(Object.keys(a.fx).length > 0 || a.dyn, `${x.id}: "${a.t}" scores nothing`);
  }
  const z = mk();
  for (let i = 0; i < 7; i++) {
    const s = z.next();
    if (s.type !== "q") break;
    assert.deepEqual([...s.order].sort(), s.q.answers.map((_, j) => j));
    z.answer(s.q, s.order[0]);
  }
});

test("slider: five stops interpolate between the two end effects; buckets round to the nearest stop", () => {
  assert.deepEqual(lerpFx({ a: 2, b: -2 }, { a: 0, c: 4 }, 0.5), { a: 1, b: -1, c: 2 });
  assert.deepEqual(lerpFx({ a: 1 }, { a: 1 }, 0.3), { a: 1 });
  assert.deepEqual(lerpFx({ a: 1 }, { a: -1 }, 0.5), {}, "a zero effect is dropped");
  const s = q("hunger4");
  assert.ok(s.slider);
  assert.equal(s.answers.length, 5);
  assert.deepEqual(s.answers[0].fx, { snack: 3, dessert: 1, meal: -2 });
  assert.deepEqual(s.answers[4].fx, { meal: 3, heavy: 2.5, light: -2, snack: -3 });
  assert.equal(s.answers[2].fx.meal, 0.5, "the middle stop is the mean of the ends");
  assert.equal(s.answers[4].big, true);
  assert.ok(!s.answers[3].big);
  for (const [t, b] of [[0, 0], [0.12, 0], [0.13, 1], [0.5, 2], [0.62, 2], [0.63, 3], [1, 4], [-3, 0], [9, 4]]) assert.equal(bucketOf(s, t), b, `t=${t}`);
  const a = mk(), b = mk();
  a.answerAt(s, 0.74);
  b.answer(s, 3);
  assert.deepEqual(a.s, b.s);
  assert.deepEqual(a.trail, b.trail);
  // more hunger moves the meal foods up and the snacks down, step by step
  const p = [0, 0.5, 1].map((t) => { const z = mk(); z.answerAt(s, t); return z.s.score.pizza - z.s.score.bamba; });
  assert.ok(p[0] < p[1] && p[1] < p[2], p.join());
  const big = mk();
  big.answerAt(s, 1);
  assert.equal(big.s.big, true);
});

test("a pair of answers counts 0.6 each, takes one step, and is one trail line", () => {
  const fam = q("family1");
  assert.ok(fam.multi);
  const pair = mk(), by = mk(), one = mk();
  pair.answer(fam, [0, 2]);
  by.soft(fam, 0, 0.6);
  by.soft(fam, 2, 0.6);
  one.answer(fam, 0);
  for (const f of foods) assert.ok(Math.abs(pair.s.score[f.id] - by.s.score[f.id]) < 1e-9, f.id);
  assert.equal(pair.n, 1);
  assert.deepEqual(pair.s.asked, ["family1"]);
  assert.equal(pair.trail.length, 1);
  assert.match(pair.trail[0], / \+ /);
  assert.ok(Math.abs(pair.s.score.chocolate ?? 0) <= Math.abs(one.s.score.chocolate ?? 0) + 1e-9);
  const undone = pair.undo();
  assert.ok(undone && pair.n === 0 && pair.trail.length === 0);
});

test("cravingSummary: the 2-3 strongest adjective tags and one reflecting line", () => {
  const r = cravingSummary([["mood1", 0], ["vibe1", 0]]);
  assert.deepEqual(r.chips.map((c) => c.tag), ["comfort", "home", "creamy"]);
  assert.deepEqual(r.chips.map((c) => c.label), ["מנחם", "ביתי", "קרמי"]);
  assert.equal(r.line, STR.craving.line("מנחם, ביתי וקרמי"));
  assert.match(r.line, /^בא לך משהו .* ו.*—$/);
  assert.ok(r.chips.every((c) => c.inferred === false));
  // object form, a pair (0.6 each), an inferred answer (half), unknown ids and an empty list
  assert.deepEqual(cravingSummary([{ q: "mood1", i: 0 }, { q: "vibe1", i: 0 }]).chips.map((c) => c.tag), ["comfort", "home", "creamy"]);
  assert.deepEqual(cravingSummary([["family1", [0, 2]]]).chips.map((c) => c.tag), ["sweet", "salty"]);
  const half = cravingSummary([{ q: "warmth1", i: 0, inferred: true }]);
  assert.deepEqual(half.chips.map((c) => [c.tag, c.inferred]), [["hot", true]]);
  assert.deepEqual(cravingSummary([{ q: "mood1", i: 0, inferred: true }]).chips, [], "an inferred answer counts half: 1.25 stays under the 1.5 floor");
  assert.deepEqual(cravingSummary([]), { chips: [], line: "" });
  assert.deepEqual(cravingSummary([["nope", 1], ["mood1", 9]]), { chips: [], line: "" });
  assert.ok(cravingSummary([["family1", [0, 1, 2, 3]]]).chips.length <= 3);
});

test("known axes: weather answers warmth without asking, counted half; history answers novel", () => {
  assert.deepEqual(knownFrom({ weather: { temp: 10 } }), { warmth: "hot" });
  assert.deepEqual(knownFrom({ weather: { temp: 33 } }), { warmth: "cold" });
  assert.deepEqual(knownFrom({ weather: { temp: 20 } }), {});
  assert.deepEqual(knownFrom({ weather: "garbage" }), {});
  const now = new Date(2026, 5, 9, 13);
  const at = (d) => new Date(+now - d * DAY).toISOString();
  const week = [{ f: "pizza", at: at(1) }, { f: "pizza", at: at(3) }, { f: "sushi", at: at(5) }];
  assert.equal(knownFrom({ history: week, now }).novel, "fresh");
  const rut = Array.from({ length: 12 }, (_, i) => ({ f: i % 4 ? "pizza" : "burger", at: at(10 + i * 3) }));
  assert.equal(knownFrom({ history: rut, now }).novel, "familiar");
  assert.deepEqual(knownFrom({ history: [{ f: "pizza", at: at(1) }], now }), {});

  const z = mk({ known: { warmth: "hot" } });
  assert.deepEqual(z.known.warmth, { q: "warmth1", i: 0, k: "hot" });
  const asked = mk(), warm = q("warmth1");
  asked.answer(warm, 0);
  for (const f of foods) assert.ok(Math.abs(z.s.score[f.id] - asked.s.score[f.id] / 2) < 1e-9 || z.s.score[f.id] === 0, f.id);
  assert.equal(z.n, 0, "a known axis is not a step");
  const all = new Set();
  for (let k = 0; k < 15; k++) play(mk({ known: { warmth: "hot" }, salt: String(k) })).s.asked.forEach((id) => all.add(q(id).axis));
  assert.ok(!all.has("warmth"), "warmth is never asked when it is known");
  assert.ok(all.size > 4);
});

test("novel: her history becomes familiar/fresh effects for the 'known or new' answers", () => {
  const now = new Date(2026, 5, 9, 13);
  const at = (d) => new Date(+now - d * DAY).toISOString();
  assert.deepEqual(novelEffects([], foods, now), {});
  const { familiar, fresh } = novelEffects([{ f: "pizza", at: at(2) }, { f: "pizza", at: at(20) }, { f: "sushi", at: at(60) }], foods, now);
  assert.equal(familiar.pizza, 3);
  assert.equal(familiar.sushi, 1.5);
  assert.ok(fresh.pizza < 0 && fresh.pizza > -2, "eaten 2 days ago: not fresh");
  assert.equal(fresh.sushi, 2, "eaten 60 days ago: fresh again");
  assert.equal(fresh.burger, 2, "never eaten: fresh");
  const nov = q("novel1");
  assert.ok(nov.answers[0].dyn.familiar > 0 && nov.answers[1].dyn.fresh > 0);
  const plain = mk(), withHistory = mk({ novel: { familiar, fresh } });
  const pizza = plain.byId.get("pizza");
  assert.equal(withHistory.delta(pizza, nov, nov.answers[0]) - plain.delta(pizza, nov, nov.answers[0]), nov.answers[0].dyn.familiar * 3);
  assert.equal(withHistory.delta(pizza, nov, nov.answers[1]) - plain.delta(pizza, nov, nov.answers[1]), nov.answers[1].dyn.fresh * fresh.pizza);
});

test("rotation: over 20 quizzes with the same answers no variant repeats back to back while another one is unseen", () => {
  const hist = [];
  let prev = null;
  for (let k = 0; k < 20; k++) {
    const z = play(mk({ seen: seenFrom(hist) }), (s) => 0);
    const asked = z.s.asked;
    if (prev) for (const id of asked) {
      const axis = q(id).axis;
      if (QUESTIONS.filter((x) => x.axis === axis && !x.slider).length < 2 && QUESTIONS.filter((x) => x.axis === axis).length < 2) continue;
      assert.ok(!prev.includes(id), `quiz ${k}: ${id} came twice in a row`);
    }
    hist.push({ at: new Date(2026, 0, 1 + k).toISOString(), ans: asked.map((id) => `${id}:0`) });
    prev = asked;
  }
  const seen = new Set(hist.flatMap((h) => h.ans.map((a) => a.split(":")[0])));
  assert.ok(seen.size >= 16, `${seen.size} different questions over 20 quizzes`);
  assert.equal(AXES.length, 12);
});

test("seenFrom: the question ids of her last 3 quizzes, newest first; entries without answers are ignored", () => {
  const e = (d, ans) => ({ at: `2026-01-0${d}T10:00:00Z`, ans });
  assert.deepEqual(seenFrom([e(1, ["a1:0"]), e(3, ["c1:1", ["c2", 0]]), { at: "2026-01-04T10:00:00Z" }, e(2, ["b1:2"]), e(0, ["z1:0"])]), [["c1", "c2"], ["b1"], ["a1"]]);
  assert.deepEqual(seenFrom([]), []);
  assert.deepEqual(seenFrom(undefined), []);
});

test("determinism: the same answers give the same questions; a resumed quiz lands on the same question", () => {
  const run = (rnd) => {
    const z = mk({ rnd, salt: "x" });
    const ids = [];
    for (let i = 0; i < 4; i++) {
      const s = z.next();
      if (s.type !== "q") break;
      ids.push(s.q.id);
      z.answer(s.q, 1);
    }
    return { z, ids };
  };
  const a = run(seeded(3)), b = run(seeded(99));
  assert.deepEqual(a.ids, b.ids, "the shuffle of the buttons does not change which question comes");
  const fresh = mk({ rnd: seeded(5), salt: "x" });
  for (const id of a.ids) fresh.answer(fresh.qById.get(id), 1);
  assert.equal(fresh.next().q?.id, a.z.next().q?.id);
  assert.deepEqual(fresh.s, a.z.s);
});

test("at most 7 questions, whatever she answers and rejects; the screens may be more", () => {
  let screens = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const z = mk({ rnd: seeded(seed), pickBelow: seed % 2 ? 0 : 0.9, salt: String(seed) });
    play(z, (s) => s.order[(seed + s.q.id.length) % s.order.length]);
    assert.ok(z.s.asked.length <= 7, `seed ${seed}: ${z.s.asked.length} questions`);
    screens = Math.max(screens, z.n);
  }
  assert.ok(screens >= 7);
  // express: hunger + 2, never more
  for (let seed = 1; seed <= 20; seed++) {
    const z = mk({ rnd: seeded(seed), salt: String(seed) });
    z.answer(z.next().q, 2);
    play(z);
    assert.ok(z.s.asked.length <= 3, `express seed ${seed}`);
  }
});

test("each stage gets at most 2 questions (a skipped stage may come back once it is worth asking)", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const z = play(mk({ rnd: seeded(seed), salt: String(seed) }));
    const stages = z.s.asked.map((id) => q(id).stage);
    assert.equal(stages[0], 1);
    for (const st of [1, 2, 3, 4]) assert.ok(stages.filter((x) => x === st).length <= 2, `seed ${seed} stage ${st}`);
  }
});
