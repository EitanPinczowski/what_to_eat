import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { buildFoods } from "../js/engine/foods.js";
import { pickPlaces, scorePlaces, weightedPick, isShabbat, openStatus, navLinks, mapsUrl, recipeUrl, woltUrl, tenbisUrl, cuisineSearch } from "../js/places/picker.js";
import { bookingOf, ontopoUrl, TABIT_SEARCH } from "../js/places/links.js";

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

test("navLinks: name + city search when no map link", () => {
  const n = navLinks({ name: "פיצה רעננה", city: "חיפה", link: "https://pizza.example/menu" });
  const q = encodeURIComponent("פיצה רעננה חיפה");
  assert.equal(n.waze, `https://waze.com/ul?q=${q}&navigate=yes`);
  assert.equal(n.maps, `https://www.google.com/maps/dir/?api=1&destination=${q}`);
});

test("navLinks: saved map links are used as is, name only when no city", () => {
  const g = "https://maps.app.goo.gl/abc123";
  assert.equal(navLinks({ name: "א", link: g }).maps, g);
  assert.match(navLinks({ name: "א", link: g }).waze, /^https:\/\/waze\.com\/ul\?q=%D7%90&navigate=yes$/);
  const w = "https://waze.com/ul?ll=1,2&navigate=yes";
  assert.equal(navLinks({ name: "א", city: "ב", link: w }).waze, w);
});

test("F3: the picker offers only places of the result's cuisine; unmigrated places are derived from their foods", () => {
  const places = [P("pizzeria", { foods: ["pizza"] }), P("cafe", { cuisines: ["cafe"], rating: 5 }), P("sushi_bar", { cuisines: ["asian"] }), P("trattoria", { cuisines: ["italian"] })];
  const pf = food("pizza");
  assert.ok(pf.cuisine.length);
  const { list, noneOfKind } = pickPlaces(places, foods, { food: pf, now });
  assert.equal(noneOfKind, false);
  assert.deepEqual(list.map((x) => x.place.id).sort(), ["pizzeria", "trattoria"]);
  assert.equal(list[0].place.id, "pizzeria");
  assert.equal(list[0].reason, "serves");
  assert.match(list[1].reason, /^cuisine:italian/);
});

test("F3: no place of the cuisine falls back to the old matching and says so", () => {
  const places = [P("pasta_place", { foods: ["pasta_cream"], cuisines: ["cafe"] }), P("sushi_bar", { cuisines: ["asian"] })];
  const r = pickPlaces(places, foods, { food: food("pizza"), now });
  assert.equal(r.noneOfKind, true);
  assert.deepEqual(r.list.map((x) => x.place.id), ["pasta_place"]);
  assert.equal(pickPlaces(places, foods, { food: null, now }).noneOfKind, false);
});

test("category picker: an explicit cuisine filters with no food; null shows every place", () => {
  const places = [P("pizzeria", { foods: ["pizza"] }), P("cafe", { cuisines: ["cafe"] }), P("trattoria", { cuisines: ["italian"] })];
  const it = pickPlaces(places, foods, { cuisine: "italian", now });
  assert.deepEqual(it.list.map((x) => x.place.id).sort(), ["pizzeria", "trattoria"]);
  assert.equal(it.noneOfKind, false);
  assert.equal(pickPlaces(places, foods, { cuisine: "sweet", now }).list.length, 0);
  assert.equal(pickPlaces(places, foods, { cuisine: null, now }).list.length, 3);
});

test("category picker: serving the exact food still adds the +10 bonus, also under 'all'", () => {
  const places = [P("trattoria", { cuisines: ["italian"] }), P("pizzeria", { foods: ["pizza"], cuisines: ["italian"] }), P("cafe", { cuisines: ["cafe"] })];
  const r = pickPlaces(places, foods, { food: food("pizza"), cuisine: "italian", now }).list;
  assert.deepEqual(r.map((x) => x.place.id), ["pizzeria", "trattoria"]);
  assert.equal(r[0].reason, "serves");
  const all = pickPlaces(places, foods, { food: food("pizza"), cuisine: null, now }).list;
  assert.deepEqual(all.map((x) => x.place.id), ["pizzeria", "trattoria", "cafe"]);
});

test("search words come from the category", () => {
  assert.equal(cuisineSearch("italian"), "מסעדה איטלקית");
  assert.equal(cuisineSearch("sweet"), "קינוחים");
  assert.equal(cuisineSearch("snack"), "קיוסק");
  assert.equal(cuisineSearch("nope"), "");
});

test("bookingOf: Tabit and Ontopo links only", () => {
  assert.equal(bookingOf("https://tabitisrael.co.il/online-reservations/create-reservation?step=search&orgId=1"), "tabit");
  assert.equal(bookingOf("https://www.tabit.cloud/x"), "tabit");
  assert.equal(bookingOf("https://ontopo.com/he/il/page/123"), "ontopo");
  assert.equal(bookingOf("https://www.ontopo.co.il/x"), "ontopo");
  assert.equal(bookingOf("https://maps.google.com/x"), null);
  assert.equal(bookingOf("https://evilontopo.com/x"), null);
  assert.equal(bookingOf("https://example.com/?u=ontopo.com"), null);
  assert.equal(bookingOf(""), null);
  assert.equal(bookingOf(undefined), null);
});

test("ontopoUrl: city slug when known, Israel home otherwise; Tabit search is fixed", () => {
  assert.equal(ontopoUrl("תל אביב"), "https://ontopo.com/he/il/tel-aviv");
  assert.equal(ontopoUrl("תל אביב-יפו"), "https://ontopo.com/he/il/tel-aviv");
  assert.equal(ontopoUrl("רמת גן"), "https://ontopo.com/he/il/ramatgan");
  assert.equal(ontopoUrl("ראשון לציון"), "https://ontopo.com/he/il/rishon_lezion");
  assert.equal(ontopoUrl("פתח תקווה"), "https://ontopo.com/he/il/petah_tikva");
  assert.equal(ontopoUrl("נתניה"), "https://ontopo.com/he/il/natanya");
  assert.equal(ontopoUrl("באר שבע"), "https://ontopo.com/he/il/beer-sheva");
  assert.equal(ontopoUrl("רעננה"), "https://ontopo.com/he/il/raanana");
  assert.equal(ontopoUrl("כפר שמריהו"), "https://ontopo.com/he/il");
  assert.equal(ontopoUrl(null), "https://ontopo.com/he/il");
  assert.match(TABIT_SEARCH, /^https:\/\/tabitisrael\.co\.il\//);
});
