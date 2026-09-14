// Configuración de Firebase — PEGA AQUÍ tus credenciales
// (Firebase Console → Configuración del proyecto → Tus apps → Config del SDK)
export const FIREBASE_CONFIG = {
  apiKey: "PEGA_AQUI_TU_API_KEY",
  authDomain: "PEGA_AQUI.firebaseapp.com",
  projectId: "PEGA_AQUI",
  storageBucket: "PEGA_AQUI.appspot.com",
  messagingSenderId: "PEGA_AQUI",
  appId: "PEGA_AQUI",
};

// Iconos de línea (paths interiores de un <svg viewBox="0 0 24 24">), sin emoji.
const ICONOS = {
  comida: '<path d="M5 2v6M9 2v6M13 2v6"/><path d="M5 8c0 2 1.8 3 4 3s4-1 4-3"/><path d="M9 11v11"/>',
  transporte:
    '<rect x="3" y="5" width="18" height="12" rx="3"/><path d="M3 12h18"/><path d="M6 8h4M14 8h4"/><circle cx="7.5" cy="19.5" r="1.5"/><circle cx="16.5" cy="19.5" r="1.5"/>',
  ocio: '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z"/><path d="M12 6v2M12 11v2M12 16v2"/>',
  compras:
    '<path d="M5 9h14l-1.2 10.5a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 9Z"/><path d="M9 9V6.5a3 3 0 0 1 6 0V9"/>',
  facturas: '<path d="M6 2h12v18l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  salud:
    '<path d="M12 20s-6.5-4.35-9-8.5C1.2 8.1 2.3 4.5 6 4c2 0 3.6 1.4 4 3 .4-1.6 2-3 4-3 3.7.5 4.8 4.1 3 7.5-2.5 4.15-9 8.5-9 8.5Z"/><path d="M4.5 12H8l1.8 3.6L13 8l1.8 4H19.5"/>',
  otros: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
};

// Lista cerrada de categorías. Añadir una nueva = añadir un objeto aquí
// (y un icono en ICONOS de arriba; si se omite, se usa el de "otros").
export const CATEGORIAS = [
  { id: "comida", nombre: "Comida", color: "#E4572E" },
  { id: "transporte", nombre: "Transporte", color: "#3B82C4" },
  { id: "ocio", nombre: "Ocio", color: "#8E44AD" },
  { id: "compras", nombre: "Compras", color: "#D4A017" },
  { id: "facturas", nombre: "Facturas/Suscripciones", color: "#546E7A" },
  { id: "salud", nombre: "Salud", color: "#2E9E6D" },
  { id: "otros", nombre: "Otros", color: "#8D8D8D" },
].map((c) => ({ ...c, icono: ICONOS[c.id] || ICONOS.otros }));

export function getCategoria(id) {
  return CATEGORIAS.find((c) => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];
}
