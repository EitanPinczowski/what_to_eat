// Insights (item 31): the pure numbers, the screen markup, and that the lazy pieces stay out of the start-up shell.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { buildFoods } from "../js/engine/foods.js";
import { median, accuracyOf, funnelOf, guessViewBy, uselessQuestions, insightsFor, MIN_ENTRIES } from "../js/engine/insights.js";
import { insightsHtml } from "../js/ui/owner/insights.js";
import { INS } from "../js/data/strings-insights.js";
import { MemoryStore } from "../js/store/memory.js";
import { loadEvents } from "../js/store/events.js";

const foods = buildFoods(FOODS);
const now = new Date(2026, 10, 16, 12);
const at = (m, d = 10) => new Date(2026, m, d, 19).toISOString();
const entry = (m, hit, guesses = 1, extra = {}) => ({ at: at(m), f: "pizza", stats: { hit, guesses, steps: 7 }, ...extra });

test("median", () => {
  assert.equal(median([]), null);
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([1, 2, 3, 10]), 2.5);
});

test("accuracyOf: first-guess and top-3 share per month, from the one hit definition", () => {
  const h = [entry(10, true, 1), entry(10, true, 3), entry(10, false, 2), entry(10, true, 4), entry(9, true, 1), { at: at(10), f: "x" }];
  assert.deepEqual(accuracyOf(h, "2026-11"), { n: 4, first: 25, top3: 50 });
  assert.deepEqual(accuracyOf(h, "2026-10"), { n: 1, first: 100, top3: 100 });
  assert.equal(accuracyOf(h, "2026-08"), null);
});

test("funnelOf counts sent, opened, finish, going in order", () => {
  const ev = [{ k: "sent" }, { k: "sent" }, { k: "opened" }, { k: "finish" }, { k: "step" }];
  assert.deepEqual(funnelOf(ev), [{ k: "sent", n: 2 }, { k: "opened", n: 1 }, { k: "finish", n: 1 }, { k: "going", n: 0 }]);
});

test("guessViewBy groups guesses by weather or weekday with first-guess share and most chosen food", () => {
  const ev = [
    { k: "guess", w: "rain", d: 2, f: "ramen", r: 1 },
    { k: "guess", w: "rain", d: 2, f: "ramen", r: 3 },
    { k: "guess", w: "hot", d: 5, f: "ice_cream", r: 1 },
    { k: "guess", d: 5, f: "pizza", r: 0 },
    { k: "step", w: "hot", d: 5 },
  ];
  assert.deepEqual(guessViewBy(ev, "w"), [{ key: "rain", n: 2, first: 50, food: "ramen" }, { key: "hot", n: 1, first: 100, food: "ice_cream" }]);
  const d = guessViewBy(ev, "d");
  assert.deepEqual(d.map((v) => [v.key, v.n, v.first]), [["2", 2, 50], ["5", 2, 50]]);
});

test("uselessQuestions: a question that never moves the top guess is listed, one that does is not", () => {
  const q = QUESTIONS.find((x) => x.id === "hunger1");
  const same = QUESTIONS.find((x) => x.id === "mood1");
  // every entry answers the same two questions the same way, so after the first entry's answers the top food is stable
  const hist = Array.from({ length: 6 }, () => ({ ans: ["hunger1:2", "mood1:0"] }));
  const out = uselessQuestions(hist, foods, QUESTIONS);
  assert.ok(Array.isArray(out));
  for (const u of out) {
    assert.ok(u.asked >= 5 && u.rate <= 20, u.id);
    assert.equal(typeof u.text, "string");
  }
  assert.ok(!out.some((u) => u.id === "hunger1"), "the first answer always changes the top guess");
  assert.ok(q && same);
  assert.deepEqual(uselessQuestions([{ ans: ["hunger1:2"] }], foods, QUESTIONS), [], "too few answers");
  assert.deepEqual(uselessQuestions([{ ans: ["nope:1", "hunger1:99", "garbage"] }], foods, QUESTIONS), [], "unknown ids are skipped");
});

test("uselessQuestions: a question whose answers change no scores is reported", () => {
  const noop = { id: "noop", text: "שאלה בלי השפעה", answers: [{ e: "a", t: "א", fx: {} }, { e: "b", t: "ב", fx: {} }] };
  const hunger = QUESTIONS.find((x) => x.id === "hunger1");
  const hist = Array.from({ length: 6 }, () => ({ ans: ["hunger1:2", "noop:1"] }));
  const out = uselessQuestions(hist, foods, [hunger, noop]);
  assert.deepEqual(out.map((u) => [u.id, u.asked, u.changed, u.rate]), [["noop", 6, 0, 0]]);
});

test("insightsFor: empty with little data, filled with enough", () => {
  assert.equal(insightsFor({ history: [entry(10, true)], foods, questions: QUESTIONS, now }).enough, false);
  const history = [
    entry(10, true, 1, { place: "p1", rej: ["sushi", "sushi"], f: "pizza" }),
    entry(10, false, 2, { place: "p1", rej: ["sushi"] }),
    entry(9, true, 1, { place: "p2" }),
  ];
  assert.equal(history.length, MIN_ENTRIES);
  const events = [{ k: "finish", t: 40 }, { k: "finish", t: 80 }, { k: "finish", t: 100 }, { k: "sent" }, { k: "guess", w: "cold", d: 1, f: "ramen", r: 1 }];
  const x = insightsFor({ history, events, places: { p1: { name: "פיצה א" }, p2: { name: "ב" } }, foods, questions: QUESTIONS, now });
  assert.equal(x.enough, true);
  assert.deepEqual(x.month.cur, { n: 2, first: 50, top3: 50 });
  assert.deepEqual(x.month.prev, { n: 1, first: 100, top3: 100 });
  assert.deepEqual(x.decision, { n: 3, median: 80 });
  assert.deepEqual(x.places.map((p) => [p.name, p.n]), [["פיצה א", 2], ["ב", 1]]);
  assert.deepEqual(x.rejected.map((r) => [r.id, r.n]), [["sushi", 3]]);
  assert.equal(x.weather[0].name, foods.find((f) => f.id === "ramen").name);
  assert.equal(x.funnel[0].n, 1);
});

test("insightsHtml: empty state, then every section", () => {
  assert.match(insightsHtml(insightsFor({ foods, questions: QUESTIONS, now })), /ins-empty/);
  const history = [entry(10, true, 1, { place: "p1", rej: ["sushi"] }), entry(10, true), entry(9, false)];
  const events = [{ k: "finish", t: 75 }, { k: "sent" }, { k: "guess", w: "rain", d: 0, f: "ramen", r: 1 }];
  const out = insightsHtml(insightsFor({ history, events, places: { p1: { name: "מקום" } }, foods, questions: QUESTIONS, now }));
  for (const t of [INS.accTitle, INS.funnelTitle, INS.decTitle, INS.placesTitle, INS.rejTitle, INS.weatherTitle, INS.weekdayTitle, INS.uselessTitle]) assert.ok(out.includes(t), t);
  assert.ok(out.includes("1 דק׳ 15 שנ׳"));
  assert.ok(out.includes(INS.weather.rain) && out.includes(INS.days[0]));
});

test("loadEvents reads the events a MemoryStore holds, oldest first, and ignores junk", async () => {
  const s = new MemoryStore("insroom00000000000000000");
  await s.ready();
  await s._writeDoc("events", "b", { k: "finish", at: "2026-11-02T10:00:00Z" });
  await s._writeDoc("events", "a", { k: "sent", at: "2026-11-01T10:00:00Z" });
  await s._writeDoc("events", "c", { k: "bogus", at: "2026-11-03T10:00:00Z" });
  assert.deepEqual((await loadEvents(s)).map((e) => e.k), ["sent", "finish"]);
});

test("insights pieces are precached but load on demand (REVIEW 31)", () => {
  const sw = readFileSync("sw.js", "utf8");
  for (const f of ["js/ui/owner/insights.js", "js/engine/insights.js", "js/data/strings-insights.js", "js/store/events.js"]) assert.ok(sw.includes(`"${f}"`), f);
  const app = readFileSync("js/ui/owner/app.js", "utf8");
  assert.ok(app.includes('import("./insights.js")'));
  assert.doesNotMatch(app, /^import .*insights/m);
  assert.doesNotMatch(readFileSync("js/store/store.js", "utf8"), /^import .*events\.js/m);
  assert.match(app, /"wrapped", "insights", "settings"/);
});
