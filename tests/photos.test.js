import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUERY, queryFor, searchUrl, candidates } from "../tools/photo-lib.mjs";
import { pic, setPics, loadPics } from "../js/ui/pics.js";

test("every food has an English search term", () => {
  for (const [id] of FOODS) assert.ok(QUERY[id], id);
  assert.equal(queryFor("new_thing"), "new thing");
  assert.match(searchUrl("pad thai"), /^https:\/\/commons\.wikimedia\.org\/w\/api\.php\?.*gsrsearch=pad\+thai/);
});

test("candidates keep free-licensed jpeg/png thumbs in search order", () => {
  const page = (index, mime, lic, artist = "<a href='x'>Ann</a>") => ({
    index, title: `File:${index}.jpg`,
    imageinfo: [{ thumburl: `https://t/${index}`, descriptionurl: `https://d/${index}`, mime, extmetadata: { LicenseShortName: { value: lic }, Artist: { value: artist } } }],
  });
  const json = { query: { pages: { a: page(3, "image/jpeg", "CC BY-SA 4.0"), b: page(1, "image/jpeg", "All rights reserved"), c: page(2, "image/png", "CC0"), d: page(4, "image/svg+xml", "CC0") } } };
  const c = candidates(json);
  assert.deepEqual(c.map((x) => x.thumb), ["https://t/2", "https://t/3"]);
  assert.equal(c[1].author, "Ann");
  assert.deepEqual(candidates({}), []);
});

test("pic shows a photo only when credited, emoji otherwise", async () => {
  setPics([]);
  assert.equal(pic({ id: "pizza", emoji: "🍕" }), "🍕");
  await loadPics(async () => ({ ok: true, json: async () => ({ pizza: {} }) }));
  assert.match(pic({ id: "pizza", emoji: "🍕" }), /<img class="pic" src="img\/foods\/pizza.jpg"/);
  await loadPics(async () => { throw new Error("offline"); });
  assert.equal(pic({ id: "pizza", emoji: "🍕" }), "🍕");
});

test("category labels (1.6)", async () => {
  const { category, catLabel } = await import("../js/ui/pics.js");
  assert.equal(category({ tags: ["snack", "salty"] }), "snack");
  assert.equal(category({ tags: ["snack", "sweet"] }), "sweet");
  assert.equal(category({ tags: ["dessert"] }), "sweet");
  assert.equal(category({ tags: ["meal", "breakfast", "egg"] }), "breakfast");
  assert.equal(category({ tags: ["meal", "street", "meaty"] }), "street");
  assert.equal(category({ tags: ["meal", "cook"] }), "home");
  assert.equal(category({ tags: ["meal", "healthy"] }), "fresh");
  assert.equal(category({ tags: ["meal", "asian"] }), "meal");
  assert.equal(catLabel({ tags: ["snack"] }), "חטיף");
});
