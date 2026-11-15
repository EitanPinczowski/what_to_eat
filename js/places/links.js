// "Want to try" links: parse the URL text only (no network). Google Maps share link or Instagram profile/post/reel.
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
