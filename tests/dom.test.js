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

function fakeWin() {
  const listeners = [];
  const entries = [{}];
  let at = 0;
  return {
    entries,
    addEventListener: (_t, fn) => listeners.push(fn),
    history: {
      pushState: (s) => (entries.splice(at + 1), entries.push(s), at++),
      back: () => {
        if (at > 0) (at--, listeners.forEach((f) => f()));
      },
    },
    gesture() {
      this.history.back();
    },
    get at() {
      return at;
    },
  };
}

test("ViewStack: every push adds a history entry; the back gesture and the back button do one step", () => {
  const w = fakeWin();
  const shown = [];
  const v = new ViewStack((x) => shown.push(x), w);
  v.reset("home");
  v.push("brain");
  v.push("form");
  assert.equal(w.at, 2);
  w.gesture(); // phone back gesture
  assert.equal(v.top, "brain");
  v.back(); // in-app button: no double pop
  assert.equal(v.top, "home");
  assert.equal(w.at, 0);
  v.back(); // at the root nothing is popped
  assert.equal(v.top, "home");
});

test("BackLayer: closer may keep its entry, clear() entries are skipped on the way back", async () => {
  const { BackLayer } = await import("../js/router.js");
  const w = fakeWin();
  const l = new BackLayer(w);
  let closed = 0;
  l.push(() => (closed++, "stay"));
  w.gesture();
  assert.equal(closed, 1);
  assert.equal(l.depth, 1);
  l.clear();
  assert.equal(l.depth, 0);
  assert.equal(w.at, 1);
  w.gesture(); // stale entry: skipped, history.back() runs again
  assert.equal(w.at, 0);
});

test("topbar: back arrow points right (RTL), labelled, with the title as h2.q", async () => {
  const { topbar } = await import("../js/ui/dom.js");
  const t = topbar("<x>");
  assert.match(t, /<button class="back-ic" data-on="back" aria-label="[^"]+">→<\/button>/);
  assert.match(t, /<h2 class="q">&lt;x&gt;<\/h2>/);
});
