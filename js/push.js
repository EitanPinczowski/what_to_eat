// Web Push: subscription list logic (pure), guest-side relay calls, owner-side subscribe helpers.
// The relay (wte-push) builds the notification text itself; we only ever send a subscription and a kind.
export const VAPID_PUBLIC_KEY = "BMjWrD2gEyJKEaCD8HW5TtXu3DkbQlCViPoA1sFP2YqCUjdQTsHpOFxCKHco_IaO04a90XRv8TxXBdBWF-0Oo2Y";
export const RELAY_URL = "https://wte-push.vercel.app/api/send";
export const SCHEDULE_URL = RELAY_URL.replace(/send$/, "schedule");
export const MAX_SUBS = 4;
export const KINDS = ["quiz", "vote", "sweep", "test", "opened"];
export const FOOD_RE = /^[a-z_]{1,30}$/;

const valid = (s) => s && typeof s.endpoint === "string" && s.endpoint.startsWith("https://") && typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string";
const clean = (s) => ({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });

/** Add (or replace by endpoint) a subscription; keeps the newest MAX_SUBS. Never mutates. */
export function addSub(list, sub) {
  if (!valid(sub)) return Array.isArray(list) ? list.filter(valid) : [];
  const rest = (Array.isArray(list) ? list : []).filter((s) => valid(s) && s.endpoint !== sub.endpoint);
  return [...rest, clean(sub)].slice(-MAX_SUBS);
}

export const removeSub = (list, endpoint) => (Array.isArray(list) ? list : []).filter((s) => valid(s) && s.endpoint !== endpoint);
export const hasSub = (list, endpoint) => !!endpoint && (Array.isArray(list) ? list : []).some((s) => s?.endpoint === endpoint);

/** Which relay kind a guest event maps to; null for anything unknown. */
export const kindFor = (event) => ({ quiz: "quiz", vote: "vote", sweep: "sweep", test: "test", opened: "opened" })[event] ?? null;

/** The food id the relay may name in the notification: only a seed food whose id the relay accepts (custom foods and free text: none). */
export const pushFood = (food) => (food && !food.custom && typeof food.id === "string" && FOOD_RE.test(food.id) ? food.id : null);

/** The JSON body sent to the relay. `food` is added only for kind "quiz" and only when valid. */
export function relayBody(sub, kind, food) {
  const body = { sub: clean(sub), kind };
  if (kind === "quiz" && typeof food === "string" && FOOD_RE.test(food)) body.food = food;
  return body;
}

/** "She opened the quiz" ping: only when the owner turned it on, and once per `state` (one guest page session). */
export function notifyOpened(settings, state, f = globalThis.fetch, opts) {
  if (!settings?.notifyOpen || state.sent) return Promise.resolve([]);
  state.sent = true;
  return notifyAll(settings, "opened", f, opts);
}

/** Short stable id for an endpoint (FNV-1a, 8 hex). Lets the live quiz doc name a dead subscription without storing its URL. */
export function epHash(endpoint) {
  let h = 0x811c9dc5;
  for (const c of String(endpoint ?? "")) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/** Drop the subscriptions whose endpoint hash is in `hashes` (the relay said 410 for them). Never mutates. */
export function pruneDead(list, hashes) {
  const dead = new Set(Array.isArray(hashes) ? hashes : []);
  return (Array.isArray(list) ? list : []).filter((s) => valid(s) && !dead.has(epHash(s.endpoint)));
}

/** The list after this phone checked in: its current subscription is in, the one it used before (if different) is out. */
export function reconcile(list, current, knownEndpoint) {
  if (!valid(current)) return Array.isArray(list) ? list.filter(valid) : [];
  const base = knownEndpoint && knownEndpoint !== current.endpoint ? removeSub(list, knownEndpoint) : list;
  return addSub(base, current);
}

const isOk = (c) => c >= 200 && c < 300;

/** What she writes into the live quiz doc after a send: {sentAt, ok, codes} (ok = at least one device got a 2xx) plus the hashes the relay called gone. */
export function sendReport(subs, codes, now = new Date().toISOString()) {
  const dead = subs.filter((_, i) => codes[i] === 410).map((s) => epHash(s.endpoint));
  return { receipt: { sentAt: now, ok: codes.some(isOk), codes: codes.slice(0, MAX_SUBS) }, dead };
}

/** New dead-hash list for the live doc: old plus new, no repeats, at most 8. */
export const mergeDead = (old, add) => [...new Set([...(Array.isArray(old) ? old : []), ...add])].slice(-8);

let bound = null;
export const boundRoomId = () => bound?.roomId ?? "";
/** Tell this module which Store (room) the page runs in, so relay calls can be signed. */
export const bindRoom = (store) => {
  bound = store ?? null;
};

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const enc = (t) => new TextEncoder().encode(t);
/** sha-256 of a string, lowercase hex (the relay only ever sees this, never the room id). */
export const sha256Hex = async (text) => hex(await crypto.subtle.digest("SHA-256", enc(text)));
/** HMAC-SHA256(key, text), lowercase hex. */
export async function hmacHex(key, text) {
  const k = await crypto.subtle.importKey("raw", enc(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc(text)));
}
export const PUSH_KEY_RE = /^[0-9a-f]{64}$/;
/** A fresh random 256-bit relay key (hex). */
export const newPushKey = () => hex(crypto.getRandomValues(new Uint8Array(32)));

/** Headers that prove this room sent the body: room hash + HMAC of the exact body text. */
export async function signHeaders(roomId, pushKey, bodyText) {
  return { "x-wte-room": await sha256Hex(roomId), "x-wte-sig": await hmacHex(pushKey, bodyText) };
}

/** The room's pushKey; creates and stores one (through the Store) when missing. null when it cannot be had. */
async function ensureKey(store, timeout) {
  try {
    const cur = store.get()?.pushKey;
    if (PUSH_KEY_RE.test(cur ?? "")) return cur;
    const key = newPushKey();
    await Promise.race([store.update((db) => (db.pushKey = PUSH_KEY_RE.test(db.pushKey ?? "") ? db.pushKey : key)), new Promise((_, r) => setTimeout(r, timeout, new Error("timeout")))]);
    const now = store.get()?.pushKey;
    return PUSH_KEY_RE.test(now ?? "") ? now : null;
  } catch {
    return null;
  }
}

/** POST every stored subscription to the relay. Resolves to [{sub, code}] and never rejects. */
async function sendEach(settings, kind, f, { timeout = 4000, url = RELAY_URL, food } = {}) {
  const k = kindFor(kind);
  const subs = (settings?.push ?? []).filter(valid);
  if (!k || !subs.length || typeof f !== "function") return [];
  const key = bound?.roomId ? await ensureKey(bound, timeout) : null;
  return Promise.all(subs.map(async (sub) => {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const t = setTimeout(() => ctl?.abort(), timeout);
    try {
      const text = JSON.stringify(relayBody(sub, k, food));
      const sig = key ? await signHeaders(bound.roomId, key, text) : {};
      const post = (extra) => f(url, { method: "POST", headers: { "Content-Type": "application/json", ...sig, ...extra }, body: text, signal: ctl?.signal });
      let r = await post({});
      // First use of this room at the relay: it has no key yet, so offer ours once (HTTPS only; every later call is just signed).
      if (key && r?.status === 401 && (await r.json?.().catch(() => null))?.error === "unregistered") r = await post({ "x-wte-key": key });
      return { sub, code: r?.status ?? 0 };
    } catch {
      return { sub, code: 0 };
    } finally {
      clearTimeout(t);
    }
  }));
}

/** Signed POST of one JSON body to a relay endpoint (same HMAC and first-use key as send). Resolves to the status code, 0 = no answer; never rejects. */
export async function postSigned(url, bodyObj, f = globalThis.fetch, { timeout = 6000 } = {}) {
  if (typeof f !== "function") return 0;
  const key = bound?.roomId ? await ensureKey(bound, timeout) : null;
  if (!key) return 0;
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const t = setTimeout(() => ctl?.abort(), timeout);
  try {
    const text = JSON.stringify(bodyObj);
    const sig = await signHeaders(bound.roomId, key, text);
    const post = (extra) => f(url, { method: "POST", headers: { "Content-Type": "application/json", ...sig, ...extra }, body: text, signal: ctl?.signal });
    let r = await post({});
    if (r?.status === 401 && (await r.json?.().catch(() => null))?.error === "unregistered") r = await post({ "x-wte-key": key });
    return r?.status ?? 0;
  } catch {
    return 0;
  } finally {
    clearTimeout(t);
  }
}

/** Fire-and-forget: POST every stored subscription to the relay. Returns a promise that never rejects (status codes, 0 = no answer). */
export async function notifyAll(settings, kind, f = globalThis.fetch, opts = {}) {
  return (await sendEach(settings, kind, f, opts)).map((r) => r.code);
}

/** notifyAll plus the report for the live doc ({receipt, dead}); null when nothing was sent. */
export async function notifyReport(settings, kind, f = globalThis.fetch, opts = {}) {
  const res = await sendEach(settings, kind, f, opts);
  return res.length ? sendReport(res.map((r) => r.sub), res.map((r) => r.code)) : null;
}

/** "unsupported" | "blocked" | "off" (can ask) | "on" (permission granted; subscription checked separately). */
export function pushSupport(win = globalThis.window, nav = globalThis.navigator) {
  if (!win || !nav?.serviceWorker || !("PushManager" in win) || !("Notification" in win)) return "unsupported";
  if (win.Notification.permission === "denied") return "blocked";
  return "off";
}

export function urlB64ToBytes(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Ask permission (must run inside a tap), subscribe, return the subscription JSON. Throws "denied" / "nosw".
 *  fresh: drop this device's current subscription first (it may be dead; the push service then hands out a new endpoint). */
export async function subscribeThisDevice(win = globalThis.window, nav = globalThis.navigator, { fresh = false } = {}) {
  const perm = await win.Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");
  const ready = await swReady(nav);
  const old = await ready.pushManager.getSubscription();
  if (old && fresh) {
    try {
      await old.unsubscribe();
    } catch {
      /* harmless: a failed unsubscribe only means the old endpoint may stay */
    }
  }
  const sub = (!fresh ? old : null) ?? (await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(VAPID_PUBLIC_KEY) }));
  return sub.toJSON();
}

async function swReady(nav) {
  const reg = await nav.serviceWorker.getRegistration?.();
  return reg ?? (await Promise.race([nav.serviceWorker.ready, new Promise((_, r) => setTimeout(r, 5000, new Error("nosw")))]));
}

/** With permission already granted (no prompt): this device's subscription, created when missing. null when it cannot be had. */
export async function ensureSub(nav = globalThis.navigator) {
  try {
    const ready = await swReady(nav);
    const sub = (await ready.pushManager.getSubscription()) ?? (await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(VAPID_PUBLIC_KEY) }));
    return sub.toJSON();
  } catch {
    return null;
  }
}

const EP_KEY = "wte.pushEp";
/** The endpoint this device last stored in settings.push (local only; never leaves the phone). */
export const knownEndpoint = (st = globalThis.localStorage) => {
  try {
    return st?.getItem(EP_KEY) ?? "";
  } catch {
    return "";
  }
};
export const rememberEndpoint = (ep, st = globalThis.localStorage) => {
  try {
    if (ep) st?.setItem(EP_KEY, ep);
    else st?.removeItem(EP_KEY);
  } catch {
    /* harmless: without storage the next start just re-checks */
  }
};

export async function repairOnStart(store, env = {}) {
  const { win = globalThis.window, nav = globalThis.navigator, st = globalThis.localStorage } = env;
  const out = { pruned: 0, replaced: false };
  const live = store.doc("live", "quiz");
  if (Array.isArray(live?.dead) && live.dead.length) {
    const before = store.get().settings.push ?? [];
    const after = pruneDead(before, live.dead);
    out.pruned = before.length - after.length;
    if (out.pruned) await store.update((db) => (db.settings.push = pruneDead(db.settings.push, live.dead)));
    const { id: _id, dead: _d, ...rest } = live;
    await store.put("live", "quiz", rest);
  }
  if (pushSupport(win, nav) === "unsupported" || win.Notification.permission !== "granted") return out;
  const known = knownEndpoint(st);
  const cur = await currentSub(nav);
  const enabled = !!known || (!!cur && hasSub(store.get().settings.push, cur.endpoint));
  if (!enabled) return out;
  const sub = cur ?? (await ensureSub(nav));
  if (!sub) return out;
  const list = store.get().settings.push ?? [];
  const next = reconcile(list, sub, known);
  if (JSON.stringify(next) !== JSON.stringify(list)) {
    await store.update((db) => (db.settings.push = reconcile(db.settings.push, sub, known)));
    out.replaced = true;
  }
  rememberEndpoint(sub.endpoint, st);
  return out;
}

/** This device's current subscription JSON, or null. */
export async function currentSub(nav = globalThis.navigator) {
  try {
    const reg = await nav.serviceWorker?.getRegistration?.();
    return (await reg?.pushManager?.getSubscription())?.toJSON() ?? null;
  } catch {
    return null;
  }
}

/** Unsubscribe this device; returns the old endpoint (or ""). */
export async function unsubscribeThisDevice(nav = globalThis.navigator) {
  try {
    const reg = await nav.serviceWorker?.getRegistration?.();
    const sub = await reg?.pushManager?.getSubscription();
    const ep = sub?.endpoint ?? "";
    await sub?.unsubscribe();
    return ep;
  } catch {
    return "";
  }
}
