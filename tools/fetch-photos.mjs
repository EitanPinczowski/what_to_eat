// Pull a 320px CC-licensed thumbnail per food from Wikimedia Commons into img/foods/, with credits.json.
// Usage: node tools/fetch-photos.mjs [--only id] [--pick N] [--force]
//   --only id   one food · --pick N  take the Nth usable result (1 = best) to swap a bad match · --force  overwrite
import { writeFile, readFile, mkdir, access } from "node:fs/promises";
import { FOODS } from "../js/data/foods.js";
import { queryFor, searchUrl, candidates } from "./photo-lib.mjs";

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const ONLY = opt("--only");
const PICK = Math.max(1, Number(opt("--pick")) || 1);
const FORCE = args.includes("--force") || Boolean(opt("--pick"));
const DIR = new URL("../img/foods/", import.meta.url);
const CREDITS = new URL("credits.json", DIR);
const UA = { "user-agent": "what_to_eat-photo-fetcher/1.0 (personal hobby app)" };

const exists = (u) => access(u).then(() => true, () => false);
const get = async (url) => {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
};

await mkdir(DIR, { recursive: true });
const credits = (await exists(CREDITS)) ? JSON.parse(await readFile(CREDITS, "utf8")) : {};
const ids = FOODS.map((f) => f[0]).filter((id) => !ONLY || id === ONLY);
let ok = 0, miss = [];
for (const id of ids) {
  const file = new URL(`${id}.jpg`, DIR);
  if (!FORCE && credits[id] && (await exists(file))) continue;
  try {
    const list = candidates(await (await get(searchUrl(queryFor(id)))).json());
    const c = list[PICK - 1];
    if (!c) {
      miss.push(id);
      continue;
    }
    await writeFile(file, Buffer.from(await (await get(c.thumb)).arrayBuffer()));
    credits[id] = { title: c.title, author: c.author, license: c.license, page: c.page };
    ok++;
    await new Promise((r) => setTimeout(r, 300)); // be gentle with the API
  } catch (e) {
    miss.push(`${id} (${e.message})`);
  }
}
await writeFile(CREDITS, JSON.stringify(credits, null, 1));
console.log(`photos: ${ok} fetched · ${Object.keys(credits).length} total · missing: ${miss.join(", ") || "none"}`);
