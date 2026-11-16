import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../js/data/foods.js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pic, setPics, loadPics, hasPic, artSrc } from "../js/ui/pics.js";
const ART = JSON.parse(readFileSync("js/data/emoji-art.json", "utf8"));
// Foods whose emoji has no Fluent asset keep the native emoji. Update with tools/fetch-fluent.mjs output.
const NATIVE_FALLBACK = [];

test("every food has img/emoji/<id>.webp (a real webp, small) or is in the native-fallback list", () => {
  for (const [id] of FOODS) {
    if (NATIVE_FALLBACK.includes(id)) { assert.ok(!ART[id], id); continue; }
    assert.ok(ART[id], `${id} is not in emoji-art.json`);
    const buf = readFileSync(`img/emoji/${id}.webp`);
    assert.equal(buf.subarray(0, 4).toString(), "RIFF", id);
    assert.equal(buf.subarray(8, 12).toString(), "WEBP", id);
    assert.ok(buf.length <= 20 * 1024, `${id}.webp is ${buf.length} bytes`);
  }
  const ids = new Set(FOODS.map((f) => f[0]));
  for (const id of Object.keys(ART)) assert.ok(ids.has(id) && existsSync(`img/emoji/${id}.webp`), `stray manifest entry ${id}`);
  for (const f of readdirSync("img/emoji")) assert.ok(ART[f.replace(".webp", "")], `unlisted file ${f}`);
});

test("loadPics reads the manifest; a failed load means emoji", async () => {
  await loadPics(async (u) => (assert.equal(u, "js/data/emoji-art.json"), { json: async () => ({ pizza: true }) }));
  assert.ok(hasPic("pizza") && !hasPic("bamba"));
  await loadPics(async () => { throw new Error("offline"); });
  assert.ok(!hasPic("pizza"));
  setPics(Object.keys(ART));
});

test("pic: illustration (lazy, alt, native emoji for onerror) only when the manifest lists it, emoji otherwise", () => {
  setPics([]);
  assert.equal(pic({ id: "pizza", emoji: "🍕", name: "פיצה" }), "🍕");
  setPics(["pizza"]);
  const h = pic({ id: "pizza", emoji: "🍕", name: "פיצה" });
  assert.match(h, /<img class="pic" src="img[/]emoji[/]pizza[.]webp" alt="פיצה" data-emoji="🍕"/);
  assert.match(h, /loading="lazy" decoding="async"/);
  assert.match(h, /onerror="this[.]outerHTML=this[.]dataset[.]emoji"/);
  assert.match(pic({ id: "pizza", emoji: "🍕", name: "פיצה" }, "sm"), /width="40"/);
  assert.equal(pic({ id: "bamba", emoji: "🥜", name: "במבה" }), "🥜");
  assert.equal(artSrc("pizza"), "img/emoji/pizza.webp");
  setPics(Object.keys(ART));
});

test("illustrations stay out of the service worker SHELL and the start-up graph", () => {
  const sw = readFileSync("sw.js", "utf8");
  const shell = sw.slice(sw.indexOf("const SHELL"), sw.indexOf("];", sw.indexOf("const SHELL")));
  assert.doesNotMatch(shell, /emoji/);
  const files = ["index.html", ...readdirSync("js", { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => join("js", f))];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    assert.ok(!src.includes('emoji-art.json') || !/^import.*emoji-art/m.test(src), `${f} imports the manifest`);
    if (f !== join("js", "ui", "pics.js") && f !== join("js", "ui", "guest", "wrapped.js")) assert.ok(!src.includes("img/emoji/"), `${f} hardcodes an illustration path`);
  }
  const idx = readFileSync("index.html", "utf8");
  assert.ok(!idx.includes("emoji-art") && !idx.includes("img/emoji"));
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
