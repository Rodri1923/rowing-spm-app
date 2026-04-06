// =============================
// CONFIG
// =============================

const CACHE_NAME = "spm-app";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js"
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
          .catch(() => cachedResponse);

        // Responde rápido con cache (si existe)
        return cachedResponse || fetchPromise;
      })
    )
  );
});