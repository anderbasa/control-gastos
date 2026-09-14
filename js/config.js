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

// Lista cerrada de categorías. Añadir una nueva = añadir un objeto aquí.
export const CATEGORIAS = [
  { id: "comida", nombre: "Comida", emoji: "🍔", color: "#E4572E" },
  { id: "transporte", nombre: "Transporte", emoji: "🚌", color: "#3B82C4" },
  { id: "ocio", nombre: "Ocio", emoji: "🎉", color: "#8E44AD" },
  { id: "compras", nombre: "Compras", emoji: "🛍️", color: "#D4A017" },
  { id: "facturas", nombre: "Facturas/Suscripciones", emoji: "🧾", color: "#546E7A" },
  { id: "salud", nombre: "Salud", emoji: "💊", color: "#2E9E6D" },
  { id: "otros", nombre: "Otros", emoji: "📦", color: "#8D8D8D" },
];

export function getCategoria(id) {
  return CATEGORIAS.find((c) => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];
}
