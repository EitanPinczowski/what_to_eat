// "Want to try" links: parse the URL text only (no network): Google Maps share link or Instagram profile/post/reel.
const MAPS_HOST = /^(www\.|maps\.)?google\.[a-z.]+$|^(maps\.app\.)?goo\.gl$/i;
const IG_HOST = /^(www\.)?instagram\.com$/i;
const IG_RESERVED = new Set(["p", "reel", "reels", "tv", "stories", "explore", "share", "accounts", "direct"]);

const clean = (s) => {
  let t = String(s ?? "");
  try {
    t = decodeURIComponent(t.replace(/\+/g, " "));
  } catch {
    t = t.replace(/\+/g, " ");
  }
  t = t.replace(/\s+/g, " ").trim().slice(0, 60);
  return /^[-\d.,\s°]+$/.test(t) ? "" : t; // coordinates are not a name
};

/**
 * @param {string} text  pasted link
 * @returns {{kind: "maps"|"instagram", url: string, name: string}|null}  name "" = ask for it; null = not a supported link
 */
export function parsePlaceLink(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (IG_HOST.test(u.hostname)) {
    const h = parts[0] ?? "";
    const handle = !IG_RESERVED.has(h.toLowerCase()) && /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : "";
    return { kind: "instagram", url: u.href, name: handle };
  }
  if (MAPS_HOST.test(u.hostname) && (/^(maps\.app\.)?goo\.gl$/i.test(u.hostname) || parts[0] === "maps" || u.hostname.startsWith("maps."))) {
    const i = parts.findIndex((p) => p === "place" || p === "search");
    const name = (i >= 0 && parts[i + 1] ? clean(parts[i + 1]) : "") || clean(u.searchParams.get("q") ?? u.searchParams.get("query") ?? "");
    return { kind: "maps", url: u.href, name };
  }
  return null;
}

// Booking links: Tabit and Ontopo have no public search or API, so a place only stores its page link.
const hostOf = (link) => {
  try {
    return new URL(String(link ?? "").trim()).hostname.toLowerCase();
  } catch {
    return "";
  }
};
const onDomain = (h, d) => h === d || h.endsWith(`.${d}`);

/** @returns {"tabit"|"ontopo"|null} which booking site a place link points at */
export function bookingOf(link) {
  const h = hostOf(link);
  if (onDomain(h, "tabitisrael.co.il") || onDomain(h, "tabit.cloud")) return "tabit";
  if (onDomain(h, "ontopo.com") || onDomain(h, "ontopo.co.il")) return "ontopo";
  return null;
}

export const TABIT_SEARCH = "https://tabitisrael.co.il/%D7%9E%D7%A1%D7%A2%D7%93%D7%95%D7%AA";
const ONTOPO_CITY = {
  "tel-aviv": "תל אביב|תל אביב יפו", jerusalem: "ירושלים", haifa: "חיפה", herzeliya: "הרצליה", holon: "חולון", ramatgan: "רמת גן",
  rishon_lezion: "ראשון לציון", petah_tikva: "פתח תקווה|פתח תקוה", natanya: "נתניה", raanana: "רעננה", kfar_saba: "כפר סבא",
  modiin: "מודיעין|מודיעין מכבים רעות", rehovot: "רחובות", ashdod: "אשדוד", ashkelon: "אשקלון", "beer-sheva": "באר שבע", eilat: "אילת",
  hod_hasharon: "הוד השרון", ramat_hasharon: "רמת השרון", kiryat_ono: "קרית אונו|קריית אונו", ness_ziona: "נס ציונה", yehud: "יהוד|יהוד מונוסון", caesarya: "קיסריה",
};
const cityKey = (s) => String(s ?? "").replace(/[\s\-־"'׳״]/g, "");
const SLUG_OF = new Map(Object.entries(ONTOPO_CITY).flatMap(([slug, names]) => names.split("|").map((n) => [cityKey(n), slug])));

/** Ontopo's page for a city when we know its slug, else their Israel home page. */
export const ontopoUrl = (city) => `https://ontopo.com/he/il${SLUG_OF.has(cityKey(city)) ? `/${SLUG_OF.get(cityKey(city))}` : ""}`;
