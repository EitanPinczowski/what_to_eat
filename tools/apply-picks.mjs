// Item 22/23: apply the owner's picks.json (from photos.html).
// Usage: node tools/apply-picks.mjs picks.json
// Downloads only the picked files (polite client), makes img/foods/<id>-160.webp and <id>-400.webp (square, large <= 30 KB),
// and regenerates js/data/photos.json (manifest id -> true) and js/data/photo-credits.json. "emoji" picks remove the food's photo.
// sharp is a devDependency used here only; nothing from npm ships.
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { FOODS } from "../js/data/foods.js";
import { politeClient } from "./photo-lib.mjs";
import { readPicks } from "./picks-lib.mjs";

export const SIZES = [160, 400];
export const MAX_LARGE = 30 * 1024;

/** Download source: a 960px Commons thumb of the picked file (full originals can be many MB). */
export const sourceUrl = (c) => (c.thumbUrl?.includes("/330px-") ? c.thumbUrl.replace("/330px-", "/960px-") : c.fileUrl);

/** Square WebP at each size; the large one steps quality down until it fits MAX_LARGE. Returns { 160: Buffer, 400: Buffer }. */
export async function convert(buf, sharp) {
  const out = {};
  for (const px of SIZES) {
    let q = 80, b;
    do {
      b = await sharp(buf).rotate().resize(px, px, { fit: "cover", position: "attention" }).webp({ quality: q }).toBuffer();
      q -= 10;
    } while (px === 400 && b.length > MAX_LARGE && q >= 30);
    out[px] = b;
  }
  return out;
}

const readJson = (file) => readFile(file, "utf8").then(JSON.parse, () => ({}));

export async function applyPicks({ picks, cands, get, sharp, imgDir, manifestFile, creditsFile, log = console.log }) {
  const foodIds = new Set(FOODS.map((f) => f[0]));
  const { ok, emoji, bad } = readPicks(picks, cands, foodIds);
  const manifest = await readJson(manifestFile);
  const credits = await readJson(creditsFile);
  await mkdir(imgDir, { recursive: true });
  const failed = [];
  for (const [id, title, c] of ok) {
    try {
      const sizes = await convert(await get(sourceUrl(c), true), sharp);
      for (const px of SIZES) await writeFile(join(imgDir, `${id}-${px}.webp`), sizes[px]);
      manifest[id] = true;
      credits[id] = { title, author: c.author, license: c.license, page: c.page };
      log(`${id}: ${(sizes[400].length / 1024).toFixed(1)} KB`);
    } catch (e) {
      failed.push(id);
      log(`${id}: failed (${e.message})`);
    }
  }
  for (const id of emoji) {
    delete manifest[id];
    delete credits[id];
    for (const px of SIZES) await unlink(join(imgDir, `${id}-${px}.webp`)).catch(() => {});
  }
  const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(manifestFile, JSON.stringify(sorted(manifest), null, 1) + "\n");
  await writeFile(creditsFile, JSON.stringify(sorted(credits), null, 1) + "\n");
  if (bad.length) log(`ignored (not a candidate / unknown food): ${bad.join(", ")}`);
  return { applied: ok.length - failed.length, emoji: emoji.length, bad, failed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error("usage: node tools/apply-picks.mjs picks.json"); process.exit(1); }
  const here = (p) => fileURLToPath(new URL(p, import.meta.url));
  const sharp = (await import("sharp")).default;
  const r = await applyPicks({
    picks: JSON.parse(await readFile(file, "utf8")),
    cands: JSON.parse(await readFile(here("./candidates.json"), "utf8")),
    get: politeClient({ gapMs: 1000 }),
    sharp,
    imgDir: here("../img/foods"),
    manifestFile: here("../js/data/photos.json"),
    creditsFile: here("../js/data/photo-credits.json"),
  });
  console.log(JSON.stringify(r));
  process.exit(r.failed.length ? 2 : 0);
}
