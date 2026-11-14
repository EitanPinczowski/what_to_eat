import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, html, raw } from "../js/ui/dom.js";
import { ViewStack } from "../js/router.js";
import { makeQuiz } from "../js/ui/guest/quiz.js";
import { emptyRoom } from "../js/store/store.js";

test("esc and html escape interpolations, raw() opts out", () => {
  assert.equal(esc(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  assert.equal(html`<b>${"<i>"}</b>`, "<b>&lt;i&gt;</b>");
  assert.equal(html`<b>${raw("<i>")}</b>`, "<b><i></b>");
  assert.equal(html`${["<", raw("<")]}`, "&lt;<");
  assert.equal(html`${null}|${undefined}`, "|");
});

test("ViewStack push/back/reset", () => {
  const shown = [];
  const v = new ViewStack((x) => shown.push(x));
  v.reset("home");
  v.push("brain");
  v.push("form");
  v.back();
  v.back();
  v.back();
  assert.deepEqual(shown, ["home", "brain", "form", "brain", "home", "home"]);
  assert.equal(v.top, "home");
});

test("makeQuiz uses ratings and lowers foods eaten in the last 3 days", () => {
  const room = { ...emptyRoom(), ratings: { sushi: { r: 4 } } };
  const now = new Date(2026, 0, 10, 13);
  const z = makeQuiz(room, [{ f: "pizza", at: new Date(2026, 0, 9).toISOString() }, { f: "burger", at: new Date(2026, 0, 1).toISOString() }], { now });
  assert.ok(z.s.score.sushi > 2);
  assert.equal(z.s.score.pizza, -1.5);
  assert.ok(z.s.score.burger > -1.5);
});
