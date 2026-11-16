import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { applyPicks, sourceUrl, convert, MAX_LARGE } from "../tools/apply-picks.mjs";
import { setPick, exportPicks, readPicks, loadPicks, savePicks } from "../tools/picks-lib.mjs";

const cand = (title, n) => ({ thumbUrl: `https://upload.wikimedia.org/thumb/a/ab/${n}.jpg/330px-${n}.jpg`, fileUrl: `https://upload.wikimedia.org/a/ab/${n}.jpg`, title, author: "Ann", license: "CC BY 4.0", page: `https://commons.wikimedia.org/wiki/${title}` });
const cands = { pizza: [cand("File:P1.jpg", "P1"), cand("File:P2.jpg", "P2")], bamba: [cand("File:B1.jpg", "B1")] };

// A smooth 1200x900 test photo (gradient + a shape), like a real photo it compresses well.
const fixture = () => sharp({ create: { width: 1200, height: 900, channels: 3, background: "#c08040" } })
  .composite([{ input: Buffer.from('<svg width="1200" height="900"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#400"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><circle cx="600" cy="450" r="300" fill="#3a8"/></svg>') }])
  .jpeg().toBuffer();

test("picks-lib: toggle, export keeps only real candidates, storage is safe", () => {
  let p = setPick({}, "pizza", "File:P1.jpg");
  p = setPick(p, "bamba", "emoji");
  p = setPick(p, "ghost", "File:Nope.jpg");
  assert.deepEqual(Object.keys(setPick(p, "pizza", "File:P1.jpg")).sort(), ["bamba", "ghost"], "tap again un-picks");
  assert.deepEqual(JSON.parse(exportPicks(p, cands)), { bamba: "emoji", pizza: "File:P1.jpg" });
  const mem = new Map();
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  savePicks(store, "k", p);
  assert.deepEqual(loadPicks(store, "k"), p);
  assert.deepEqual(loadPicks({ getItem: () => "{oops" }, "k"), {});
  assert.deepEqual(loadPicks(null, "k"), {});
  const r = readPicks({ pizza: "File:P2.jpg", bamba: "emoji", ghost: "emoji", krembo: "File:X.jpg" }, cands, new Set(["pizza", "bamba", "krembo"]));
  assert.deepEqual([r.ok.map((x) => x[0]), r.emoji, r.bad], [["pizza"], ["bamba"], ["ghost", "krembo"]]);
});

test("sourceUrl asks for a 960px Commons thumb", () => {
  assert.match(sourceUrl(cands.pizza[0]), /\/960px-P1\.jpg$/);
  assert.equal(sourceUrl({ fileUrl: "https://f/x.jpg" }), "https://f/x.jpg");
});

test("convert: two square WebP sizes, large one within budget", async () => {
  const out = await convert(await fixture(), sharp);
  for (const px of [160, 400]) {
    const m = await sharp(out[px]).metadata();
    assert.deepEqual([m.format, m.width, m.height], ["webp", px, px]);
  }
  assert.ok(out[400].length <= MAX_LARGE, `${out[400].length} bytes`);
});

test("applyPicks with a mocked fetch: files, manifest, credits; emoji pick removes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wte-picks-"));
  const manifestFile = join(dir, "photos.js"), creditsFile = join(dir, "photo-credits.mjs"), imgDir = join(dir, "foods");
  const asked = [];
  const img = await fixture();
  const get = async (url, asBuffer) => { asked.push(url); assert.equal(asBuffer, true); return img; };
  const log = () => {};
  const r = await applyPicks({ picks: { pizza: "File:P2.jpg", bamba: "File:B1.jpg" }, cands, get, sharp, imgDir, manifestFile, creditsFile, log });
  assert.deepEqual([r.applied, r.failed], [2, []]);
  assert.equal(asked.length, 2, "downloads only the picked files");
  assert.ok(asked[0].includes("P2") && asked[0].includes("960px"));
  assert.deepEqual((await readdir(imgDir)).sort(), ["bamba-160.webp", "bamba-400.webp", "pizza-160.webp", "pizza-400.webp"]);
  const man = await readFile(manifestFile, "utf8");
  assert.match(man, /export const PHOTOS = \{"bamba":true,"pizza":true\};/);
  const { PHOTO_CREDITS } = await import(`file:///${creditsFile.replace(/\\/g, "/")}`);
  assert.deepEqual(PHOTO_CREDITS.pizza, { title: "File:P2.jpg", author: "Ann", license: "CC BY 4.0", page: "https://commons.wikimedia.org/wiki/File:P2.jpg" });

  // a later run: bamba back to emoji, an unknown pick ignored, a failing download reported and not listed
  const get2 = async () => { throw new Error("boom"); };
  const r2 = await applyPicks({ picks: { bamba: "emoji", ghost: "File:Z.jpg", pizza: "File:P1.jpg" }, cands, get: get2, sharp, imgDir, manifestFile, creditsFile, log });
  assert.deepEqual([r2.applied, r2.emoji, r2.bad, r2.failed], [0, 1, ["ghost"], ["pizza"]]);
  assert.deepEqual((await readdir(imgDir)).sort(), ["pizza-160.webp", "pizza-400.webp"]);
  assert.match(await readFile(manifestFile, "utf8"), /\{"pizza":true\}/);
});
