import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { FIREBASE_CONFIG } from "./config.js";

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const gastosRef = collection(db, "gastos");
const presupuestosRef = doc(db, "config", "presupuestos");

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

function docAGasto(d) {
  const data = d.data();
  return {
    id: d.id,
    importe: data.importe,
    categoria: data.categoria,
    nota: data.nota || "",
    fecha: data.fecha ? data.fecha.toDate() : new Date(),
  };
}

// Gastos con inicio <= fecha < fin (Dates), del más reciente al más antiguo.
export async function gastosEntre(inicio, fin) {
  const q = query(
    gastosRef,
    where("fecha", ">=", Timestamp.fromDate(inicio)),
    where("fecha", "<", Timestamp.fromDate(fin)),
    orderBy("fecha", "desc")
  );
  const snap = await conTimeout(getDocs(q));
  return snap.docs.map(docAGasto);
}

// Todos los gastos guardados, del más antiguo al más reciente (para la copia de seguridad).
export async function todosLosGastos() {
  const snap = await conTimeout(getDocs(query(gastosRef, orderBy("fecha", "asc"))), 30000);
  return snap.docs.map(docAGasto);
}

// Escribe los gastos en lotes. Los que traen `id` se guardan con ese mismo id (así restaurar
// dos veces no duplica nada); los que no, reciben uno nuevo. Nunca borra documentos.
export async function importarGastos(gastos) {
  const TAM_LOTE = 400;
  for (let i = 0; i < gastos.length; i += TAM_LOTE) {
    const lote = writeBatch(db);
    gastos.slice(i, i + TAM_LOTE).forEach((g) => {
      const ref = g.id ? doc(db, "gastos", g.id) : doc(gastosRef);
      lote.set(ref, {
        importe: g.importe,
        categoria: g.categoria,
        nota: g.nota || "",
        fecha: Timestamp.fromDate(g.fecha),
      });
    });
    await conTimeout(lote.commit(), 30000);
  }
}

// Presupuestos: un único documento config/presupuestos con { [categoriaId]: limite }.
// Un límite ausente o 0 significa "sin presupuesto definido" para esa categoría.
export async function getPresupuestos() {
  const snap = await conTimeout(getDoc(presupuestosRef));
  return snap.exists() ? snap.data() : {};
}

export async function guardarPresupuestos(mapa) {
  return conTimeout(setDoc(presupuestosRef, mapa, { merge: true }));
}
