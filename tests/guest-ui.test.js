// Her quiz screens: countdown next to the craving card, back arrow points right (RTL), no skip, confetti sits behind the content.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { questionsLeft } from "../js/engine/quiz.js";
import { STR } from "../js/data/strings.js";
import { startGuestQuiz, backBar } from "../js/ui/guest/quiz.js";
import { emptyRoom } from "../js/store/store.js";

function fakeRoot() {
  const on = {};
  return {
    innerHTML: "",
    addEventListener: (t, fn) => (on[t] = fn),
    contains: () => true,
    querySelector: () => null,
    click(sel, arg) {
      const el = { dataset: { on: sel, arg }, disabled: false };
      on.click({ target: { closest: () => el }, preventDefault() {} });
    },
  };
}

test("countdown: 'עוד n שאלות' next to the craving card, never 0, may go up or down", () => {
  assert.equal(STR.left(1), "עוד שאלה אחת");
  assert.equal(STR.left(2), "עוד 2 שאלות");
  assert.equal(questionsLeft(0, 0), 7);
  assert.equal(questionsLeft(6, 0.1), 1);
  assert.equal(questionsLeft(7, 0.9), 1);
  assert.equal(questionsLeft(2, 0.5), 2);
  assert.ok(questionsLeft(3, 0.1) > questionsLeft(3, 0.7));
  const root = fakeRoot();
  const z = startGuestQuiz(root, { room: emptyRoom(), history: [], intro: false });
  assert.match(root.innerHTML, /data-testid="qn">עוד /);
  assert.match(root.innerHTML, /craving-card/);
  assert.equal(z.next().type, "cat");
  root.click("cat", "israeli");
  const s = z.next();
  assert.equal(s.type, "q");
  root.click("ans", String(s.order[0]));
  assert.match(root.innerHTML, /data-testid="qn">(עוד|כמעט)/);
});

test("back arrow points right (→) in RTL; the undo link uses the right-pointing hook", () => {
  assert.match(backBar(), />→</);
  const src = readFileSync("js/ui/guest/quiz.js", "utf8");
  assert.ok(!/data-on="undo">↩/.test(src));
  assert.match(src, /data-on="undo">↪/);
});

test("her screens never offer skip / don't know; confetti is drawn behind content", () => {
  const root = fakeRoot();
  startGuestQuiz(root, { room: emptyRoom(), history: [], intro: false });
  assert.doesNotMatch(root.innerHTML, /skip|data-on="dk"/);
  assert.doesNotMatch(root.innerHTML, /לא משנה|לא יודע/);
  const css = readFileSync("css/style.css", "utf8");
  assert.match(css, /\.confetti\{[^}]*pointer-events:none[^}]*z-index:-1/);
});
