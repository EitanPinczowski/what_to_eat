// Event log (item 29). Loaded lazily by Store.put and never awaited: a failure here must not touch the quiz.
// Each change to live/quiz, live/vote or history is turned into small facts in rooms/{id}/events
// (kinds: sent opened step guess finish vote going howItWas push). No names, no free text.
import { weatherKind } from "../engine/weather.js";
import { cachedWeather } from "../weather.js";

export const EVENT_KINDS = ["sent", "opened", "step", "guess", "finish", "vote", "going", "howItWas", "push"];
const ms = (a, b) => (a && b ? Math.max(0, Date.parse(a) - Date.parse(b)) : NaN);
const cut = (x, n = 40) => String(x ?? "").slice(0, n);

/** "phone" | "tablet" | "desktop" from the user agent and the window width. */
export function deviceType(ua = globalThis.navigator?.userAgent ?? "", width = globalThis.innerWidth ?? 0) {
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua)) return "phone";
  return width && width < 600 ? "phone" : "desktop";
}

/** The events one put() makes, as plain docs (without id): pure given `ctx` {now, w, dv}. */
export function eventsFor(col, id, doc, prev, ctx) {
  const out = [];
  const ev = (k, x = {}) => out.push({ k, ...x });
  if (col === "live" && id === "quiz") {
    const s = cut(doc.opened || doc.sentAt || prev?.opened);
    const more = { s };
    if (doc.sentAt && doc.sentAt !== prev?.sentAt) ev("sent", { s: cut(doc.sentAt) });
    if (doc.opened && doc.opened !== prev?.opened && !doc.finished) ev("opened", more);
    const was = prev?.actions?.length ?? 0;
    const last = doc.actions?.at?.(-1);
    if (!doc.finished && doc.actions?.length > was && last?.k === "a") {
      const t = ms(doc.at, prev?.at || doc.opened);
      ev("step", { ...more, q: cut(last.q), a: Number.isInteger(last.i) ? last.i : -1, n: doc.n ?? doc.actions.length, ...(Number.isFinite(t) ? { t: Math.round(t / 1000) } : {}) });
    }
    if (doc.finished && !prev?.finished) {
      const t = ms(doc.at, doc.opened);
      ev("finish", { ...more, n: doc.n ?? 0, ...(Number.isFinite(t) ? { t: Math.round(t / 1000) } : {}) });
    }
    if (doc.push && !prev?.push) ev("push", { ...more, ok: !!doc.push.ok, n: Array.isArray(doc.push.codes) ? doc.push.codes.length : 0 });
  } else if (col === "live" && id === "vote") {
    if (doc.p && doc.p !== prev?.p) ev("vote", { p: cut(doc.p), n: doc.o?.length ?? 0 });
  } else if (col === "history") {
    if (!prev && doc.f) ev("guess", { f: cut(doc.f), r: doc.top?.indexOf?.(doc.f) + 1 || 0, n: doc.top?.length ?? 0 });
    if (doc.goAt && !prev?.goAt) ev("going", { f: cut(doc.f), ...(doc.place ? { p: cut(doc.place) } : {}) });
    if (typeof doc.how === "number" && doc.how !== prev?.how) ev("howItWas", { f: cut(doc.f), a: doc.how });
  }
  const at = new Date(ctx.now).toISOString();
  const d = new Date(ctx.now);
  return out.map((e) => ({ ...e, at, h: d.getHours(), d: d.getDay(), dv: ctx.dv, ...(ctx.w ? { w: ctx.w } : {}) }));
}

let seq = 0;
/** Fire-and-forget: called from Store.put without await; every failure is swallowed. */
export async function record(store, col, id, doc, prev) {
  try {
    if (!store._writeDoc || !["live", "history"].includes(col)) return;
    const wx = cachedWeather(store.room?.settings?.city);
    const ctx = { now: Date.now(), dv: deviceType(), w: wx ? weatherKind(wx) ?? "mild" : null };
    for (const e of eventsFor(col, id, doc, prev, ctx)) {
      const eid = `${ctx.now.toString(36)}-${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      store._writeDoc("events", eid, e).catch(() => {}); // harmless: the log is optional
    }
  } catch {} // harmless: the log is optional
}

/** Per store kind (kept here so the shell stays small): Firestore getDocs, MemoryStore data, LocalStore storage. */
async function readAll(s) {
  if (s.sdk && s.roomRef) return (await (await s._live, s.sdk.getDocs(s.sdk.collection(s.roomRef, "events")))).docs.map((d) => d.data());
  const cols = s._data ? s._data().cols : s._read?.().cols;
  return Object.values(cols?.events ?? {});
}

/** All events of the room (a one-off read, not part of the live collections). [] when the store cannot read them. */
export async function loadEvents(store) {
  try {
    const rows = await readAll(store);
    return rows.filter((e) => e && EVENT_KINDS.includes(e.k)).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  } catch {
    return [];
  }
}
