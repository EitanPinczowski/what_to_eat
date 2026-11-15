// Impure side: one keyless Open-Meteo call on quiz start. City from settings, cached 1h, silent fail.
// Never asks the browser for location. No coordinates -> geocode the city once (cached), else a fixed Israel default.
const DEFAULT_PLACE = { lat: 32.08, lon: 34.78 }; // Tel Aviv
const HOUR = 36e5;
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";

const mem = new Map();
const cache = {
  get(k) {
    try {
      return JSON.parse(globalThis.localStorage?.getItem(k) ?? "null") ?? mem.get(k) ?? null;
    } catch {
      return mem.get(k) ?? null;
    }
  },
  set(k, v) {
    mem.set(k, v);
    try {
      globalThis.localStorage?.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

async function getJson(url, f, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await f(url, { signal: ctl.signal });
    if (!r.ok) throw new Error("http");
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function placeFor(city, { f = globalThis.fetch, timeout = 3000 } = {}) {
  const name = String(city ?? "").trim().slice(0, 40);
  if (!name) return DEFAULT_PLACE;
  const key = `wte.geo.${name}`;
  const hit = cache.get(key);
  if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon)) return hit;
  try {
    const j = await getJson(`${GEO_URL}?name=${encodeURIComponent(name)}&count=1&language=he&country_code=IL`, f, timeout);
    const r = j?.results?.[0];
    if (Number.isFinite(r?.latitude) && Number.isFinite(r?.longitude)) {
      const p = { lat: r.latitude, lon: r.longitude };
      cache.set(key, p);
      return p;
    }
  } catch {}
  return DEFAULT_PLACE;
}

/** -> {temp, rain} or null. Never throws. */
export async function fetchWeather(city, { f = globalThis.fetch, now = Date.now(), timeout = 3000 } = {}) {
  try {
    if (typeof f !== "function") return null;
    const key = `wte.wx.${String(city ?? "").trim().slice(0, 40)}`;
    const hit = cache.get(key);
    if (hit && now - hit.at < HOUR && hit.w) return hit.w;
    const { lat, lon } = await placeFor(city, { f, timeout });
    const j = await getJson(`${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation&timezone=auto`, f, timeout);
    const temp = Number(j?.current?.temperature_2m);
    const rain = Number(j?.current?.precipitation);
    if (!Number.isFinite(temp)) return null;
    const w = { temp, rain: Number.isFinite(rain) ? rain : 0 };
    cache.set(key, { at: now, w });
    return w;
  } catch {
    return null;
  }
}
