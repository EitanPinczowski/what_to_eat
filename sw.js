// Service worker: offline app shell. VERSION is stamped with the commit id at deploy (.github/workflows).
// Same-origin GETs: stale-while-revalidate. Cross-origin (Firebase, ntfy, fonts) goes straight to the network.
const VERSION = "__VERSION__";
const CACHE = `wte-${VERSION}`;
// The app shell AND every module reachable from js/main.js, so one deploy is served as one version
// (a test fails when a module imported from main.js is missing here). Regenerate the js/ part after adding a module.
const SHELL = [
  "./",
  "index.html",
  "css/tokens.css",
  "css/style.css",
  "manifest.webmanifest",
  "img/icons/icon-192.png",
  "js/data/constants.js",
  "js/data/cuisines.js",
  "js/data/foods.js",
  "js/data/questions.js",
  "js/data/recipes.js",
  "js/data/strings.js",
  "js/data/tags.js",
  "js/engine/foods.js",
  "js/engine/learn.js",
  "js/engine/mood.js",
  "js/engine/prior.js",
  "js/engine/quiz.js",
  "js/engine/similarity.js",
  "js/engine/weather.js",
  "js/engine/wrapped.js",
  "js/firebase-config.js",
  "js/main.js",
  "js/places/links.js",
  "js/places/picker.js",
  "js/places/cuisine.js",
  "js/push.js",
  "js/pwa.js",
  "js/router.js",
  "js/share/codec.js",
  "js/share/links.js",
  "js/share/whatsapp.js",
  "js/store/firebase.js",
  "js/store/local.js",
  "js/store/open.js",
  "js/store/room-backup.js",
  "js/store/store.js",
  "js/ui/dom.js",
  "js/ui/guest/quiz.js",
  "js/ui/guest/session.js",
  "js/ui/guest/sweep.js",
  "js/ui/guest/wrapped.js",
  "js/ui/owner/app.js",
  "js/ui/owner/backup-due.js",
  "js/ui/owner/brain.js",
  "js/ui/owner/history.js",
  "js/ui/owner/live-status.js",
  "js/ui/owner/places.js",
  "js/ui/owner/recent.js",
  "js/ui/owner/send-sweep.js",
  "js/ui/owner/send-wrapped.js",
  "js/ui/owner/settings.js",
  "js/ui/owner/shopping.js",
  "js/sw-format.js",
  "js/sw-names.js",
  "js/ui/pics.js",
  "js/weather.js"
];

// Classic worker (works in every push-capable browser, unlike module workers): the food names and the text
// formatter are plain scripts loaded here; tests/push.test.js keeps js/sw-names.js in sync with js/data/foods.js.
importScripts("js/sw-names.js", "js/sw-format.js");

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("wte-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page asks the waiting worker to take over after "גרסה חדשה — לרענן?".
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

const PHOTO_CACHE = "photos-v1";
const PHOTO_MAX = 200;
async function photo(req) {
  const cache = await caches.open(PHOTO_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req).catch(() => null);
  if (!res) return Response.error();
  if (res.ok) {
    await cache.put(req, res.clone());
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - PHOTO_MAX))) await cache.delete(k); // oldest first
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Only the app root / index.html is the app shell (hash and ?store= routes all load it); photos.html etc. are their own pages.
  // Food photos: their own bounded cache-first cache (not in the shell precache; "photos-" is never swept by the "wte-" cleanup).
  if (/\/img\/foods\/[\w-]+\.webp$/.test(url.pathname)) return e.respondWith(photo(req));
  const appPage = req.mode === "navigate" && /(^|\/)(index\.html)?$/.test(url.pathname);
  const key = appPage ? "index.html" : req;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(key, { ignoreSearch: appPage });
      const net = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => hit ?? Response.error());
      return hit ?? net;
    }),
  );
});

// Web Push. The relay sends JSON {title, body, url, kind, food?}; a known food id turns the body into "<her> בחרה: <food> <emoji>".
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : "" };
  }
  const n = self.wteFormatPush(d, self.WTE_FOOD_NAMES);
  e.waitUntil(
    self.registration.showNotification(n.title, {
      body: n.body,
      icon: "img/icons/icon-192.png",
      badge: "img/icons/icon-192.png",
      dir: "rtl",
      lang: "he",
      tag: n.tag, // one slot per kind; renotify makes a second result alert again instead of merging silently
      renotify: true,
      data: { url: typeof d.url === "string" ? d.url : self.registration.scope },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const w = list.find((c) => c.url.startsWith(self.registration.scope));
      return w ? w.focus() : self.clients.openWindow(url);
    }),
  );
});

// The push service rotated or expired this phone's subscription: subscribe again with the same key and tell the open
// app (a worker cannot reach Firestore). The owner app also re-checks its subscription on every start, so a missed message is repaired then.
// Keep in sync with VAPID_PUBLIC_KEY in js/push.js (tests/push.test.js checks).
const VAPID_PUBLIC_KEY = "BMjWrD2gEyJKEaCD8HW5TtXu3DkbQlCViPoA1sFP2YqCUjdQTsHpOFxCKHco_IaO04a90XRv8TxXBdBWF-0Oo2Y";
const keyBytes = (s) => Uint8Array.from(atob((s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil(
    (async () => {
      const sub = e.newSubscription ?? (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: e.oldSubscription?.options?.applicationServerKey ?? keyBytes(VAPID_PUBLIC_KEY) }));
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of list) c.postMessage({ type: "wte-sub-changed", sub: sub.toJSON() });
    })().catch((err) => console.error("pushsubscriptionchange", err)),
  );
});
