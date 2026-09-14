// =============================
// CONFIG
// =============================

const CACHE_NAME = "spm-app-v9";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./assets/fonts/oswald-latin-variable.woff2",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/logo-wordmark.png"
];


// =============================
// INSTALL → guarda archivos
// =============================

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});


// =============================
// ACTIVATE → limpia caches viejos
// =============================

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});


// =============================
// FETCH → cache + actualización automática
// =============================

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cachedResponse) => {

        // Siempre intenta traer versión nueva en segundo plano
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          })
          .catch(
            () =>
              cachedResponse ||
              new Response("Offline", { status: 503, statusText: "Offline" })
          );

        // Responde rápido con cache (si existe)
        return cachedResponse || fetchPromise;
      })
    )
  );
});