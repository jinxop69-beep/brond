// Service worker: guarda la app para que funcione sin conexión.
const CACHE = "mi-dia-kawaii-v27";
const FILES = ["./", "index.html", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Red primero (para recibir actualizaciones); si no hay conexión, usa la copia guardada.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = e.request.url;
  // Solo la app, las fuentes y la librería; la nube (Supabase) va siempre directa.
  const mine = url.startsWith(self.location.origin) || url.includes("fonts.") || url.includes("cdn.jsdelivr.net");
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
      .catch(() => caches.match(e.request, { ignoreSearch: url.startsWith(self.location.origin) })
        // La página de la app solo se usa como respuesta para abrir la app, nunca para un script o un estilo
        .then(r => r || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
