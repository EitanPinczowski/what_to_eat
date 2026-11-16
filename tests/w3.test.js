// W3: "why this?" lines, the gut-check round, "Close, but…" refine (engine + replay).
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { STR } from "../js/data/strings.js";
import { buildFoods } from "../js/engine/foods.js";
import { FoodQuiz, MAX_Q } from "../js/engine/quiz.js";
import { whyLine, nudgesFor, refineAction, NUDGES } from "../js/engine/refine.js";
import { jaccard } from "../js/engine/similarity.js";
import { applyAction } from "../js/ui/guest/quiz.js";

const foods = buildFoods(FOODS);
const mk = (opts = {}) => new FoodQuiz(foods, QUESTIONS, {}, { rnd: () => 0.3, shuffle: false, pickBelow: 2, ...opts });
const byTag = (t) => foods.filter((f) => f.tags.includes(t));
const qa = (id, i) => ({ q: id, i });
const hot = QUESTIONS.find((q) => q.answers.some((a) => a.fx.hot > 0 && a.fx.comfort > 0)) ?? QUESTIONS.find((q) => q.answers.some((a) => a.fx.hot > 0));

test("whyLine: only tags the food has and she asked for, at most 3, '' when none", () => {
  const ans = [];
  for (const q of QUESTIONS) q.answers.forEach((a, i) => { if (Object.keys(a.fx).some((t) => STR.craving.tag[t] && a.fx[t] > 0)) ans.push(qa(q.id, i)); });
  const soup = foods.find((f) => f.tags.includes("hot") && f.tags.includes("comfort"));
  const line = whyLine(soup, ans);
  assert.ok(line.length > 0 && line.split(/,| ו/).length <= 3, line);
  assert.equal(whyLine(soup, []), "");
  assert.equal(whyLine(null, ans), "");
  // every label in the line is one of the food's own tags
  const parts = line.split(/, | ו/);
  for (const p of parts) { const t = Object.keys(STR.craving.tag).find((k) => STR.craving.tag[k] === p); assert.ok(t && soup.tags.includes(t), `${p} is not a tag of ${soup.id}`); }
});

test("gut-check: only for near-twins, once, and it is not a question (MAX_Q untouched)", () => {
  const z = mk();
  const r = z.ranked();
  const twin = (x, y) => jaccard(z.byId.get(x).set, z.byId.get(y).set) >= 0.6;
  // pick a twin pair and push them to the top
  const [a, b] = foods.flatMap((x) => foods.filter((y) => y.id > x.id && jaccard(new Set(x.tags), new Set(y.tags)) >= 0.6).map((y) => [x, y]))[0];
  z.s.score[a.id] = 5; z.s.score[b.id] = 4.9;
  z.s.asked = Array(MAX_Q).fill("x");
  const s = z.next();
  assert.equal(s.type, "gut");
  assert.ok(twin(s.a.id, s.b.id));
  const asked = z.s.asked.length;
  z.gut(s.a, s.b, "a");
  assert.equal(z.s.asked.length, asked, "the gut-check is not counted toward MAX_Q");
  assert.ok(z.s.score[s.a.id] > z.s.score[s.b.id]);
  assert.notEqual(z.next().type, "gut", "once per quiz");
  assert.ok(r.length > 2);
  // no twins at the top: straight to the options
  const y = mk();
  const far = foods.filter((f) => !f.tags.some((t) => foods.find((g) => g.id === a.id).tags.includes(t))).slice(0, 3);
  far.forEach((f, i) => (y.s.score[f.id] = 5 - i * 0.05));
  y.s.asked = Array(MAX_Q).fill("x");
  assert.notEqual(y.next().type, "gut");
});

test("refine: re-ranks toward the direction, excludes every shown option, undo restores, replay is exact", () => {
  const z = mk();
  z.s.asked = Array(MAX_Q).fill("x");
  const first = z.next();
  assert.equal(first.type, "pick");
  const shown = first.items.map((f) => f.id);
  const act = refineAction("sweet", shown);
  assert.equal(act.k, "r");
  const before = structuredClone(z.s);
  applyAction(z, act);
  const next = z.next();
  assert.equal(next.type, "pick");
  assert.equal(next.items.length, 3);
  for (const f of next.items) assert.ok(!shown.includes(f.id));
  assert.ok(next.items.filter((f) => f.tags.includes("sweet")).length >= 2, "leans sweet");
  assert.ok(z.trail.at(-1).startsWith("קרוב, אבל"));
  // a second refine excludes the 6 so far
  const act2 = refineAction("comfort", next.items.map((f) => f.id));
  applyAction(z, act2);
  const third = z.next();
  for (const f of third.items) assert.ok(![...shown, ...next.items.map((x) => x.id)].includes(f.id));
  // undo twice → exactly the start
  assert.ok(z.undo() && z.undo());
  assert.deepEqual(z.s, before);
  // replay the same two actions on a fresh engine: identical state and next step
  const y = mk();
  y.s.asked = Array(MAX_Q).fill("x");
  for (const a of [act, act2]) applyAction(y, JSON.parse(JSON.stringify(a)));
  applyAction(z, act); applyAction(z, act2);
  assert.deepEqual(y.s, z.s);
  assert.deepEqual(y.next().items.map((f) => f.id), z.next().items.map((f) => f.id));
});

test("nudges: 3 distinct, opposites of what she asked for, never a skip, never her own direction", () => {
  const all = Object.keys(NUDGES);
  for (const key of all) assert.ok(STR.refine.nudge[key].endsWith("?"), key + " is a question");
  const ans = [];
  for (const q of QUESTIONS) q.answers.forEach((a, i) => { if ((a.fx.heavy > 0 || a.fx.fried > 0) && !ans.some((x) => x.q === q.id)) ans.push(qa(q.id, i)); });
  const n = nudgesFor(ans);
  assert.equal(new Set(n).size, 3);
  assert.ok(n.includes("light"), n.join());
  assert.equal(nudgesFor([]).length, 3);
  for (const k of [...n, ...nudgesFor([])]) assert.ok(NUDGES[k] && STR.refine.nudge[k]);
  assert.ok(!/לא יודע|דלג|skip/.test(JSON.stringify(STR.refine)));
});
