import { todosLosGastos, getPresupuestos, importarGastos, guardarPresupuestos } from "./firebase.js";
import { mostrarToast } from "./ui.js";

const VERSION_COPIA = 1;
const MAX_BYTES = 5 * 1024 * 1024;
const CLAVE_ULTIMA_COPIA = "gastos.ultimaCopia";
const ID_VALIDO = /^[A-Za-z0-9_-]{1,100}$/;

const $btnDescargar = document.getElementById("btn-descargar-copia");
const $btnRestaurar = document.getElementById("btn-restaurar-copia");
const $inputCopia = document.getElementById("input-copia");
const $ultima = document.getElementById("copia-ultima");
const $preview = document.getElementById("copia-preview");
const $previewTexto = document.getElementById("copia-preview-texto");
const $btnConfirmar = document.getElementById("btn-confirmar-restaurar");
const $btnCancelar = document.getElementById("btn-cancelar-restaurar");

let copiaPendiente = null;

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function leerUltimaCopia() {
  try {
    return localStorage.getItem(CLAVE_ULTIMA_COPIA);
  } catch {
    return null;
  }
}

function guardarUltimaCopia() {
  try {
    localStorage.setItem(CLAVE_ULTIMA_COPIA, new Date().toISOString());
  } catch {
    // sin localStorage solo se pierde el recordatorio
  }
}

function pintarUltimaCopia() {
  const iso = leerUltimaCopia();
  if (!iso) {
    $ultima.textContent = "Aún no has descargado ninguna copia desde este dispositivo.";
    return;
  }
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const cuando = dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
  $ultima.textContent = `Última copia descargada: ${cuando}.`;
}

function descargarArchivo(nombre, texto) {
  const blob = new Blob([texto], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function onDescargar() {
  $btnDescargar.disabled = true;
  try {
    const [gastos, presupuestos] = await Promise.all([todosLosGastos(), getPresupuestos()]);
    const copia = {
      app: "control-gastos",
      version: VERSION_COPIA,
      exportadoEn: new Date().toISOString(),
      gastos: gastos.map((g) => ({
        id: g.id,
        importe: g.importe,
        categoria: g.categoria,
        nota: g.nota,
        fecha: g.fecha.toISOString(),
      })),
      presupuestos,
    };
    const dia = new Date().toISOString().slice(0, 10);
    descargarArchivo(`control-gastos-copia-${dia}.json`, JSON.stringify(copia, null, 2));
    guardarUltimaCopia();
    pintarUltimaCopia();
    mostrarToast(`Copia descargada (${plural(gastos.length, "gasto", "gastos")})`);
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo crear la copia: " + err.message);
  } finally {
    $btnDescargar.disabled = false;
  }
}

// Valida el contenido de un archivo de copia. Los gastos que no cumplen las reglas de la base de
// datos (importe numérico > 0, categoría de texto, fecha válida) se descartan y se cuentan.
export function analizarCopia(texto) {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error("El archivo no es una copia válida (no es JSON).");
  }
  if (!datos || datos.app !== "control-gastos" || !Array.isArray(datos.gastos)) {
    throw new Error("El archivo no parece una copia de Control de Gastos.");
  }
  if (datos.version > VERSION_COPIA) {
    throw new Error("La copia es de una versión más nueva de la app.");
  }

  const gastos = [];
  let descartados = 0;
  datos.gastos.forEach((g) => {
    const fecha = new Date(g?.fecha);
    const valido =
      g &&
      typeof g.importe === "number" &&
      Number.isFinite(g.importe) &&
      g.importe > 0 &&
      typeof g.categoria === "string" &&
      g.categoria.length > 0 &&
      !Number.isNaN(fecha.getTime());
    if (!valido) {
      descartados++;
      return;
    }
    gastos.push({
      id: typeof g.id === "string" && ID_VALIDO.test(g.id) ? g.id : null,
      importe: g.importe,
      categoria: g.categoria,
      nota: typeof g.nota === "string" ? g.nota.slice(0, 200) : "",
      fecha,
    });
  });

  const presupuestos = {};
  if (datos.presupuestos && typeof datos.presupuestos === "object") {
    Object.entries(datos.presupuestos).forEach(([id, limite]) => {
      if (ID_VALIDO.test(id) && typeof limite === "number" && Number.isFinite(limite) && limite >= 0) {
        presupuestos[id] = limite;
      }
    });
  }

  return { gastos, presupuestos, descartados, exportadoEn: datos.exportadoEn };
}

function ocultarPreview() {
  copiaPendiente = null;
  $preview.classList.add("oculto");
  $inputCopia.value = "";
}

async function onArchivoElegido() {
  const archivo = $inputCopia.files[0];
  if (!archivo) return;
  if (archivo.size > MAX_BYTES) {
    mostrarToast("El archivo es demasiado grande para ser una copia");
    ocultarPreview();
    return;
  }
  try {
    copiaPendiente = analizarCopia(await archivo.text());
  } catch (err) {
    mostrarToast(err.message);
    ocultarPreview();
    return;
  }
  const { gastos, presupuestos, descartados, exportadoEn } = copiaPendiente;
  const fecha = exportadoEn ? new Date(exportadoEn).toLocaleDateString("es-ES") : "fecha desconocida";
  const nPresupuestos = Object.values(presupuestos).filter((v) => v > 0).length;
  let texto = `Copia del ${fecha}: ${plural(gastos.length, "gasto", "gastos")} y ${plural(nPresupuestos, "presupuesto", "presupuestos")}.`;
  if (descartados) texto += ` Se ignorará${descartados === 1 ? "" : "n"} ${plural(descartados, "entrada no válida", "entradas no válidas")}.`;
  $previewTexto.textContent = texto;
  $btnConfirmar.disabled = gastos.length === 0 && nPresupuestos === 0;
  $preview.classList.remove("oculto");
}

async function onConfirmarRestaurar() {
  if (!copiaPendiente) return;
  const { gastos, presupuestos } = copiaPendiente;
  $btnConfirmar.disabled = true;
  $btnConfirmar.textContent = "Restaurando...";
  try {
    if (gastos.length) await importarGastos(gastos);
    if (Object.keys(presupuestos).length) await guardarPresupuestos(presupuestos);
    mostrarToast(`Copia restaurada (${plural(gastos.length, "gasto", "gastos")})`);
    ocultarPreview();
    document.dispatchEvent(new CustomEvent("datos-restaurados"));
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo restaurar: " + err.message);
  } finally {
    $btnConfirmar.disabled = false;
    $btnConfirmar.textContent = "Restaurar";
  }
}

export function initCopia() {
  pintarUltimaCopia();
  $btnDescargar.addEventListener("click", onDescargar);
  $btnRestaurar.addEventListener("click", () => $inputCopia.click());
  $inputCopia.addEventListener("change", onArchivoElegido);
  $btnConfirmar.addEventListener("click", onConfirmarRestaurar);
  $btnCancelar.addEventListener("click", ocultarPreview);
}
