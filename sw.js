const CACHE_NAME = "spm-app-v3"; // 🔥 cambiá versión cuando actualices

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
  self.skipWaiting(); // 🔥 activa inmediatamente

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
            return caches.delete(key); // 🔥 borra versiones viejas
          }
        })
      )
    )
  );

  self.clients.claim(); // toma control inmediato
});


// =============================
// FETCH → offline-first
// =============================

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});