import { todosLosGastos, getPresupuestos, importarGastos, guardarPresupuestos } from "./firebase.js";
import { mostrarToast, guardarArchivo } from "./ui.js";

const VERSION_COPIA = 1;
const MAX_BYTES = 5 * 1024 * 1024;
const CLAVE_ULTIMA_COPIA = "gastos.ultimaCopia";
const CLAVE_POSPUESTO = "gastos.avisoCopiaPospuestoHasta";
const DIAS_HASTA_AVISO = 30;
const DIAS_AL_POSPONER = 7;
const ID_VALIDO = /^[A-Za-z0-9_-]{1,100}$/;
const DIA_MS = 86400000;

const $avisoCopia = document.getElementById("aviso-copia");
const $avisoTexto = document.getElementById("aviso-copia-texto");
const $btnAvisoCopia = document.getElementById("btn-aviso-copia");
const $btnAvisoLuego = document.getElementById("btn-aviso-luego");
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

function leerLocal(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardarLocal(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
    return true;
  } catch {
    return false;
  }
}

function almacenamientoDisponible() {
  try {
    localStorage.setItem("gastos.prueba", "1");
    localStorage.removeItem("gastos.prueba");
    return true;
  } catch {
    return false;
  }
}

function leerUltimaCopia() {
  return leerLocal(CLAVE_ULTIMA_COPIA);
}

function pintarUltimaCopia() {
  const iso = leerUltimaCopia();
  if (!iso) {
    $ultima.textContent = "Aún no has descargado ninguna copia desde este dispositivo.";
    return;
  }
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / DIA_MS);
  const cuando = dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
  $ultima.textContent = `Última copia descargada: ${cuando}.`;
}

// Decide si toca avisar de que falta una copia: nunca se ha descargado ninguna (desde este
// dispositivo) o la última tiene DIAS_HASTA_AVISO días o más. Si el aviso se ha pospuesto, no.
export function necesitaAviso({ ultimaCopia, pospuestoHasta, ahora = Date.now() }) {
  if (pospuestoHasta && ahora < new Date(pospuestoHasta).getTime()) return { mostrar: false };
  if (!ultimaCopia) {
    return { mostrar: true, texto: "Aún no has hecho ninguna copia de seguridad de tus gastos desde este dispositivo." };
  }
  const dias = Math.floor((ahora - new Date(ultimaCopia).getTime()) / DIA_MS);
  if (dias < DIAS_HASTA_AVISO) return { mostrar: false };
  return { mostrar: true, texto: `Tu última copia de seguridad es de hace ${dias} días.` };
}

function evaluarAviso() {
  // Sin localStorage no se podría recordar ni la copia ni el "más tarde": mejor no avisar nunca que avisar siempre.
  const disponible = almacenamientoDisponible();
  const aviso = disponible
    ? necesitaAviso({ ultimaCopia: leerUltimaCopia(), pospuestoHasta: leerLocal(CLAVE_POSPUESTO) })
    : { mostrar: false };
  $avisoCopia.classList.toggle("oculto", !aviso.mostrar);
  if (aviso.mostrar) $avisoTexto.textContent = aviso.texto;
}

function posponerAviso() {
  guardarLocal(CLAVE_POSPUESTO, new Date(Date.now() + DIAS_AL_POSPONER * DIA_MS).toISOString());
  evaluarAviso();
}

async function onDescargar() {
  $btnDescargar.disabled = true;
  $btnAvisoCopia.disabled = true;
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
    const hoy = new Date();
    const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    const blob = new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" });
    const entregada = await guardarArchivo(blob, `control-gastos-copia-${dia}.json`);
    // Si se cierra el menú Compartir sin guardar, la copia no cuenta como hecha.
    if (!entregada) return;
    guardarLocal(CLAVE_ULTIMA_COPIA, new Date().toISOString());
    pintarUltimaCopia();
    evaluarAviso();
    mostrarToast(`Copia guardada (${plural(gastos.length, "gasto", "gastos")})`);
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo crear la copia: " + err.message);
  } finally {
    $btnDescargar.disabled = false;
    $btnAvisoCopia.disabled = false;
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
  evaluarAviso();
  $btnDescargar.addEventListener("click", onDescargar);
  $btnAvisoCopia.addEventListener("click", onDescargar);
  $btnAvisoLuego.addEventListener("click", posponerAviso);
  $btnRestaurar.addEventListener("click", () => $inputCopia.click());
  $inputCopia.addEventListener("change", onArchivoElegido);
  $btnConfirmar.addEventListener("click", onConfirmarRestaurar);
  $btnCancelar.addEventListener("click", ocultarPreview);
}
