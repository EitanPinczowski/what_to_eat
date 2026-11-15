import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { buildFoods } from "../js/engine/foods.js";
import { parsePlaceLink } from "../js/places/links.js";
import { scorePlaces, navLinks, NOVEL_BONUS } from "../js/places/picker.js";

test("Google Maps links: name from /place/ or ?q=, none from short links or coordinates", () => {
  assert.equal(parsePlaceLink("https://www.google.com/maps/place/Miznon+Raanana/@32.18,34.87,17z/data=!4m").name, "Miznon Raanana");
  assert.equal(parsePlaceLink("https://www.google.com/maps/place/%D7%9E%D7%96%D7%A0%D7%95%D7%9F/@32,34").name, "מזנון");
  assert.equal(parsePlaceLink("https://www.google.com/maps/search/?api=1&query=Pizza%20Hut").name, "Pizza Hut");
  assert.deepEqual(parsePlaceLink("https://maps.app.goo.gl/AbC123"), { kind: "maps", url: "https://maps.app.goo.gl/AbC123", name: "" });
  assert.equal(parsePlaceLink("https://www.google.com/maps/place/32.18,34.87/@32.18,34.87").name, "");
});

test("Instagram links: handle from a profile, none from posts and reels", () => {
  assert.deepEqual(parsePlaceLink("https://www.instagram.com/pizza_place/?hl=en"), { kind: "instagram", url: "https://www.instagram.com/pizza_place/?hl=en", name: "pizza_place" });
  assert.equal(parsePlaceLink("instagram.com/pizza_place").kind, "instagram");
  assert.equal(parsePlaceLink("https://www.instagram.com/p/Cabc123/").name, "");
  assert.equal(parsePlaceLink("https://www.instagram.com/reel/Cabc123/").name, "");
});

test("other or broken input is rejected", () => {
  for (const x of ["", "hello", "https://example.com/maps/place/x", "javascript:alert(1)", "https://evil.com/?u=instagram.com/x"]) assert.equal(parsePlaceLink(x), null);
});

test("a saved Maps link still drives navLinks", () => {
  const r = parsePlaceLink("https://maps.app.goo.gl/AbC123");
  assert.equal(navLinks({ name: "x", link: r.url }).maps, r.url);
});

const foods = buildFoods(FOODS);
const now = new Date(2026, 10, 11, 13);
const P = (id, x) => ({ id, name: id, city: "", modes: ["sit"], foods: [], price: 2, rating: 3, visits: [], ...x });

test("novel toggle: bonus only for places with no visits, off by default", () => {
  const places = [P("old", { visits: [new Date(2026, 9, 1).toISOString()] }), P("fresh")];
  const off = scorePlaces(places, foods, { now });
  assert.equal(off[0].score, off[1].score);
  const on = scorePlaces(places, foods, { now, novel: true });
  assert.equal(on[0].place.id, "fresh");
  assert.ok(Math.abs(on[0].score - on[1].score - NOVEL_BONUS) < 1e-9);
  assert.equal(on[0].reason, "new");
});

test("novel toggle keeps food-less unvisited places eligible for a chosen food", () => {
  const pizza = foods.find((f) => f.id === "pizza");
  const places = [P("fresh"), P("visited", { visits: [new Date(2026, 9, 1).toISOString()] })];
  assert.equal(scorePlaces(places, foods, { food: pizza, now }).length, 0);
  assert.deepEqual(scorePlaces(places, foods, { food: pizza, now, novel: true }).map((r) => r.place.id), ["fresh"]);
});
