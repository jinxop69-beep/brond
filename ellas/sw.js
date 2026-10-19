// Service worker: guarda la app para que funcione sin conexión.
const CACHE = "ellas-v1";
const FILES = ["./", "index.html", "poemas.js", "articulos.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("ellas-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Red primero (para recibir actualizaciones); si no hay conexión, usa la copia guardada.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = e.request.url;
  // Solo la app y las fuentes; Wikipedia va directa (la app guarda sus respuestas).
  const mine = url.startsWith(self.registration.scope) || url.includes("fonts.");
  if (!mine) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("index.html")))
  );
});
