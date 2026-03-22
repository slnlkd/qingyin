const CACHE_NAME = "qingyin-static-v24";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=20260322a",
  "./app.js?v=20260322a",
  "./manifest.webmanifest?v=20260322a",
  "./assets/icon-192.svg",
  "./assets/icon-512.svg",
  "./assets/favicon.svg?v=20260322a",
  "./assets/design-reference.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
