// W4a: never-for-me exclusion, favorites, like-last-time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { buildFoods } from "../js/engine/foods.js";
import { isExcluded, allowedFoods, cleanList, toggle, favBoosts } from "../js/engine/exclude.js";
import { likeLastTime } from "../js/engine/lasttime.js";
import { novelEffects } from "../js/engine/prior.js";
import { makeQuiz } from "../js/ui/guest/quiz.js";
import { emptyRoom, migrate } from "../js/store/store.js";
import { pickPlaces } from "../js/places/picker.js";

const foods = buildFoods(FOODS, []);

test("never: ingredient or id excludes; empty list keeps the same array", () => {
  const sh = foods.find((f) => f.id === "shakshuka");
  assert.deepEqual(sh.has, ["pepper"]);
  assert.ok(isExcluded(sh, ["pepper"]));
  assert.ok(isExcluded(foods.find((f) => f.id === "pizza"), ["pizza"]));
  assert.ok(!isExcluded(foods.find((f) => f.id === "pizza"), ["pepper"]));
  assert.equal(allowedFoods(foods, []), foods);
  assert.ok(allowedFoods(foods, ["pepper"]).every((f) => !f.has?.includes("pepper")));
});

test("new rooms start with bell pepper on the never list; old rooms get it by migration", () => {
  assert.deepEqual(emptyRoom().never, ["pepper"]);
  assert.deepEqual(migrate({ v: 1 }).never, ["pepper"]);
  assert.deepEqual(migrate({ never: [] }).never, []);
});

test("quiz never offers an excluded food: result, options and refine all come from allowed foods", () => {
  const room = { ...emptyRoom(), never: ["pepper", "falafel"] };
  const z = makeQuiz(room, [], { rnd: () => 0.5 });
  const ids = z.ranked().map((x) => x.f.id);
  assert.ok(!ids.includes("shakshuka") && !ids.includes("stir_fry") && !ids.includes("falafel"));
  assert.ok(ids.includes("pizza"));
  const nudge = z.refine({ comfort: 2 }, [], "x");
  void nudge;
  assert.ok(z.ranked().every((x) => !["shakshuka", "falafel"].includes(x.f.id)));
});

test("picker: excluded foods count for no place", () => {
  const places = [{ id: "p1", name: "A", modes: ["sit"], foods: ["shakshuka"], cuisines: ["israeli"], visits: [] }];
  const food = foods.find((f) => f.id === "shakshuka");
  const base = pickPlaces(places, foods, { food, now: new Date("2026-11-16T12:00:00") }).list;
  const cut = pickPlaces(places, foods, { food, now: new Date("2026-11-16T12:00:00"), never: ["pepper"] }).list;
  assert.ok(base.length >= 1);
  assert.deepEqual(cut, []);
});

test("cleanList and toggle bound the list to 30 short strings", () => {
  assert.deepEqual(cleanList(["a", " a ", "", 3, "b"]), ["a", "b"]);
  assert.equal(cleanList(Array.from({ length: 40 }, (_, i) => `x${i}`)).length, 30);
  assert.equal(cleanList(["x".repeat(99)])[0].length, 40);
  assert.deepEqual(toggle(["a"], "b"), ["a", "b"]);
  assert.deepEqual(toggle(["a", "b"], "a"), ["b"]);
  assert.deepEqual(cleanList("nope"), []);
});

test("favorites: small prior boost, and the novel familiar answer leans to them", () => {
  assert.ok(favBoosts(["pizza"]).pizza > 0 && favBoosts(["pizza"]).pizza < 1);
  const e = novelEffects([], foods, new Date(), ["pizza"]);
  assert.ok(e.familiar.pizza > 0);
  assert.deepEqual(novelEffects([], foods, new Date(), []), {});
  const room = { ...emptyRoom(), never: [], fav: ["pizza"] };
  const a = makeQuiz({ ...room, fav: [] }, [], { rnd: () => 0.5 }).ranked().find((x) => x.f.id === "pizza").p;
  const b = makeQuiz(room, [], { rnd: () => 0.5 }).ranked().find((x) => x.f.id === "pizza").p;
  assert.ok(b > a);
});

test("like last time: same weekday, within 2 h, rated well; never excluded; not today", () => {
  const now = new Date("2026-11-16T19:00:00"); // a Monday
  const mk = (iso, how, f = "pizza") => ({ id: iso, f, at: new Date(iso).toISOString(), how });
  const h = [mk("2026-11-09T18:00:00", 1), mk("2026-11-10T19:00:00", 1), mk("2026-11-02T22:30:00", 1), mk("2026-11-02T19:30:00", -1)];
  const hit = likeLastTime(h, now, { foods });
  assert.equal(hit.f, "pizza");
  assert.equal(hit.day, 1);
  assert.equal(likeLastTime([mk("2026-11-02T22:30:00", 1)], now, { foods }), null);
  assert.equal(likeLastTime([mk("2026-11-09T19:00:00", 0)], now, { foods }), null);
  assert.equal(likeLastTime([mk("2026-11-09T19:00:00", 1, "shakshuka")], now, { foods, never: ["pepper"] }), null);
  assert.equal(likeLastTime([mk("2026-11-16T18:00:00", 1)], now, { foods }), null);
});
