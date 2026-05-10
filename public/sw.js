// ConectaCRM Service Worker
const CACHE = "ccrm-v1";
const ASSETS = ["/", "/painel", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Network-first for navigations and API calls; cache-first for static assets
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }
  if (url.origin === location.origin && /\.(png|jpg|jpeg|svg|webp|woff2?|css|js)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
      )
    );
  }
});
