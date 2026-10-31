import { CATEGORIAS, getCategoria } from "./config.js";
import { crearGasto, actualizarGasto, borrarGasto, importarGastos } from "./firebase.js";
import { mostrarToast, svgIcono, formatoEuros } from "./ui.js";
import { crearTeclado, parseImporte } from "./teclado.js";

// --- Elementos: paso 1 (importe) ---
const $pasoImporte = document.getElementById("paso-importe");
const $importeValorHome = document.getElementById("importe-valor-home");
const $tecladoHomeEl = document.getElementById("teclado-home");
const $btnNotaToggleHome = document.getElementById("btn-nota-toggle-home");
const $inputNotaHome = document.getElementById("input-nota-home");
const $btnFechaToggleHome = document.getElementById("btn-fecha-toggle-home");
const $inputFechaHome = document.getElementById("input-fecha-home");
const $btnSiguiente = document.getElementById("btn-siguiente");

// --- Elementos: paso 2 (categoría) ---
const $pasoCategoria = document.getElementById("paso-categoria");
const $pasoCategoriaImporteTexto = document.getElementById("paso-categoria-importe-texto");
const $btnAtrasCategoria = document.getElementById("btn-atras-categoria");
const $gridCategorias = document.getElementById("grid-categorias");

// --- Elementos: modal de edición ---
const $modal = document.getElementById("modal-gasto");
const $importeValor = document.getElementById("importe-valor");
const $tecladoModalEl = document.getElementById("teclado");
const $modalIcono = document.getElementById("modal-categoria-icono");
const $modalNombre = document.getElementById("modal-categoria-nombre");
const $modalCategorias = document.getElementById("modal-categorias");
const $btnCerrar = document.getElementById("btn-cerrar-modal");
const $btnNotaToggle = document.getElementById("btn-nota-toggle");
const $inputNota = document.getElementById("input-nota");
const $btnFechaToggle = document.getElementById("btn-fecha-toggle");
const $inputFecha = document.getElementById("input-fecha");
const $btnGuardar = document.getElementById("btn-guardar");
const $btnBorrar = document.getElementById("btn-borrar-gasto");

let tecladoHome;
let tecladoModal;
let guardandoRapido = false;

// Estado de edición (modo "editar" desde el resumen)
let estadoEdicion = null;
let alGuardarCallback = null;

export function initVistaRegistro() {
  tecladoHome = crearTeclado($tecladoHomeEl, $importeValorHome, {
    onCambio: (valor) => {
      $btnSiguiente.disabled = valor === "0";
    },
  });

  $gridCategorias.innerHTML = CATEGORIAS.map(
    (c) => `
    <button class="chip-categoria" data-id="${c.id}">
      <span class="icono-badge" style="--color-cat:${c.color}">${svgIcono(c.icono, 24)}</span>
      <span class="nombre">${c.nombre}</span>
    </button>`
  ).join("");

  $btnNotaToggleHome.addEventListener("click", () => {
    $inputNotaHome.classList.remove("oculto");
    $btnNotaToggleHome.classList.add("oculto");
    $inputNotaHome.focus();
  });
  $btnFechaToggleHome.addEventListener("click", () => {
    $inputFechaHome.classList.remove("oculto");
    $btnFechaToggleHome.classList.add("oculto");
  });

  $btnSiguiente.addEventListener("click", irAPasoCategoria);
  $btnAtrasCategoria.addEventListener("click", volverAPasoImporte);
  $gridCategorias.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip-categoria");
    if (!btn) return;
    onCategoriaElegida(btn.dataset.id);
  });

  // --- Modal de edición ---
  tecladoModal = crearTeclado($tecladoModalEl, $importeValor);

  $modalCategorias.innerHTML = CATEGORIAS.map(
    (c) => `
    <button type="button" class="chip-mini" role="radio" aria-checked="false" data-id="${c.id}" style="--color-cat:${c.color}">
      <span class="icono-badge">${svgIcono(c.icono, 15)}</span>
      <span>${c.nombre}</span>
    </button>`
  ).join("");
  $modalCategorias.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip-mini");
    if (!chip || !estadoEdicion) return;
    estadoEdicion.categoriaId = chip.dataset.id;
    pintarCategoriaModal(chip.dataset.id);
  });

  $btnCerrar.addEventListener("click", cerrarModal);
  $btnNotaToggle.addEventListener("click", () => {
    $inputNota.classList.toggle("oculto");
    $btnNotaToggle.classList.add("oculto");
    if (!$inputNota.classList.contains("oculto")) $inputNota.focus();
  });
  $btnFechaToggle.addEventListener("click", () => {
    $inputFecha.classList.toggle("oculto");
    $btnFechaToggle.classList.add("oculto");
  });
  $btnGuardar.addEventListener("click", onGuardarEdicion);
  $btnBorrar.addEventListener("click", onBorrar);

  resetPasoImporte();
}

function irAPasoCategoria() {
  const importe = parseImporte(tecladoHome.valor);
  if (!importe || importe <= 0) {
    mostrarToast("Introduce un importe válido");
    return;
  }
  $pasoCategoriaImporteTexto.textContent = formatoEuros(importe);
  $pasoImporte.classList.add("oculto");
  $pasoCategoria.classList.remove("oculto");
}

function volverAPasoImporte() {
  $pasoCategoria.classList.add("oculto");
  $pasoImporte.classList.remove("oculto");
}

function resetPasoImporte() {
  tecladoHome.valor = "0";
  $btnSiguiente.disabled = true;
  $inputNotaHome.value = "";
  $inputNotaHome.classList.add("oculto");
  $btnNotaToggleHome.classList.remove("oculto");
  $inputFechaHome.classList.add("oculto");
  $btnFechaToggleHome.classList.remove("oculto");
  $pasoCategoria.classList.add("oculto");
  $pasoImporte.classList.remove("oculto");
}

async function onCategoriaElegida(categoriaId) {
  if (guardandoRapido) return;
  const importe = parseImporte(tecladoHome.valor);
  const nota = $inputNotaHome.value.trim();
  const fecha = $inputFechaHome.classList.contains("oculto") ? null : new Date($inputFechaHome.value);

  guardandoRapido = true;
  try {
    await crearGasto({ importe, categoria: categoriaId, nota, fecha });
    mostrarToast("Gasto guardado");
    resetPasoImporte();
    document.dispatchEvent(new CustomEvent("gasto-guardado"));
  } catch (err) {
    console.error(err);
    mostrarToast("Error al guardar: " + err.message);
  } finally {
    guardandoRapido = false;
  }
}

// --- Edición desde el resumen mensual ---

// Cabecera del modal + chip marcado según la categoría elegida.
function pintarCategoriaModal(categoriaId) {
  const cat = getCategoria(categoriaId);
  $modalIcono.innerHTML = svgIcono(cat.icono, 19);
  $modalIcono.style.background = `color-mix(in srgb, ${cat.color} 16%, transparent)`;
  $modalIcono.style.color = cat.color;
  $modalNombre.textContent = cat.nombre;
  $modalCategorias.querySelectorAll(".chip-mini").forEach((chip) => {
    const activo = chip.dataset.id === categoriaId;
    chip.classList.toggle("activo", activo);
    chip.setAttribute("aria-checked", String(activo));
  });
}

export function abrirModal({ categoriaId, gasto, onGuardado }) {
  // `original` guarda el gasto tal como está en la base de datos, para poder deshacer un borrado.
  estadoEdicion = { categoriaId, gastoId: gasto.id, fecha: gasto.fecha, original: { ...gasto } };
  alGuardarCallback = onGuardado || null;

  tecladoModal.valor = String(gasto.importe).replace(".", ",");

  pintarCategoriaModal(categoriaId);

  $inputNota.value = gasto.nota || "";
  $inputNota.classList.toggle("oculto", !gasto.nota);
  $btnNotaToggle.classList.toggle("oculto", !!gasto.nota);

  $inputFecha.value = toDatetimeLocalValue(gasto.fecha);
  $inputFecha.classList.remove("oculto");
  $btnFechaToggle.classList.add("oculto");

  $btnBorrar.classList.remove("oculto");

  $modal.classList.remove("oculto");

  // Deja a la vista el chip de la categoría actual (la fila se desplaza en horizontal).
  const activo = $modalCategorias.querySelector(".chip-mini.activo");
  $modalCategorias.scrollLeft = activo ? activo.offsetLeft - 20 : 0;
}

function cerrarModal() {
  $modal.classList.add("oculto");
  estadoEdicion = null;
  alGuardarCallback = null;
}

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

async function onGuardarEdicion() {
  const importe = parseImporte(tecladoModal.valor);
  if (!importe || importe <= 0) {
    mostrarToast("Introduce un importe válido");
    return;
  }
  $btnGuardar.disabled = true;
  $btnGuardar.textContent = "Guardando...";
  try {
    const nota = $inputNota.value.trim();
    const fecha = new Date($inputFecha.value);
    await actualizarGasto(estadoEdicion.gastoId, {
      importe,
      categoria: estadoEdicion.categoriaId,
      nota,
      fecha,
    });
    mostrarToast("Gasto actualizado");
    const cb = alGuardarCallback;
    cerrarModal();
    if (cb) cb();
  } catch (err) {
    console.error(err);
    mostrarToast("Error al guardar: " + err.message);
  } finally {
    $btnGuardar.disabled = false;
    $btnGuardar.textContent = "Guardar";
  }
}

// Sin ventana de confirmación: se borra al momento y durante 5 s se puede deshacer, que vuelve a
// escribir el gasto con su mismo id (importarGastos), así que queda exactamente como estaba.
async function onBorrar() {
  if (!estadoEdicion) return;
  const original = estadoEdicion.original;
  $btnBorrar.disabled = true;
  try {
    await borrarGasto(estadoEdicion.gastoId);
    const cb = alGuardarCallback;
    cerrarModal();
    if (cb) cb();
    mostrarToast("Gasto borrado", {
      duracion: 5000,
      accion: { texto: "Deshacer", alPulsar: () => deshacerBorrado(original) },
    });
  } catch (err) {
    console.error(err);
    mostrarToast("Error al borrar: " + err.message);
  } finally {
    $btnBorrar.disabled = false;
  }
}

async function deshacerBorrado(gasto) {
  try {
    await importarGastos([gasto]);
    mostrarToast("Gasto recuperado");
    document.dispatchEvent(new CustomEvent("datos-restaurados"));
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo recuperar: " + err.message);
  }
}
