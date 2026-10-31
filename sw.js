const CACHE = "gastos-v10";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./css/estilo.css",
  "./js/app.js",
  "./js/config.js",
  "./js/copia.js",
  "./js/firebase.js",
  "./js/graficos.js",
  "./js/graficos-informe.js",
  "./js/excel.js",
  "./js/teclado.js",
  "./js/ui.js",
  "./js/vista-registro.js",
  "./js/vista-resumen.js",
  "./manifest.json",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
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

// Primero la red (para que la app de pantalla de inicio coja siempre la última versión) y, si no
// hay conexión, la copia guardada. Solo los archivos propios: Firebase, fuentes y ExcelJS van directos.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-store" })
      .then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
