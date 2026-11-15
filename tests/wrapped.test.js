import { test } from "node:test";
import assert from "node:assert/strict";
import { wrappedSummary, monthKey, prevMonth, isFirstOfMonth, hardQuestion, MIN_MEALS } from "../js/engine/wrapped.js";
import { wrappedCards } from "../js/ui/guest/wrapped.js";
import { buildWrappedLink, parseHash } from "../js/share/links.js";

const e = (day, f, extra = {}) => ({ at: new Date(2026, 9, day, 12).toISOString(), f, fn: f, fe: "🍕", ...extra });
const st = (hit, guesses, skips = []) => ({ hit, guesses, steps: 5, skips });

test("month helpers", () => {
  assert.equal(monthKey(new Date(2026, 9, 5).toISOString()), "2026-10");
  assert.equal(monthKey("nope"), "");
  assert.equal(prevMonth(new Date(2026, 0, 1)), "2025-12");
  assert.equal(prevMonth(new Date(2026, 10, 1)), "2026-10");
  assert.ok(isFirstOfMonth(new Date(2026, 10, 1)) && !isFirstOfMonth(new Date(2026, 10, 2)));
});

test("summary: top 3 by count, only that month, first-guess hit rate, favourite place", () => {
  const h = [
    e(1, "pizza", { stats: st(true, 1), place: "p1" }), e(2, "pizza", { stats: st(true, 2), place: "p1" }), e(3, "pizza", { stats: st(true, 1) }),
    e(4, "sushi", { stats: st(false, 3), place: "p2" }), e(5, "sushi"), e(6, "burger"), e(7, "falafel"),
    { ...e(8, "ramen"), at: new Date(2026, 8, 30, 12).toISOString() }, // other month
  ];
  const s = wrappedSummary(h, "2026-10", { p1: { name: "פיצה בר" }, p2: { name: "סושי" } });
  assert.equal(s.n, 7);
  assert.equal(s.enough, true);
  assert.deepEqual(s.top.map((t) => [t[0], t[3]]), [["pizza", 3], ["sushi", 2], ["burger", 1]]);
  assert.equal(s.hit, 50); // 2 first-guess hits of 4 quizzes with stats
  assert.equal(s.pl, "פיצה בר");
});

test("summary: no stats / places gives nulls; free-text foods are counted by name", () => {
  const s = wrappedSummary([e(1, null, { fn: "שווארמה" }), e(2, null, { fn: "שווארמה" }), e(3, "x")], "2026-10", {});
  assert.equal(s.hit, null);
  assert.equal(s.pl, null);
  assert.deepEqual(s.top[0].slice(0, 2), [null, "שווארמה"]);
  assert.equal(s.top[0][3], 2);
});

test("too little data is flagged and gets one friendly card", () => {
  const s = wrappedSummary([e(1, "pizza")], "2026-10");
  assert.equal(s.enough, false);
  assert.ok(MIN_MEALS > 1);
  const cards = wrappedCards(s, "נגה");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].k, "few");
  assert.equal(wrappedSummary([], "2026-10").n, 0);
});

test("hardQuestion: most skipped first, else the question most tied to misses", () => {
  assert.equal(hardQuestion([{ stats: st(true, 1, ["a", "b"]) }, { stats: st(true, 1, ["b"]) }]), "b");
  const miss = (qs) => ({ stats: st(false, 2), ans: qs.map((q) => `${q}:0`) });
  const hit = (qs) => ({ stats: st(true, 1), ans: qs.map((q) => `${q}:0`) });
  const es = [miss(["x", "y"]), miss(["x"]), miss(["x", "y"]), hit(["y"]), hit(["y"]), hit(["y"])];
  assert.equal(hardQuestion(es), "x");
  assert.equal(hardQuestion([hit(["y"])]), null);
});

test("cards: intro, top, hit, share in a full month; share is last", () => {
  const h = [1, 2, 3, 4].map((d) => e(d, "pizza", { stats: st(true, 1) }));
  const cards = wrappedCards(wrappedSummary(h, "2026-10"), "נגה");
  assert.deepEqual(cards.map((c) => c.k), ["intro", "top", "hit", "share"]);
  assert.equal(cards[2].big, "100%");
});

test("#w= link round-trips and rejects junk", () => {
  const s = { mo: "2026-10", n: 4, enough: true, top: [["pizza", "פיצה", "🍕", 4]], hit: 75, q: null, pl: null, her: "נגה", me: "איתן" };
  const link = buildWrappedLink("https://x.test/app/#old", s);
  const r = parseHash(link.slice(link.indexOf("#")));
  assert.equal(r.kind, "w");
  assert.equal(r.payload.top[0][1], "פיצה");
  assert.ok(link.length < 600);
  assert.equal(parseHash("#w=@@@").kind, "bad");
  assert.equal(parseHash(`#w=${link.split("#w=")[1].slice(0, 5)}`).kind, "bad");
});
