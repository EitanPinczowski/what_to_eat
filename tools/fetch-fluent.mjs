// Dev tool: builds img/emoji/<id>.webp (128x128) from Microsoft Fluent Emoji (3D, Default skin tone; MIT) and js/data/emoji-art.json.
// Foods whose emoji has no Fluent asset are left out of the manifest and keep the native emoji. Run: npm run fetch-emoji
// sharp is a devDependency used here only; nothing from npm ships.
import { mkdirSync, writeFileSync } from "node:fs";
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";

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
/** "🐭" -> "1f42d"; ZWJ sequences join with "-" (variation selectors dropped). Same rule as ui/pics.js cpKey. */
const cpKey = (e) => [...strip(e)].map((c) => c.codePointAt(0).toString(16)).join("-");
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
  const qEmoji = [...new Set(QUESTIONS.flatMap((q) => q.answers.map((a) => strip(a.e))))];
  const wanted = new Set([...FOODS.map((f) => strip(f[2])), ...qEmoji]);
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
  // Answer art: img/emoji/q-<codepoints>.webp, listed in js/data/emoji-q.json (ui/pics.js loadQPics). Missing glyphs keep the native emoji.
  const q = [], qMissing = [];
  for (const e of qEmoji) {
    const dir = glyphs.get(e);
    if (!dir) { qMissing.push(e); continue; }
    const key = cpKey(e);
    await sharp(await get(RAW + enc(pngs.get(dir)), "buf")).resize(96, 96, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 75 }).toFile(`img/emoji/q-${key}.webp`);
    q.push(key);
  }
  writeFileSync("js/data/emoji-q.json", JSON.stringify(q.sort()) + "\n");
  console.log(`${q.length}/${qEmoji.length} answer emojis illustrated. Native kept for: ${qMissing.join(" ") || "none"}`);
  console.log(`${Object.keys(art).length}/${FOODS.length} illustrated. Native emoji kept for: ${missing.join(", ") || "none"}`);
}
await main();
