import { CATEGORIAS, getCategoria } from "./config.js";
import { crearGasto, actualizarGasto, borrarGasto } from "./firebase.js";
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
  } catch (err) {
    console.error(err);
    mostrarToast("Error al guardar: " + err.message);
  } finally {
    guardandoRapido = false;
  }
}

// --- Edición desde el resumen mensual ---

export function abrirModal({ categoriaId, gasto, onGuardado }) {
  const cat = getCategoria(categoriaId);
  estadoEdicion = { categoriaId, gastoId: gasto.id, fecha: gasto.fecha };
  alGuardarCallback = onGuardado || null;

  tecladoModal.valor = String(gasto.importe).replace(".", ",");

  $modalIcono.innerHTML = svgIcono(cat.icono, 19);
  $modalIcono.style.background = `color-mix(in srgb, ${cat.color} 16%, transparent)`;
  $modalIcono.style.color = cat.color;
  $modalNombre.textContent = cat.nombre;

  $inputNota.value = gasto.nota || "";
  $inputNota.classList.toggle("oculto", !gasto.nota);
  $btnNotaToggle.classList.toggle("oculto", !!gasto.nota);

  $inputFecha.value = toDatetimeLocalValue(gasto.fecha);
  $inputFecha.classList.remove("oculto");
  $btnFechaToggle.classList.add("oculto");

  $btnBorrar.classList.remove("oculto");

  $modal.classList.remove("oculto");
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

async function onBorrar() {
  if (!estadoEdicion) return;
  if (!confirm("¿Borrar este gasto?")) return;
  try {
    await borrarGasto(estadoEdicion.gastoId);
    mostrarToast("Gasto borrado");
    const cb = alGuardarCallback;
    cerrarModal();
    if (cb) cb();
  } catch (err) {
    console.error(err);
    mostrarToast("Error al borrar: " + err.message);
  }
}
