const CACHE = "gastos-v2";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./css/estilo.css",
  "./js/app.js",
  "./js/config.js",
  "./js/firebase.js",
  "./js/graficos.js",
  "./js/exportar.js",
  "./js/ui.js",
  "./js/vista-registro.js",
  "./js/vista-resumen.js",
  "./manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Firestore/Firebase: siempre red, nunca cache
  if (url.hostname.includes("firestore") || url.hostname.includes("googleapis") || url.hostname.includes("gstatic")) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request, { cache: "no-store" }))
  );
});
