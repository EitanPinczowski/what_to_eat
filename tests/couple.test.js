// Couple mode (1e): his answers weigh half of hers (she 2x, he 1x), deterministic, hidden until the result, bounded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { buildFoods } from "../js/engine/foods.js";
import { FoodQuiz } from "../js/engine/quiz.js";
import { HIS_QS, HIS_W, applyHis, hisChips, parseHis } from "../js/engine/couple.js";
import { COUPLE } from "../js/data/strings-couple.js";
import { STR } from "../js/data/strings.js";

const foods = buildFoods(FOODS);
const mk = () => new FoodQuiz(foods, QUESTIONS, {}, { rnd: () => 0.5, shuffle: false });
const sc = (z) => JSON.stringify(z.s.score);

test("parseHis: three known questions, one answer each, junk dropped", () => {
  assert.deepEqual(parseHis(["mood1:2", "mood1:0", "family1:3", "after1:1", "x9:1", "after1:-1", "family1:z"]), [["mood1", 2], ["family1", 3], ["after1", 1]]);
  assert.deepEqual(parseHis(null), []);
  assert.deepEqual(HIS_QS.map((id) => QUESTIONS.some((q) => q.id === id && !q.type && !q.slider)), [true, true, true]);
});

test("her answers weigh 2x his: the same answer moves the scores twice as far when she gives it", () => {
  const his = mk(), her = mk(), zero = sc(mk());
  applyHis(his, ["family1:2"]);
  her.answer(her.qById.get("family1"), 2);
  assert.equal(HIS_W * 2, 1);
  for (const f of foods) assert.ok(Math.abs(2 * his.s.score[f.id] - her.s.score[f.id]) < 1e-9, f.id);
  assert.notEqual(sc(his), zero);
  assert.deepEqual(his.s.asked, []); // his answers are not "asked" questions: she still gets the feeling axes
});

test("deterministic: same answers, same scores, in any storage order; a replay after resume starts from the same state", () => {
  const a = applyHis(mk(), ["mood1:1", "after1:0"]), b = applyHis(mk(), ["after1:0", "mood1:1"]);
  assert.equal(sc(a), sc(b));
  const run = () => { const z = applyHis(mk(), ["mood1:0"]); z.answer(z.qById.get("family1"), 1); return sc(z); };
  assert.equal(run(), run());
});

test("a stale or out-of-range answer is ignored, not thrown", () => {
  const z = applyHis(mk(), ["mood1:9", "gone1:0"]);
  assert.equal(sc(z), sc(mk()));
});

test("his chips carry his own wording; hidden when he did not answer", () => {
  const c = hisChips(["mood1:0", "after1:1"], COUPLE);
  assert.deepEqual(c.map(([, v]) => v), ["🤗 צריך חיבוק", "😴 מלא ומרוצה"]);
  assert.deepEqual(hisChips([], COUPLE), []);
  assert.equal(COUPLE.by("איתן"), "איתן ענה:");
  for (const id of HIS_QS) assert.equal(COUPLE.qs[id].a.length, QUESTIONS.find((q) => q.id === id).answers.length, id);
});

test("startup: couple code is not in the start-up graph and strings.js has no couple strings", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of ["js/ui/guest/session.js", "js/ui/owner/app.js"]) assert.doesNotMatch(readFileSync(f, "utf8"), /^import .*couple/m, f);
  assert.ok(!("couple" in STR));
});

test("the card shows his answers in its own slot, marked as his", async () => {
  const { mountCard } = await import("../js/ui/guest/card.js");
  const host = { innerHTML: "", querySelector: () => ({ addEventListener() {} }) };
  mountCard(host, { food: { id: "pizza", name: "פיצה" }, answers: hisChips(["mood1:2"], COUPLE), hisBy: COUPLE.by("איתן") });
  assert.match(host.innerHTML, /data-testid="his"[^>]*><b>איתן ענה:<\/b> <span class="chip">🥳 שמח, בא לחגוג<\/span>/);
});
