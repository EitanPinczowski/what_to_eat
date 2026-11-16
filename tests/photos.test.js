import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { QUERY, queryFor, searchUrl, candidates } from "../tools/photo-lib.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pic, setPics, loadPics, hasPic } from "../js/ui/pics.js";
const json = (f) => JSON.parse(readFileSync(f, "utf8"));
const PHOTOS = json("js/data/photos.json");

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

test("loadPics reads the manifest; a failed load means emoji", async () => {
  await loadPics(async () => ({ json: async () => ({ pizza: true }) }));
  assert.ok(hasPic("pizza") && !hasPic("bamba"));
  await loadPics(async () => { throw new Error("offline"); });
  assert.ok(!hasPic("pizza"));
  setPics(Object.keys(PHOTOS));
});

test("pic: photo (srcset, lazy, alt, emoji for onerror) only when the manifest lists it, emoji otherwise", () => {
  setPics([]);
  assert.equal(pic({ id: "pizza", emoji: "🍕", name: "פיצה" }), "🍕");
  setPics(["pizza"]);
  const h = pic({ id: "pizza", emoji: "🍕", name: "פיצה" });
  assert.match(h, /<img class="pic" src="img\/foods\/pizza-160\.webp" srcset="img\/foods\/pizza-160\.webp 160w, img\/foods\/pizza-400\.webp 400w" sizes="160px" alt="פיצה" data-emoji="🍕"/);
  assert.match(h, /loading="lazy" decoding="async"/);
  assert.match(pic({ id: "pizza", emoji: "🍕", name: "פיצה" }, "sm"), /sizes="64px"/);
  assert.equal(pic({ id: "bamba", emoji: "🥜", name: "במבה" }), "🥜");
  setPics(Object.keys(PHOTOS));
});

test("manifest: every listed photo has both webp files (large <= 30 KB), a credit, and no jpg is referenced by the app", () => {
  const PHOTO_CREDITS = json("js/data/photo-credits.json");
  const ids = new Set(FOODS.map((f) => f[0]));
  for (const id of Object.keys(PHOTOS)) {
    assert.ok(ids.has(id), `${id} is not a food`);
    for (const px of [160, 400]) {
      const buf = readFileSync(`img/foods/${id}-${px}.webp`);
      assert.equal(buf.subarray(0, 4).toString(), "RIFF", id);
      assert.equal(buf.subarray(8, 12).toString(), "WEBP", id);
      if (px === 400) assert.ok(buf.length <= 30 * 1024, `${id}-400.webp is ${buf.length} bytes`);
    }
    const c = PHOTO_CREDITS[id];
    assert.ok(c?.author && c.license && c.page && c.title, `credit for ${id}`);
  }
  for (const id of Object.keys(PHOTO_CREDITS)) assert.ok(PHOTOS[id], `credit without photo: ${id}`);
  const files = ["index.html", "sw.js", ...readdirSync("js", { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => join("js", f))];
  for (const f of files) assert.doesNotMatch(readFileSync(f, "utf8"), /img\/foods\/[^"'`\s]*\.jpg/, `${f} references a jpg`);
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
