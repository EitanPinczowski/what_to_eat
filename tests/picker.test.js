import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { buildFoods } from "../js/engine/foods.js";
import { scorePlaces, weightedPick, isShabbat, openStatus, mapsUrl, recipeUrl, woltUrl, tenbisUrl } from "../js/places/picker.js";

const foods = buildFoods(FOODS);
const food = (id) => foods.find((f) => f.id === id);
const now = new Date(2026, 10, 11, 13); // Wednesday
const P = (id, extra) => ({ id, name: id, city: "רעננה", modes: ["sit", "delivery"], foods: [], price: 2, rating: 0, visits: [], ...extra });

test("serving the food beats sharing a cuisine; unrelated places drop out", () => {
  const places = [P("pasta_place", { foods: ["pasta_cream"] }), P("pizzeria", { foods: ["pizza"] }), P("sushi_bar", { foods: ["sushi"] })];
  const r = scorePlaces(places, foods, { food: food("pizza"), now });
  assert.deepEqual(r.map((x) => x.place.id), ["pizzeria", "pasta_place"]);
  assert.equal(r[0].score, 10);
  assert.equal(r[0].reason, "serves");
  assert.equal(r[1].score, 2);
  assert.equal(r[1].reason, "style:italian");
});

test("rating, recent visit and budget adjust the score", () => {
  const base = { foods: ["pizza"] };
  const r = scorePlaces(
    [P("loved", { ...base, rating: 5 }), P("visited", { ...base, rating: 5, visits: [new Date(2026, 10, 9).toISOString()] }), P("pricey", { ...base, rating: 5, price: 3 })],
    foods,
    { food: food("pizza"), now, budget: 1 },
  );
  const s = Object.fromEntries(r.map((x) => [x.place.id, x.score]));
  assert.equal(s.loved, 10 + 4 - 2);
  assert.equal(s.visited, 10 + 4 - 3 - 2);
  assert.equal(s.pricey, 10 + 4 - 4);
});

test("filters by mode and city; any/home skip the mode filter", () => {
  const places = [P("a", { foods: ["pizza"], modes: ["take"] }), P("b", { foods: ["pizza"], city: "באר שבע" })];
  assert.deepEqual(scorePlaces(places, foods, { food: food("pizza"), mode: "delivery", now }).map((x) => x.place.id), ["b"]);
  assert.deepEqual(scorePlaces(places, foods, { food: food("pizza"), city: "רעננה", now }).map((x) => x.place.id), ["a"]);
  assert.equal(scorePlaces(places, foods, { food: food("pizza"), mode: "any", now }).length, 2);
});

test("Shabbat hides places closed on Shabbat", () => {
  assert.equal(isShabbat(new Date(2026, 10, 13, 18)), true); // Fri 18:00
  assert.equal(isShabbat(new Date(2026, 10, 14, 12)), true); // Sat noon
  assert.equal(isShabbat(new Date(2026, 10, 14, 20)), false); // Sat 20:00
  assert.equal(isShabbat(now), false);
  const places = [P("kosher", { foods: ["pizza"], shabbat: true }), P("open", { foods: ["pizza"] })];
  assert.deepEqual(scorePlaces(places, foods, { food: food("pizza"), now: new Date(2026, 10, 13, 18) }).map((x) => x.place.id), ["open"]);
});

test("no food: every matching place, ranked by rating", () => {
  const r = scorePlaces([P("x", { rating: 2 }), P("y", { rating: 4 })], foods, { now });
  assert.deepEqual(r.map((x) => x.place.id), ["y", "x"]);
});

test("weightedPick follows the weights", () => {
  const s = [{ score: 9 }, { score: 1 }];
  assert.equal(weightedPick(s, () => 0.5), s[0]);
  assert.equal(weightedPick(s, () => 0.95), s[1]);
  assert.equal(weightedPick([], () => 0), null);
  assert.equal(weightedPick([{ score: -5 }], () => 0.99).score, -5);
});

test("fallback links", () => {
  assert.equal(mapsUrl("פיצה רעננה"), "https://www.google.com/maps/search/?api=1&query=%D7%A4%D7%99%D7%A6%D7%94%20%D7%A8%D7%A2%D7%A0%D7%A0%D7%94");
  assert.match(recipeUrl("שקשוקה"), /^https:\/\/www\.youtube\.com\/results\?search_query=/);
});

test("delivery search links", () => {
  assert.equal(woltUrl("פיצה"), "https://wolt.com/he/isr/search?q=%D7%A4%D7%99%D7%A6%D7%94");
  assert.match(tenbisUrl("פיצה"), /^https:\/\/www\.10bis\.co\.il\/next\/search\?query=/);
});

const H = (d, o, c) => ({ d, o, c });
test("openStatus: no hours = open; day without range = closed; boundaries", () => {
  assert.deepEqual(openStatus(P("a")), { open: true, closesIn: null });
  assert.deepEqual(openStatus(P("a", { hours: [] })), { open: true, closesIn: null });
  const p = P("a", { hours: [H(3, "11:00", "23:00")] }); // Wednesday
  assert.equal(openStatus(p, new Date(2026, 10, 11, 10, 59)).open, false);
  assert.deepEqual(openStatus(p, new Date(2026, 10, 11, 11, 0)), { open: true, closesIn: 720 });
  assert.deepEqual(openStatus(p, new Date(2026, 10, 11, 22, 59)), { open: true, closesIn: 1 });
  assert.equal(openStatus(p, new Date(2026, 10, 11, 23, 0)).open, false);
  assert.equal(openStatus(p, new Date(2026, 10, 12, 13)).open, false); // Thursday has no range
});

test("openStatus: closing after midnight spills into the next day, also Sat -> Sun", () => {
  const p = P("bar", { hours: [H(3, "18:00", "02:00"), H(6, "20:00", "01:00")] });
  assert.deepEqual(openStatus(p, new Date(2026, 10, 12, 1, 30)), { open: true, closesIn: 30 }); // Thu 01:30
  assert.equal(openStatus(p, new Date(2026, 10, 12, 2, 0)).open, false);
  assert.equal(openStatus(p, new Date(2026, 10, 15, 0, 30)).open, true); // Sun 00:30 from Sat
});

test("picker hides closed places, flags closing within 45 min, keeps hourless places", () => {
  const at = (h, m) => new Date(2026, 10, 11, h, m);
  const places = [
    P("hourless", { foods: ["pizza"] }),
    P("open", { foods: ["pizza"], hours: [H(3, "09:00", "23:00")] }),
    P("closing", { foods: ["pizza"], hours: [H(3, "09:00", "22:30")] }),
    P("closed", { foods: ["pizza"], hours: [H(3, "09:00", "20:00")] }),
  ];
  const r = scorePlaces(places, foods, { food: food("pizza"), now: at(22, 0) });
  const byId = Object.fromEntries(r.map((x) => [x.place.id, x]));
  assert.deepEqual(Object.keys(byId).sort(), ["closing", "hourless", "open"]);
  assert.equal(byId.closing.closesIn, 30);
  assert.equal(byId.open.closesIn, undefined);
  assert.equal(byId.hourless.closesIn, undefined);
  assert.equal(scorePlaces([places[2]], foods, { food: food("pizza"), now: at(21, 45) })[0].closesIn, 45);
  assert.equal(scorePlaces([places[2]], foods, { food: food("pizza"), now: at(21, 44) })[0].closesIn, undefined);
});

test("Shabbat still applies together with hours", () => {
  const fri = new Date(2026, 10, 13, 18);
  const places = [P("k", { foods: ["pizza"], shabbat: true, hours: [H(5, "09:00", "23:00")] }), P("o", { foods: ["pizza"], hours: [H(5, "09:00", "23:00")] })];
  assert.deepEqual(scorePlaces(places, foods, { food: food("pizza"), now: fri }).map((x) => x.place.id), ["o"]);
});
