// Pure helpers for tools/fetch-photos.mjs (unit-tested in tests/photos.test.js).

// English search terms for Wikimedia Commons; default = id with spaces.
export const QUERY = {
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
  quinoa_salad: "quinoa salad", smoothie: "fruit smoothie", edamame: "edamame", spring_rolls: "fresh spring rolls",
  fish_chips: "fish and chips", risotto: "risotto",
};

export const queryFor = (id) => QUERY[id] ?? id.replace(/_/g, " ");

const OK_LICENSE = /^(cc0|cc[- ]by(-sa)?( \d(\.\d)?)?|public domain|pd)/i;

/** Commons search API URL (files namespace, 320px thumbs, license metadata). */
export function searchUrl(query, limit = 8) {
  const p = new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search", gsrnamespace: "6",
    gsrsearch: `${query} filetype:bitmap`, gsrlimit: String(limit), prop: "imageinfo",
    iiprop: "url|extmetadata|mime", iiurlwidth: "320",
  });
  return `https://commons.wikimedia.org/w/api.php?${p}`;
}

const strip = (s) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

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
