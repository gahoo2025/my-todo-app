// Service worker for the standalone Pac-Man PWA.
// Scoped narrowly to the game's own assets so it never interferes with the
// Todo app's own service worker / caching.
const CACHE = "pacman-v1";
const ASSETS = [
  "/pacman.html",
  "/pacman.webmanifest",
  "/icons/pacman-192.png",
  "/icons/pacman-512.png",
  "/icons/pacman-apple-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("pacman-") && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isGameAsset(pathname) {
  return pathname === "/pacman.html"
    || pathname === "/pacman.webmanifest"
    || pathname.startsWith("/icons/pacman-");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!isGameAsset(url.pathname)) return; // leave everything else to the network / other SW

  // Cache-first, then network (and refresh the cache in the background).
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }).catch(() => cached || caches.match("/pacman.html"));
      return cached || network;
    })
  );
});
