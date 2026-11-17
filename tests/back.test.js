// Back handling: one shared popstate listener, a stack of handlers, forward presses and double taps are not extra backs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BackLayer, ViewStack } from "../js/router.js";
import { startGuestQuiz } from "../js/ui/guest/quiz.js";
import { emptyRoom } from "../js/store/store.js";

/** A window with a real history list: states, back/forward/go, popstate with the landed-on state, listener bookkeeping. */
function fakeWin() {
  const listeners = new Set();
  const entries = [{ state: null }];
  let at = 0;
  const fire = () => [...listeners].forEach((f) => f({ state: entries[at].state }));
  return {
    listeners,
    addEventListener: (t, fn) => t === "popstate" && listeners.add(fn),
    removeEventListener: (t, fn) => listeners.delete(fn),
    history: {
      get state() {
        return entries[at].state;
      },
      pushState: (s) => (entries.splice(at + 1), entries.push({ state: s }), at++),
      back: () => at > 0 && (at--, fire()),
      go: (n) => at + n >= 0 && at + n < entries.length && ((at += n), fire()),
    },
    forward: () => at < entries.length - 1 && (at++, fire()),
    get at() {
      return at;
    },
  };
}

function fakeRoot() {
  const on = {};
  return {
    innerHTML: "",
    on,
    addEventListener: (t, fn) => (on[t] = fn),
    contains: () => true,
    querySelector: () => null,
    click(sel, arg) {
      const el = { dataset: { on: sel, arg }, disabled: false };
      on.click({ target: { closest: () => el }, preventDefault() {} });
    },
  };
}

test("opening and leaving the quiz several times leaves one popstate listener; one back press = one step", () => {
  const w = fakeWin();
  new ViewStack(() => {}, w).reset("home");
  assert.equal(w.listeners.size, 1);
  let z;
  for (let k = 0; k < 4; k++) {
    const root = fakeRoot();
    z = startGuestQuiz(root, { room: emptyRoom(), history: [], intro: false, win: w });
    root.click("cat", "israeli");
    root.click("ans", "0");
    root.click("ans", "0");
    assert.equal(z.n, 2);
    assert.equal(w.listeners.size, 1, `listener count after quiz ${k + 1}`);
    if (k < 3) {
      w.history.back();
      w.history.back();
      w.history.back(); // two answers and the category undone, still in the app
      assert.equal(z.n, 0);
      assert.equal(w.at, 0);
    }
  }
  // Last quiz: one back press goes back exactly one answer.
  const at = w.at;
  w.history.back();
  assert.equal(z.n, 1);
  assert.equal(w.at, at - 1);
});

test("a quiz left behind (screens replaced) does not answer later back presses", () => {
  const w = fakeWin();
  const v = new ViewStack(() => {}, w);
  v.reset("home");
  const r1 = fakeRoot();
  const z1 = startGuestQuiz(r1, { room: emptyRoom(), history: [], intro: false, win: w });
  r1.click("cat", "israeli");
  r1.click("ans", "0");
  v.reset("home"); // wholesale replace: the quiz's entry is stale
  const r2 = fakeRoot();
  const z2 = startGuestQuiz(r2, { room: emptyRoom(), history: [], intro: false, win: w });
  r2.click("cat", "israeli");
  r2.click("ans", "0");
  w.history.back(); // z2's answer
  assert.equal(z2.n, 0);
  assert.equal(z1.n, 1);
  w.history.back(); // z2's category
  w.history.back(); // the stale entry is skipped on the way down to the base
  assert.equal(z1.n, 1);
  assert.equal(w.at, 0);
});

test("a stack of handlers: only the top one runs per back press", () => {
  const w = fakeWin();
  const l = BackLayer.shared(w);
  assert.equal(BackLayer.shared(w), l);
  const log = [];
  const a = l.scope();
  const b = l.scope();
  a.push(() => log.push("a"));
  b.push(() => log.push("b"));
  w.history.back();
  assert.deepEqual(log, ["b"]);
  w.history.back();
  assert.deepEqual(log, ["b", "a"]);
});

test("a forward press is undone, not treated as back", () => {
  const w = fakeWin();
  const l = BackLayer.shared(w);
  const s = l.scope();
  let closed = 0;
  s.push(() => closed++);
  s.push(() => closed++);
  w.history.back();
  assert.equal(closed, 1);
  w.forward(); // forward onto the entry whose screen is gone
  assert.equal(closed, 1);
  assert.equal(w.at, 1); // sent back to where the app is
});

test("double tap on the in-app back button goes one step, not out of the app", () => {
  const w = fakeWin();
  const v = new ViewStack(() => {}, w);
  v.reset("home");
  v.push("a");
  let held;
  const realBack = w.history.back;
  w.history.back = () => (held = realBack); // popstate still pending (as in a real browser)
  v.back();
  v.back();
  w.history.back = realBack;
  held(); // the one history.back() that was issued
  assert.equal(w.at, 0);
  assert.equal(v.top, "home");
});

test("destroy() removes the listener", () => {
  const w = fakeWin();
  const l = new BackLayer(w);
  assert.equal(w.listeners.size, 1);
  l.destroy();
  assert.equal(w.listeners.size, 0);
});

test("after a reload the first entry carries an old number: back is still a back, not a forward", () => {
  const w = fakeWin();
  w.history.pushState({ vs: 1 }, ""); // the previous page load left this
  const l = BackLayer.shared(w); // new load
  const s = l.scope();
  let closed = 0;
  s.push(() => closed++);
  w.history.back(); // lands on the entry with the old number
  assert.equal(closed, 1);
  assert.equal(w.at, 1);
});
