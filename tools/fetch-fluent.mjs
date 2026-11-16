// Dev tool: builds img/emoji/<id>.webp (128x128) from Microsoft Fluent Emoji (3D, Default skin tone; MIT) and js/data/emoji-art.json.
// Foods whose emoji has no Fluent asset are left out of the manifest and keep the native emoji. Run: npm run fetch-emoji
// sharp is a devDependency used here only; nothing from npm ships.
import { mkdirSync, writeFileSync } from "node:fs";
import { FOODS } from "../js/data/foods.js";

const REPO = "microsoft/fluentui-emoji";
const RAW = `https://raw.githubusercontent.com/${REPO}/main/`;
const strip = (s) => s.replace(/️/g, "");
const enc = (p) => p.split("/").map(encodeURIComponent).join("/");
const get = async (url, kind = "json") => {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) }).catch(() => null);
    if (r?.ok) return kind === "json" ? r.json() : Buffer.from(await r.arrayBuffer());
  }
  throw new Error(`fetch failed: ${url}`);
};
const pool = async (items, n, fn) => {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
};

/** folder name -> path of its 3D png (Default tone for skin-tone folders), from the repo tree. */
function pngIndex(tree) {
  const m = new Map();
  for (const { path } of tree) {
    const x = /^assets\/([^/]+)\/(?:Default\/)?3D\/[^/]+\.png$/.exec(path);
    if (x && !(m.has(x[1]) && /Default/.test(path) === false)) m.set(x[1], path);
  }
  return m;
}

async function main() {
  const { default: sharp } = await import("sharp");
  const tree = (await get(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`)).tree;
  const pngs = pngIndex(tree);
  const wanted = new Set(FOODS.map((f) => strip(f[2])));
  const glyphs = new Map();
  await pool([...pngs.keys()], 12, async (dir) => {
    const meta = await get(RAW + enc(`assets/${dir}/metadata.json`)).catch(() => null);
    if (meta?.glyph && wanted.has(strip(meta.glyph))) glyphs.set(strip(meta.glyph), dir);
  });
  mkdirSync("img/emoji", { recursive: true });
  const art = {}, missing = [];
  for (const [id, , emoji] of FOODS) {
    const dir = glyphs.get(strip(emoji));
    if (!dir) { missing.push(`${id} ${emoji}`); continue; }
    const png = await get(RAW + enc(pngs.get(dir)), "buf");
    await sharp(png).resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 80 }).toFile(`img/emoji/${id}.webp`);
    art[id] = true;
  }
  writeFileSync("js/data/emoji-art.json", JSON.stringify(art, null, 1) + "\n");
  console.log(`${Object.keys(art).length}/${FOODS.length} illustrated. Native emoji kept for: ${missing.join(", ") || "none"}`);
}
await main();
