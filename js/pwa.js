// PWA: register sw.js, offer "גרסה חדשה — לרענן?" when a new worker is waiting, install help.
import { STR } from "./data/strings.js";

/** Register the worker; onUpdate(apply) is called when a new version is ready. */
export async function registerSW(onUpdate, nav = globalThis.navigator, win = globalThis.window) {
  if (!nav?.serviceWorker || win?.location?.protocol === "file:") return null;
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(win?.location?.hostname ?? "");
  if (isLocal && !win.location.search.includes("sw")) return null; // dev + e2e: no cache surprises (add ?sw to test)
  const reg = await nav.serviceWorker.register("sw.js").catch(() => null);
  if (!reg) return null;
  let reloading = false;
  nav.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloading) (reloading = true), win.location.reload();
  });
  const offer = (w) => w && nav.serviceWorker.controller && onUpdate(() => w.postMessage("skipWaiting"));
  offer(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const w = reg.installing;
    w?.addEventListener("statechange", () => w.state === "installed" && offer(w));
  });
  // Check again when the app comes back to the front (PWAs stay open for days).
  win.document?.addEventListener("visibilitychange", () => win.document.visibilityState === "visible" && reg.update().catch(() => {})); // harmless: best effort
  return reg;
}

/** Which install help to show: "ios" | "android" | "installed" | "other". */
export function installKind(nav = globalThis.navigator, win = globalThis.window) {
  const standalone = nav?.standalone === true || win?.matchMedia?.("(display-mode: standalone)")?.matches;
  if (standalone) return "installed";
  const ua = nav?.userAgent ?? "";
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav?.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export const installHelp = (kind) => STR.install[kind] ?? STR.install.other;
