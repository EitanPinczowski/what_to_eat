// Item 21: up to 6 ranked photo candidates per food by identity (Wikidata item -> P18 image, Commons category, then Commons search).
// Metadata only, no image downloads. Resumable: foods already in tools/candidates.json are skipped (--force to redo, --only id for one).
// Usage: node tools/candidates.mjs [--only id] [--force]
import { readFile, writeFile } from "node:fs/promises";
import { FOODS } from "../js/data/foods.js";
import { politeClient, wikidataTerm, queryFor, wdSearchUrl, wdEntitiesUrl, categoryUrl, titlesUrl, searchInfoUrl, entityMedia, filterInfo, rank } from "./photo-lib.mjs";

const OUT = new URL("./candidates.json", import.meta.url);
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const force = args.includes("--force");
const get = politeClient();

let done = {};
try { done = JSON.parse(await readFile(OUT, "utf8")); } catch {}

async function forFood(id) {
  const lists = [];
  let media = { files: [], cat: null };
  for (const term of [...new Set([wikidataTerm(id), queryFor(id)])]) {
    const ids = ((await get(wdSearchUrl(term))).search ?? []).map((s) => s.id);
    if (!ids.length) continue;
    media = entityMedia(await get(wdEntitiesUrl(ids)));
    if (media.files.length || media.cat) break;
  }
  if (media.files.length) lists.push(filterInfo(await get(titlesUrl(media.files.slice(0, 10))), "wikidata"));
  if (media.cat) lists.push(filterInfo(await get(categoryUrl(media.cat)), "category"));
  let r = rank(lists);
  if (r.length < 6) r = rank([...lists, filterInfo(await get(searchInfoUrl(queryFor(id))), "search")]);
  return r;
}

for (const [id] of FOODS) {
  if (only && id !== only) continue;
  if (done[id] && !force) continue;
  try {
    done[id] = await forFood(id);
    console.log(id, done[id].length);
  } catch (e) {
    console.error(id, "failed:", e.message);
  }
  await writeFile(OUT, JSON.stringify(done, null, 1));
}
console.log(`foods with >=1: ${FOODS.filter(([id]) => (done[id] ?? []).length >= 1).length}/${FOODS.length}, >=3: ${FOODS.filter(([id]) => (done[id] ?? []).length >= 3).length}`);
