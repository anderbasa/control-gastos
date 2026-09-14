import { CATEGORIAS, getCategoria } from "./config.js";
import { crearGasto, actualizarGasto, borrarGasto } from "./firebase.js";
import { mostrarToast, svgIcono } from "./ui.js";

const ICONO_BACKSPACE = '<path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7Z"/><path d="M13 10l4 4M17 10l-4 4"/>';

let estado = null; // { modo: 'crear'|'editar', categoriaId, importeStr, nota, fecha, gastoId }
let alGuardarCallback = null;

const $modal = document.getElementById("modal-gasto");
const $importeValor = document.getElementById("importe-valor");
const $teclado = document.getElementById("teclado");
const $modalIcono = document.getElementById("modal-categoria-icono");
const $modalNombre = document.getElementById("modal-categoria-nombre");
const $btnCerrar = document.getElementById("btn-cerrar-modal");
const $btnNotaToggle = document.getElementById("btn-nota-toggle");
const $inputNota = document.getElementById("input-nota");
const $btnFechaToggle = document.getElementById("btn-fecha-toggle");
const $inputFecha = document.getElementById("input-fecha");
const $btnGuardar = document.getElementById("btn-guardar");
const $btnBorrar = document.getElementById("btn-borrar-gasto");

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];

export function initVistaRegistro() {
  const $grid = document.getElementById("grid-categorias");
  $grid.innerHTML = CATEGORIAS.map(
    (c) => `
    <button class="chip-categoria" data-id="${c.id}">
      <span class="icono-badge" style="--color-cat:${c.color}">${svgIcono(c.icono, 24)}</span>
      <span class="nombre">${c.nombre}</span>
    </button>`
  ).join("");

  $grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip-categoria");
    if (!btn) return;
    abrirModal({ modo: "crear", categoriaId: btn.dataset.id });
  });

  $teclado.innerHTML = TECLAS.map((t) => {
    if (t === "⌫") {
      return `<button class="tecla tecla-borrar" data-tecla="${t}">${svgIcono(ICONO_BACKSPACE, 20)}</button>`;
    }
    return `<button class="tecla" data-tecla="${t}">${t}</button>`;
  }).join("");
  $teclado.addEventListener("click", (e) => {
    const btn = e.target.closest(".tecla");
    if (!btn) return;
    onTecla(btn.dataset.tecla);
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
  $btnGuardar.addEventListener("click", onGuardar);
  $btnBorrar.addEventListener("click", onBorrar);
}

export function abrirModal({ modo, categoriaId, gasto, onGuardado }) {
  const cat = getCategoria(categoriaId);
  estado = {
    modo,
    categoriaId,
    importeStr: gasto ? String(gasto.importe).replace(".", ",") : "0",
    nota: gasto ? gasto.nota : "",
    fecha: gasto ? gasto.fecha : null,
    gastoId: gasto ? gasto.id : null,
  };
  alGuardarCallback = onGuardado || null;

  $modalIcono.innerHTML = svgIcono(cat.icono, 19);
  $modalIcono.style.setProperty("--color-cat", cat.color);
  $modalIcono.style.background = `color-mix(in srgb, ${cat.color} 16%, transparent)`;
  $modalIcono.style.color = cat.color;
  $modalNombre.textContent = cat.nombre;
  $importeValor.textContent = estado.importeStr;

  $inputNota.value = estado.nota || "";
  $inputNota.classList.toggle("oculto", !estado.nota);
  $btnNotaToggle.classList.toggle("oculto", !!estado.nota);

  const fechaBase = estado.fecha || new Date();
  $inputFecha.value = toDatetimeLocalValue(fechaBase);
  const mostrarFecha = modo === "editar";
  $inputFecha.classList.toggle("oculto", !mostrarFecha);
  $btnFechaToggle.classList.toggle("oculto", mostrarFecha);

  $btnBorrar.classList.toggle("oculto", modo !== "editar");

  $modal.classList.remove("oculto");
}

function cerrarModal() {
  $modal.classList.add("oculto");
  estado = null;
  alGuardarCallback = null;
}

function onTecla(t) {
  if (!estado) return;
  if (t === "⌫") {
    estado.importeStr = estado.importeStr.length > 1 ? estado.importeStr.slice(0, -1) : "0";
  } else if (t === ",") {
    if (!estado.importeStr.includes(",")) estado.importeStr += ",";
  } else {
    if (estado.importeStr === "0") estado.importeStr = t;
    else if (estado.importeStr.split(",")[1]?.length >= 2) return;
    else estado.importeStr += t;
  }
  $importeValor.textContent = estado.importeStr;
}

function parseImporte(str) {
  return parseFloat(str.replace(",", "."));
}

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

async function onGuardar() {
  const importe = parseImporte(estado.importeStr);
  if (!importe || importe <= 0) {
    mostrarToast("Introduce un importe válido");
    return;
  }
  $btnGuardar.disabled = true;
  $btnGuardar.textContent = "Guardando...";
  try {
    const nota = $inputNota.value.trim();
    const fecha = $inputFecha.classList.contains("oculto")
      ? null
      : new Date($inputFecha.value);

    if (estado.modo === "crear") {
      await crearGasto({ importe, categoria: estado.categoriaId, nota, fecha });
      mostrarToast("Gasto guardado");
    } else {
      await actualizarGasto(estado.gastoId, {
        importe,
        categoria: estado.categoriaId,
        nota,
        fecha: fecha || estado.fecha,
      });
      mostrarToast("Gasto actualizado");
    }
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
  if (!estado || estado.modo !== "editar") return;
  if (!confirm("¿Borrar este gasto?")) return;
  try {
    await borrarGasto(estado.gastoId);
    mostrarToast("Gasto borrado");
    const cb = alGuardarCallback;
    cerrarModal();
    if (cb) cb();
  } catch (err) {
    console.error(err);
    mostrarToast("Error al borrar: " + err.message);
  }
}
