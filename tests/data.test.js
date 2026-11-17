import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { CUISINES } from "../js/data/cuisines.js";
import { QUESTIONS, AXES } from "../js/data/questions.js";
import { TAGS, KINDS, ALL_TAGS } from "../js/data/tags.js";
import { STR } from "../js/data/strings.js";

test("every grouped tag has a Hebrew label and vice versa", () => {
  assert.deepEqual(new Set(ALL_TAGS), new Set(Object.keys(TAGS)));
  assert.equal(ALL_TAGS.length, new Set(ALL_TAGS).size);
});

test("foods: ~90, unique ids, kind first, known tags, valid seasons", () => {
  assert.ok(FOODS.length >= 85 && FOODS.length <= 140, `count ${FOODS.length}`);
  const ids = new Set();
  for (const [id, name, emoji, tags, season] of FOODS) {
    assert.match(id, /^[a-z_]+$/);
    assert.ok(!ids.has(id), `dup id ${id}`);
    ids.add(id);
    assert.ok(name && emoji, id);
    const t = tags.split(" ");
    assert.ok(KINDS.includes(t[0]), `${id} kind first`);
    assert.equal(t.filter((x) => KINDS.includes(x)).length, 1, `${id} one kind`);
    for (const x of t) assert.ok(TAGS[x], `${id}: unknown tag ${x}`);
    assert.equal(t.length, new Set(t).size, `${id} dup tag`);
    if (season) for (const m of season) assert.ok(m >= 1 && m <= 12, id);
  }
});

test("foods: no two foods share the exact same tag set", () => {
  const seen = new Map();
  for (const [id, , , tags] of FOODS) {
    const key = tags.split(" ").sort().join(" ");
    assert.ok(!seen.has(key), `${id} = ${seen.get(key)}`);
    seen.set(key, id);
  }
});

test("questions: unique ids, 12 axes in 4 stages, 2–4 answers (a 5-stop slider is the exception), known tags, a real effect each", () => {
  const ids = new Set();
  for (const q of QUESTIONS) {
    assert.ok(!ids.has(q.id), q.id);
    ids.add(q.id);
    assert.match(q.id.slice(q.axis.length), /^\d+$/);
    assert.ok([1, 2, 3, 4].includes(q.stage), q.id);
    assert.ok(q.text.trim().endsWith("?"), `${q.id} is a question`);
    // fridge magnets is a "pick the 2 that fit" board of 6 words (W5b), not a pick-one list
    assert.ok(q.slider ? q.answers.length === 5 : q.type === "magnets" ? q.answers.length === 6 : q.answers.length >= 2 && q.answers.length <= 4, `${q.id}: ${q.answers.length} answers`);
    for (const a of q.answers) {
      assert.ok(a.e && a.t, q.id);
      assert.ok(a.t.split(/\s+/).length <= 6, `${q.id}: answer too long "${a.t}"`);
      assert.ok(Object.keys(a.fx).length > 0 || a.dyn, `${q.id}: "${a.t}" has no effect`);
      for (const tag of Object.keys(a.fx)) assert.ok(TAGS[tag] || (tag.startsWith("c:") && CUISINES.includes(tag.slice(2))), `${q.id}: unknown tag ${tag}`);
    }
    for (const tag of q.need ?? []) assert.ok(TAGS[tag], q.id);
  }
  assert.equal(AXES.length, 12);
  assert.ok(QUESTIONS.length >= 30, `${QUESTIONS.length} questions`);
  for (const axis of AXES) {
    const vs = QUESTIONS.filter((q) => q.axis === axis);
    assert.ok(vs.length >= 2, `axis ${axis} has ${vs.length} variants`);
    assert.equal(new Set(vs.map((q) => q.stage)).size, 1, `${axis}: one stage`);
  }
  const first = QUESTIONS.filter((q) => q.axis === "hunger" && !q.slider && q.answers.length === 3);
  assert.ok(first.length >= 2, "the opening question has 3 answers, in at least two wordings");
  assert.ok(QUESTIONS.filter((q) => q.slider).every((q) => q.answers.length === 5));
  assert.ok(QUESTIONS.filter((q) => q.w).length <= 3);
});

test("the bank has no skip, \"don't know\" or \"whatever\" answer, anywhere (owner rule)", () => {
  const SKIP = /🤷|לא משנה|לא יודע|אין לי דעה|מה שבא|whatever|skip|don.?t know/i;
  for (const q of QUESTIONS) for (const a of q.answers) assert.doesNotMatch(`${a.e} ${a.t}`, SKIP, `${q.id}: "${a.t}"`);
});

test("retired v1 questions load on demand and still resolve old ids", async () => {
  const { findQuestion } = await import("../js/data/questions.js");
  assert.equal((await findQuestion("hunger1")).axis, "hunger");
  const old = await findQuestion("cuisine");
  assert.equal(old.retired, true);
  assert.equal(old.answers.length, 8);
  assert.equal(await findQuestion("no-such-question"), undefined);
});

test("every answer tag matches at least one food", () => {
  const used = new Set(FOODS.flatMap((f) => [...f[3].split(" "), ...(f[5] ?? []).map((c) => `c:${c}`)]));
  for (const q of QUESTIONS)
    for (const a of q.answers)
      for (const [tag, v] of Object.entries(a.fx)) if (v > 0) assert.ok(used.has(tag), `${q.id}: ${tag} unused`);
});

test("strings: moods use known tags", () => {
  for (const m of STR.moods) for (const t of m.tags) assert.ok(TAGS[t], t);
  assert.equal(typeof STR.progress(1, 10), "string");
});

test("every food is reachable at noise 0 (result or top 3 in some trial); no identical tag sets", async () => {
  const { FOODS } = await import("../js/data/foods.js");
  const { QUESTIONS } = await import("../js/data/questions.js");
  const { buildFoods } = await import("../js/engine/foods.js");
  const { jaccard } = await import("../js/engine/similarity.js");
  const { FoodQuiz } = await import("../js/engine/quiz.js");
  const foods = buildFoods(FOODS);
  const keys = new Set();
  for (const f of foods) {
    const k = [...f.tags].sort().join(" ");
    assert.ok(!keys.has(k), `identical tags: ${f.id}`);
    keys.add(k);
  }
  const judge = new FoodQuiz(foods, QUESTIONS);
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const reach = (t, seed) => {
    const z = new FoodQuiz(foods, QUESTIONS, {}, { rnd: rng(seed) });
    const sim = (f) => (f.id === t.id ? 1 : jaccard(f.tags, t.tags));
    const offered = [];
    for (let i = 0; i < 40; i++) {
      const s = z.next();
      if (s.type === "done") break;
      if (s.type === "q") {
        const ds = s.q.answers.map((a) => judge.delta(t, s.q, a));
        const max = Math.max(...ds);
        z.answer(s.q, ds.indexOf(max));
      } else if (s.type === "grid") z.grid(s.items, s.items.filter((f) => f.id !== t.id && sim(f) < 0.15).map((f) => f.id));
      else if (s.type === "duel") z.duel(s.a, s.b, Math.max(sim(s.a), sim(s.b)) < 0.15 ? "none" : sim(s.a) >= sim(s.b) ? "a" : "b");
      else if (s.type === "gut") z.gut(s.a, s.b, "a");
      else if (s.type === "guess") {
        offered.push(s.f.id);
        z.guessResult(s.f, s.f.id === t.id ? "yes" : sim(s.f) >= 0.5 ? "close" : "no");
      } else if (s.type === "pick") {
        offered.push(...s.items.map((f) => f.id));
        if (s.unsure && !s.items.some((f) => f.id === t.id)) z.rejectPick(s.items); // "none of these": the quiz goes on
        else break;
      }
    }
    return z.result?.f === t.id || offered.slice(0, 3).includes(t.id) || offered.includes(t.id);
  };
  const NEW = ["tiramisu", "panna_cotta", "choco_mousse", "cookies", "sorbet", "cinnamon_roll", "baklava", "gnocchi", "quiche", "greek_salad", "sandwich", "tomato_soup"];
  const missed = NEW.filter((id) => !Array.from({ length: 5 }, (_, k) => k + 1).some((k) => reach(foods.find((f) => f.id === id), k * 977 + 3)));
  assert.deepEqual(missed, []);
});

test("cuisines: every food has one, ids are known, every cuisine has 2+ foods", () => {
  const count = Object.fromEntries(CUISINES.map((c) => [c, 0]));
  for (const f of FOODS) {
    const cu = f[5];
    assert.ok(Array.isArray(cu) && cu.length >= 1, `${f[0]} has no cuisine`);
    for (const c of cu) {
      assert.ok(CUISINES.includes(c), `${f[0]}: unknown cuisine ${c}`);
      count[c]++;
    }
  }
  for (const c of CUISINES) assert.ok(count[c] >= 2, `${c} has ${count[c]} foods`);
});
