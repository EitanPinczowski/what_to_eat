// Pure helpers for tools/fetch-photos.mjs (unit-tested in tests/photos.test.js).

// English search terms for Wikimedia Commons; default = id with spaces.
export const QUERY = {
  tiramisu: "tiramisu", panna_cotta: "panna cotta", choco_mousse: "chocolate mousse", cookies: "chocolate chip cookies", sorbet: "sorbet", cinnamon_roll: "cinnamon roll", baklava: "baklava",
  gnocchi: "gnocchi", quiche: "quiche", greek_salad: "Greek salad", sandwich: "sandwich", tomato_soup: "tomato soup",
  bamba: "Bamba peanut snack", bissli: "Bissli", klik: "Klik chocolate Israel", krembo: "Krembo",
  milky: "Milky pudding Strauss", wafers: "wafer biscuits", tapuchips: "potato chips", pesek_zman: "Pesek Zman",
  kif_kef: "Kif Kef chocolate", doritos: "Doritos", pretzels: "pretzel sticks", seeds: "sunflower seeds snack",
  popcorn: "popcorn bowl", apropo: "corn snack", artik: "ice pop", choco_bar: "milk chocolate bar", shoko_bag: "chocolate milk bag Israel",
  instant_noodles: "instant noodles", ice_cream: "ice cream scoops", malabi: "malabi", sufganiya: "sufganiyah",
  cheesecake: "cheesecake", choco_cake: "chocolate cake", crepe: "crepe chocolate", waffle: "Belgian waffle",
  knafeh: "knafeh", rugelach: "rugelach", fruit_salad: "fruit salad", churros: "churros", froyo: "frozen yogurt",
  brownies: "brownies", falafel: "falafel pita", sabich: "sabich", shawarma: "shawarma laffa", hummus: "hummus plate",
  toast: "grilled cheese sandwich", burekas: "bourekas", malawach: "malawach", jachnun: "jachnun",
  meorav: "Jerusalem mixed grill", arayes: "arayes", kubbeh: "kubbeh soup", corn: "corn on the cob",
  schnitzel_baguette: "schnitzel sandwich", burger: "hamburger", fries: "french fries", pizza: "pizza",
  sushi: "sushi", schnitzel: "schnitzel", pad_thai: "pad thai", green_curry: "green curry", stir_fry: "lo mein",
  sweet_sour: "sweet and sour chicken", butter_chicken: "butter chicken", tacos: "tacos", burrito: "burrito",
  poke: "poke bowl", pasta_cream: "fettuccine alfredo", pasta_tomato: "spaghetti tomato sauce", skewers: "shish kebab",
  steak: "steak", ramen: "ramen", wings: "chicken wings", grilled_fish: "grilled fish", lasagna: "lasagna",
  gyoza: "gyoza", hot_dog: "hot dog", nachos: "nachos", caesar: "caesar salad", shakshuka: "shakshuka",
  il_breakfast: "Israeli breakfast", omelette: "omelette", pancakes: "pancakes", granola: "yogurt granola",
  croissant: "croissant", avocado_toast: "avocado toast", bagel_salmon: "bagel lox", labneh: "labneh zaatar",
  chicken_rice: "chicken and rice", mac_cheese: "macaroni and cheese", chicken_soup: "chicken soup",
  ptitim: "ptitim", lentil_soup: "lentil soup", majadra: "mujaddara", meatballs: "meatballs tomato sauce",
  baked_potato: "baked potato", hamin: "cholent", il_salad: "Israeli salad", watermelon_feta: "watermelon feta",
  quinoa_salad: "quinoa salad", smoothie: "fruit smoothie", coffee_pastry: "coffee and pastry", protein_bar: "protein bar", yogurt_cup: "yogurt cup", iced_coffee: "iced coffee", edamame: "edamame", spring_rolls: "fresh spring rolls",
  fish_chips: "fish and chips", risotto: "risotto",
};

export const queryFor = (id) => QUERY[id] ?? id.replace(/_/g, " ");

export const OK_LICENSE = /^(cc0|cc[- ]by(-sa)?( \d(\.\d)?)?|public domain|pd)/i;

/** Commons search API URL (files namespace, 320px thumbs, license metadata). */
export function searchUrl(query, limit = 8) {
  const p = new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search", gsrnamespace: "6",
    gsrsearch: `${query} filetype:bitmap`, gsrlimit: String(limit), prop: "imageinfo",
    iiprop: "url|extmetadata|mime", iiurlwidth: "320",
  });
  return `https://commons.wikimedia.org/w/api.php?${p}`;
}

export const strip = (s) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Usable candidates (jpeg/png, free license, has a thumb), in search order. */
export function candidates(json) {
  const pages = Object.values(json?.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    const meta = ii?.extmetadata ?? {};
    const license = strip(meta.LicenseShortName?.value);
    if (!ii?.thumburl || !/image\/(jpeg|png)/.test(ii.mime ?? "") || !OK_LICENSE.test(license)) continue;
    out.push({
      title: p.title,
      thumb: ii.thumburl,
      page: ii.descriptionurl,
      author: strip(meta.Artist?.value).slice(0, 120) || "unknown",
      license,
    });
  }
  return out;
}

// ---- Item 21: candidates by identity (Wikidata item -> P18 + Commons category) ----

export const UA = "what_to_eat-photo-tool/1.0 (personal project)";
export const isOkLicense = (s) => OK_LICENSE.test(String(s ?? ""));

/** Search terms for Wikidata where the plain English term finds the wrong item (mostly Israeli products and dishes). */
export const WIKIDATA = {
  bamba: "Bamba", bissli: "Bissli", krembo: "Krembo", kif_kef: "Kif-Kef", pesek_zman: "Pesek Zman", apropo: "Apropo",
  tapuchips: "Tapuchips", klik: "Klik chocolate", milky: "Milky dessert", jachnun: "jachnun", malawach: "malawach",
  sabich: "sabich", meorav: "Meorav Yerushalmi", arayes: "arayes", choco_bar: "Shokolad Para", shoko_bag: "chocolate milk",
  artik: "ice pop", seeds: "sunflower seed", wafers: "wafer", pretzels: "pretzel",
  hamin: "cholent", majadra: "mujaddara", ptitim: "Israeli couscous", il_breakfast: "Israeli breakfast", il_salad: "Israeli salad",
  schnitzel_baguette: "schnitzel", sufganiya: "sufganiyah", kubbeh: "kubbeh", labneh: "labneh", malabi: "malabi", knafeh: "kanafeh",
};
export const wikidataTerm = (id) => WIKIDATA[id] ?? queryFor(id);

export const BAD_TITLE = /logo|packag|wrapper|painting|drawing|svg|icon|label/i;

const API = { wd: "https://www.wikidata.org/w/api.php", commons: "https://commons.wikimedia.org/w/api.php" };
const qs = (o) => new URLSearchParams({ format: "json", ...o }).toString();
export const wdSearchUrl = (term) => `${API.wd}?${qs({ action: "wbsearchentities", search: term, language: "en", limit: "3" })}`;
export const wdEntitiesUrl = (ids) => `${API.wd}?${qs({ action: "wbgetentities", ids: ids.join("|"), props: "claims" })}`;
const INFO = { prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "330" };
export const categoryUrl = (cat) => `${API.commons}?${qs({ action: "query", generator: "categorymembers", gcmtitle: `Category:${cat.replace(/^Category:/, "")}`, gcmtype: "file", gcmlimit: "30", ...INFO })}`;
export const titlesUrl = (titles) => `${API.commons}?${qs({ action: "query", titles: titles.join("|"), ...INFO })}`;
export const searchInfoUrl = (term) => `${API.commons}?${qs({ action: "query", generator: "search", gsrnamespace: "6", gsrsearch: `${term} filetype:bitmap`, gsrlimit: "20", ...INFO })}`;

/** P18 file names and P373 category from a wbgetentities response; first entity that has either wins. */
export function entityMedia(json) {
  for (const e of Object.values(json?.entities ?? {})) {
    const files = (e.claims?.P18 ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean).map((f) => `File:${f}`);
    const cat = e.claims?.P373?.[0]?.mainsnak?.datavalue?.value ?? null;
    if (files.length || cat) return { qid: e.id, files, cat };
  }
  return { qid: null, files: [], cat: null };
}

/** Commons imageinfo response -> filtered candidates (jpg, >=600px short side, aspect 0.75-1.33, free licence, clean title). */
export function filterInfo(json, source = "search") {
  const pages = Object.values(json?.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !p.title || BAD_TITLE.test(p.title)) continue;
    if (ii.mime !== "image/jpeg" || !ii.thumburl) continue;
    if (Math.min(ii.width, ii.height) < 600) continue;
    const ar = ii.width / ii.height;
    if (ar < 0.75 || ar > 1.33) continue;
    const meta = ii.extmetadata ?? {};
    const license = strip(meta.LicenseShortName?.value);
    if (!isOkLicense(license)) continue;
    out.push({ thumbUrl: ii.thumburl, fileUrl: ii.url, title: p.title, author: strip(meta.Artist?.value).slice(0, 120) || "unknown", license, page: ii.descriptionurl, source });
  }
  return out;
}

/** Merge lists in priority order, dedupe by title, cap. */
export function rank(lists, max = 6) {
  const seen = new Set(), out = [];
  for (const l of lists) for (const c of l) if (!seen.has(c.title)) { seen.add(c.title); out.push(c); }
  return out.slice(0, max);
}

/** Polite client: one request at a time, fixed UA, honours 429/503 Retry-After with backoff. asBuffer -> Buffer, else JSON. */
export function politeClient({ fetchFn = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), gapMs = 400, retries = 5 } = {}) {
  let last = 0;
  let chain = Promise.resolve();
  const one = async (url, asBuffer) => {
    for (let attempt = 0; ; attempt++) {
      const wait = last + gapMs - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      const res = await fetchFn(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      if (res.status === 429 || res.status === 503) {
        if (attempt >= retries) throw new Error(`HTTP ${res.status} after ${retries} retries: ${url}`);
        const ra = Number(res.headers?.get?.("retry-after"));
        await sleep((Number.isFinite(ra) && ra > 0 ? ra : 2 ** attempt * 2) * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.json();
    }
  };
  return (url, asBuffer) => (chain = chain.then(() => one(url, asBuffer), () => one(url, asBuffer)));
}
