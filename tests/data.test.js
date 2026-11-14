import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { TAGS, KINDS, ALL_TAGS } from "../js/data/tags.js";
import { STR } from "../js/data/strings.js";

test("every grouped tag has a Hebrew label and vice versa", () => {
  assert.deepEqual(new Set(ALL_TAGS), new Set(Object.keys(TAGS)));
  assert.equal(ALL_TAGS.length, new Set(ALL_TAGS).size);
});

test("foods: ~90, unique ids, kind first, known tags, valid seasons", () => {
  assert.ok(FOODS.length >= 85 && FOODS.length <= 110, `count ${FOODS.length}`);
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

test("questions: unique ids, 2–4 answers, known tags, starters 1–3", () => {
  const ids = new Set();
  for (const q of QUESTIONS) {
    assert.ok(!ids.has(q.id), q.id);
    ids.add(q.id);
    assert.ok(q.text.trim().endsWith("?"), `${q.id} is a question`);
    assert.ok(q.answers.length >= 2 && q.answers.length <= 4, q.id);
    for (const a of q.answers) {
      assert.ok(a.e && a.t, q.id);
      assert.ok(a.t.split(/\s+/).length <= 5, `${q.id}: answer too long "${a.t}"`);
      for (const tag of Object.keys(a.fx)) assert.ok(TAGS[tag], `${q.id}: unknown tag ${tag}`);
    }
    for (const tag of q.need ?? []) assert.ok(TAGS[tag], q.id);
  }
  const starts = QUESTIONS.filter((q) => q.start).map((q) => q.start).sort();
  assert.deepEqual(starts, [1, 2, 3]);
  assert.equal(QUESTIONS.find((q) => q.start === 3).id, "veto");
  assert.ok(QUESTIONS.filter((q) => q.w).length <= 3);
});

test("every answer tag matches at least one food", () => {
  const used = new Set(FOODS.flatMap((f) => f[3].split(" ")));
  for (const q of QUESTIONS)
    for (const a of q.answers)
      for (const [tag, v] of Object.entries(a.fx)) if (v > 0) assert.ok(used.has(tag), `${q.id}: ${tag} unused`);
});

test("strings: moods use known tags", () => {
  for (const m of STR.moods) for (const t of m.tags) assert.ok(TAGS[t], t);
  assert.equal(typeof STR.progress(1, 10), "string");
});
