// W5a: answer types, variety rule, weather line, note.
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS } from "../js/data/questions.js";
import { FoodQuiz, typeOf, varietyFilter } from "../js/engine/quiz.js";
import { FOODS } from "../js/data/foods.js";
import { buildFoods } from "../js/engine/foods.js";
import { STR } from "../js/data/strings.js";

const byId = (id) => QUESTIONS.find((q) => q.id === id);

test("the bank has color, art and thermo variants; every 5-stop one is a slider", () => {
  assert.equal(typeOf(byId("mood5")), "color");
  assert.equal(typeOf(byId("mood6")), "art");
  assert.equal(typeOf(byId("warmth4")), "thermo");
  assert.equal(typeOf(byId("hunger4")), "slider");
  assert.equal(byId("mood5").answers.length, 4);
  assert.ok(byId("mood5").answers.every((a) => a.c));
});

test("varietyFilter: max 2 non-button types, never the same one twice in a row", () => {
  const vs = [byId("mood1"), byId("mood4"), byId("mood5"), byId("mood6")];
  const ids = (x) => x.map((q) => q.id);
  assert.deepEqual(ids(varietyFilter(vs, [byId("mood5")])).includes("mood5"), false); // same type as the last one
  assert.ok(ids(varietyFilter(vs, [byId("mood5")])).includes("mood6"));
  assert.deepEqual(ids(varietyFilter(vs, [byId("mood5"), byId("hunger1"), byId("mood6")])), ["mood1"]); // 2 used: buttons only
  assert.ok(varietyFilter([byId("mood5")], [byId("mood5")]).length === 1); // never empty
});

test("a whole quiz never breaks the variety rule, for many states", () => {
  const foods = buildFoods(FOODS, []);
  for (let seed = 0; seed < 60; seed++) {
    const z = new FoodQuiz(foods, QUESTIONS, {}, { rnd: () => ((seed * 9301 + 49297) % 233280) / 233280 });
    const types = [];
    for (let n = 0; n < 12; n++) {
      const s = z.next();
      if (s.type !== "q") break;
      types.push(typeOf(s.q));
      z.answer(s.q, (seed + n) % s.q.answers.length);
    }
    assert.ok(types.filter((t) => t !== "buttons").length <= 2, types.join());
    types.forEach((t, i) => i && t !== "buttons" && assert.notEqual(t, types[i - 1], types.join()));
  }
});

test("weather line: cached reading becomes one short line, none gives an empty string", () => {
  assert.equal(STR.wxLine({ temp: 14, rain: 1 }), "קריר בחוץ, 14° 🌧️");
  assert.equal(STR.wxLine(null), "");
});
