import { test } from "node:test";
import assert from "node:assert/strict";
import { weatherKind, weatherBump, WEATHER_CAP } from "../js/engine/weather.js";
import { priorFrom } from "../js/engine/prior.js";
import { fetchWeather, placeFor } from "../js/weather.js";
import { FOODS } from "../js/data/foods.js";
import { ALL_TAGS } from "../js/data/tags.js";
import { buildFoods } from "../js/engine/foods.js";

const foods = buildFoods(FOODS, []);
const noon = new Date(2026, 5, 1, 13);
const json = (o) => ({ ok: true, json: async () => o });

test("weather kinds", () => {
  assert.equal(weatherKind({ temp: 10, rain: 0 }), "cold");
  assert.equal(weatherKind({ temp: 20, rain: 2 }), "rain");
  assert.equal(weatherKind({ temp: 33, rain: 0 }), "hot");
  assert.equal(weatherKind({ temp: 22, rain: 0 }), null);
  assert.equal(weatherKind(null), null);
  assert.equal(weatherKind({ temp: "x" }), null);
});

test("bump favours comfort when cold/rainy, cold+light when hot, stays capped", () => {
  assert.ok(weatherBump(["meal", "hot", "comfort", "saucy"], { temp: 8, rain: 0 }) > weatherBump(["meal", "cold", "light"], { temp: 8, rain: 0 }));
  assert.ok(weatherBump(["dessert", "sweet", "cold", "creamy"], { temp: 34, rain: 0 }) > 0);
  assert.ok(weatherBump(["meal", "cold", "light"], { temp: 34, rain: 0 }) > weatherBump(["meal", "heavy"], { temp: 34, rain: 0 }));
  assert.equal(weatherBump(["comfort"], { temp: 22, rain: 0 }), 0);
  const all = ["cold", "light", "healthy", "fruit", "dessert", "creamy", "comfort", "hot", "saucy"];
  for (const w of [{ temp: 5, rain: 5 }, { temp: 38, rain: 0 }]) assert.ok(Math.abs(weatherBump(all, w)) <= WEATHER_CAP);
});

test("bump uses only tags that exist in the food data", () => {
  const used = new Set(foods.flatMap((f) => f.tags));
  for (const t of ["comfort", "hot", "saucy", "cold", "light", "healthy", "fruit", "dessert", "creamy", "heavy"]) {
    assert.ok(ALL_TAGS.includes(t) && used.has(t), t);
  }
});

test("prior: no weather unchanged, weather only shifts a little", () => {
  const base = priorFrom(foods, { now: noon });
  assert.deepEqual(priorFrom(foods, { now: noon, weather: null }), base);
  const rainy = priorFrom(foods, { now: noon, weather: { temp: 9, rain: 3 } });
  for (const f of foods) assert.ok(Math.abs(rainy[f.id] - base[f.id]) <= WEATHER_CAP + 1e-9);
  assert.ok(rainy.kubbeh > base.kubbeh);
});

test("silent fail: network error, bad status, junk json, no fetch", async () => {
  const t = Date.now();
  assert.equal(await fetchWeather("fail1", { f: async () => { throw new Error("offline"); }, now: t }), null);
  assert.equal(await fetchWeather("fail2", { f: async () => ({ ok: false }), now: t }), null);
  assert.equal(await fetchWeather("fail3", { f: async () => json({ nope: 1 }), now: t }), null);
  assert.equal(await fetchWeather("fail4", { f: null, now: t }), null);
});

test("fetch: geocodes once, caches 1h, default place without a city", async () => {
  const urls = [];
  const f = async (u) => {
    urls.push(u);
    return json(u.includes("geocoding") ? { results: [{ latitude: 31.7, longitude: 35.2 }] } : { current: { temperature_2m: 11.5, precipitation: 0.4 } });
  };
  const t = Date.now();
  const w = await fetchWeather("cityA", { f, now: t });
  assert.deepEqual(w, { temp: 11.5, rain: 0.4 });
  assert.ok(urls[1].includes("latitude=31.7"));
  await fetchWeather("cityA", { f, now: t + 1000 });
  assert.equal(urls.length, 2); // cached
  await fetchWeather("cityA", { f, now: t + 2 * 36e5 });
  assert.equal(urls.length, 3); // weather refetched, geocode cached
  assert.deepEqual(await placeFor("", { f }), { lat: 32.08, lon: 34.78 });
  assert.deepEqual(await placeFor("cityB", { f: async () => { throw new Error("x"); } }), { lat: 32.08, lon: 34.78 });
});
