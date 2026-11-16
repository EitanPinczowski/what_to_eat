// W2b: warm reactions, moment-aware openings, answer art.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { STR } from "../js/data/strings.js";
import { QUESTIONS } from "../js/data/questions.js";
import { momentOf, pickReaction } from "../js/ui/guest/quiz.js";
import { qPic, setQPics, cpKey } from "../js/ui/pics.js";

test("reactions: about 1 in 3, never repeat in a quiz, then quiet", () => {
  const used = new Set();
  assert.equal(pickReaction(used, () => 0.5), null);
  const got = [];
  for (let i = 0; i < 50; i++) { const t = pickReaction(used, () => 0.1); if (t) got.push(t); }
  assert.equal(new Set(got).size, got.length);
  assert.equal(got.length, STR.react.length);
  assert.ok(STR.react.every((s) => s.length <= 30));
});

test("moments: morning, noon, evening, late night, Friday noon, Shabbat all have strings", () => {
  const at = (d, h) => momentOf(new Date(2026, 10, 15 + d, h)); // 2026-11-15 is a Sunday
  assert.equal(at(0, 8), "morning");
  assert.equal(at(0, 13), "noon");
  assert.equal(at(0, 19), "evening");
  assert.equal(at(0, 23), "late");
  assert.equal(at(0, 3), "late");
  assert.equal(at(5, 12), "friNoon");
  assert.equal(at(5, 20), "shabbat");
  assert.equal(at(6, 10), "shabbat");
  assert.equal(at(6, 20), "evening");
  for (const k of ["morning", "noon", "evening", "late", "friNoon", "shabbat"]) assert.ok(STR.moment[k].intro && STR.moment[k].lead, k);
});

test("empty craving chip is not a command", () => assert.doesNotMatch(STR.cravingEmpty, /^ספרי/));

test("answer art: every question emoji is listed with a webp, or stays native; qPic falls back to the emoji", () => {
  const list = JSON.parse(readFileSync("js/data/emoji-q.json", "utf8"));
  for (const k of list) assert.ok(existsSync(`img/emoji/q-${k}.webp`), k);
  const all = new Set(QUESTIONS.flatMap((q) => q.answers.map((a) => cpKey(a.e))));
  assert.ok(list.length >= all.size * 0.9, `${list.length}/${all.size}`);
  setQPics([]);
  assert.equal(qPic("🐭"), "🐭");
  setQPics(["1f42d"]);
  assert.match(qPic("🐭"), /src="img[/]emoji[/]q-1f42d[.]webp".*loading="lazy".*data-emoji="🐭"|data-emoji="🐭"/);
  assert.match(qPic("🐭"), /loading="lazy"/);
});
