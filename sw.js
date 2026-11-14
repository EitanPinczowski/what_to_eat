// Service worker: offline app shell. VERSION is stamped with the commit id at deploy (.github/workflows).
// Same-origin GETs: stale-while-revalidate. Cross-origin (Firebase, ntfy, fonts) goes straight to the network.
const VERSION = "__VERSION__";
const CACHE = `wte-${VERSION}`;
const SHELL = ["./", "index.html", "css/tokens.css", "css/style.css", "js/main.js", "manifest.webmanifest", "img/icons/icon-192.png"];

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

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const key = req.mode === "navigate" ? "index.html" : req; // hash routes all load index.html
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(key, { ignoreSearch: req.mode === "navigate" });
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
