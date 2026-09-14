import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { FIREBASE_CONFIG } from "./config.js";

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const gastosRef = collection(db, "gastos");

export function estaConfigurado() {
  return !Object.values(FIREBASE_CONFIG).some((v) => String(v).includes("PEGA_AQUI"));
}

// El SDK de Firestore reintenta en silencio si no hay conexión o el proyecto
// no existe, sin rechazar la promesa — en el móvil por NFC eso significa un
// botón "Guardando..." colgado para siempre. Este timeout da feedback igual.
function conTimeout(promesa, ms = 10000) {
  return Promise.race([
    promesa,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Sin conexión. Inténtalo de nuevo.")), ms)
    ),
  ]);
}

// gasto: { importe, categoria, nota, fecha: Date|null }
export async function crearGasto(gasto) {
  return conTimeout(
    addDoc(gastosRef, {
      importe: gasto.importe,
      categoria: gasto.categoria,
      nota: gasto.nota || "",
      fecha: gasto.fecha ? Timestamp.fromDate(gasto.fecha) : serverTimestamp(),
    })
  );
}

export async function actualizarGasto(id, gasto) {
  return conTimeout(
    updateDoc(doc(db, "gastos", id), {
      importe: gasto.importe,
      categoria: gasto.categoria,
      nota: gasto.nota || "",
      fecha: Timestamp.fromDate(gasto.fecha),
    })
  );
}

export async function borrarGasto(id) {
  return conTimeout(deleteDoc(doc(db, "gastos", id)));
}

// Devuelve los gastos del mes indicado (Date, cualquier día de ese mes), ordenados desc.
export async function gastosDelMes(fechaEnMes) {
  const inicio = new Date(fechaEnMes.getFullYear(), fechaEnMes.getMonth(), 1);
  const fin = new Date(fechaEnMes.getFullYear(), fechaEnMes.getMonth() + 1, 1);
  const q = query(
    gastosRef,
    where("fecha", ">=", Timestamp.fromDate(inicio)),
    where("fecha", "<", Timestamp.fromDate(fin)),
    orderBy("fecha", "desc")
  );
  const snap = await conTimeout(getDocs(q));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      importe: data.importe,
      categoria: data.categoria,
      nota: data.nota || "",
      fecha: data.fecha ? data.fecha.toDate() : new Date(),
    };
  });
}
