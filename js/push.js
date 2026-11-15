// Web Push: subscription list logic (pure), guest-side relay calls, owner-side subscribe helpers.
// The relay (wte-push) builds the notification text itself; we only ever send a subscription and a kind.
export const VAPID_PUBLIC_KEY = "BMjWrD2gEyJKEaCD8HW5TtXu3DkbQlCViPoA1sFP2YqCUjdQTsHpOFxCKHco_IaO04a90XRv8TxXBdBWF-0Oo2Y";
export const RELAY_URL = "https://wte-push.vercel.app/api/send";
export const MAX_SUBS = 4;
export const KINDS = ["quiz", "vote", "sweep", "test"];

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
export const kindFor = (event) => ({ quiz: "quiz", vote: "vote", sweep: "sweep", test: "test" })[event] ?? null;

/** Fire-and-forget: POST every stored subscription to the relay. Returns a promise that never rejects. */
export async function notifyAll(settings, kind, f = globalThis.fetch, { timeout = 4000, url = RELAY_URL } = {}) {
  const k = kindFor(kind);
  const subs = (settings?.push ?? []).filter(valid);
  if (!k || !subs.length || typeof f !== "function") return [];
  return Promise.all(subs.map(async (sub) => {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const t = setTimeout(() => ctl?.abort(), timeout);
    try {
      const r = await f(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sub: clean(sub), kind: k }), signal: ctl?.signal });
      return r?.status ?? 0;
    } catch {
      return 0;
    } finally {
      clearTimeout(t);
    }
  }));
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

/** Ask permission (must run inside a tap), subscribe, return the subscription JSON. Throws "denied" / "nosw". */
export async function subscribeThisDevice(win = globalThis.window, nav = globalThis.navigator) {
  const perm = await win.Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");
  const reg = await nav.serviceWorker.getRegistration?.();
  const ready = reg ?? (await Promise.race([nav.serviceWorker.ready, new Promise((_, r) => setTimeout(r, 5000, new Error("nosw")))]));
  const sub = (await ready.pushManager.getSubscription()) ?? (await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(VAPID_PUBLIC_KEY) }));
  return sub.toJSON();
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
