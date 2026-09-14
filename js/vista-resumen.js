import { CATEGORIAS, getCategoria } from "./config.js";
import { gastosDelMes, getPresupuestos, guardarPresupuestos } from "./firebase.js";
import { donutSVG, animarDonut } from "./graficos.js";
import { formatoEuros, mostrarToast, svgIcono, animarNumero } from "./ui.js";
import { abrirModal } from "./vista-registro.js";
import { exportarCSV } from "./exportar.js";

const $selectorMes = document.getElementById("selector-mes");
const $totalMes = document.getElementById("total-mes");
const $mediaDiaria = document.getElementById("media-diaria");
const $comparacionMes = document.getElementById("comparacion-mes");
const $graficoContainer = document.getElementById("grafico-container");
const $desglose = document.getElementById("desglose-categorias");
const $lista = document.getElementById("lista-gastos");
const $presupuestoTotalBar = document.getElementById("presupuesto-total-bar");
const $presupuestoTotalRelleno = document.getElementById("presupuesto-total-relleno");
const $presupuestoTotalTexto = document.getElementById("presupuesto-total-texto");

const $btnPresupuestos = document.getElementById("btn-presupuestos");
const $btnExportar = document.getElementById("btn-exportar");
const $modalPresupuestos = document.getElementById("modal-presupuestos");
const $btnCerrarPresupuestos = document.getElementById("btn-cerrar-presupuestos");
const $listaPresupuestos = document.getElementById("lista-presupuestos");
const $btnGuardarPresupuestos = document.getElementById("btn-guardar-presupuestos");

let gastosActuales = [];
let presupuestosActuales = {};

function mesActualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseMes(valor) {
  const [y, m] = valor.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function nivelBarra(pct) {
  if (pct > 100) return "exceso";
  if (pct >= 80) return "aviso";
  return "";
}

export function initVistaResumen() {
  $selectorMes.value = mesActualISO();
  $selectorMes.addEventListener("change", refrescar);
  $btnPresupuestos.addEventListener("click", abrirModalPresupuestos);
  $btnCerrarPresupuestos.addEventListener("click", cerrarModalPresupuestos);
  $btnGuardarPresupuestos.addEventListener("click", onGuardarPresupuestos);
  $btnExportar.addEventListener("click", onExportar);
}

export async function refrescar() {
  const mesDate = parseMes($selectorMes.value || mesActualISO());

  let gastos;
  let presupuestos;
  try {
    [gastos, presupuestos] = await Promise.all([gastosDelMes(mesDate), getPresupuestos()]);
  } catch (err) {
    console.error(err);
    mostrarToast("Error al cargar datos: " + err.message);
    return;
  }
  gastosActuales = gastos;
  presupuestosActuales = presupuestos;

  const total = gastos.reduce((sum, g) => sum + g.importe, 0);
  animarNumero($totalMes, total);

  const hoy = new Date();
  const esMesActual = mesDate.getFullYear() === hoy.getFullYear() && mesDate.getMonth() === hoy.getMonth();
  const diasDelMes = new Date(mesDate.getFullYear(), mesDate.getMonth() + 1, 0).getDate();
  const diasTranscurridos = esMesActual ? hoy.getDate() : diasDelMes;
  $mediaDiaria.textContent = formatoEuros(diasTranscurridos > 0 ? total / diasTranscurridos : 0);

  await actualizarComparacion(mesDate, total);

  const porCategoria = CATEGORIAS.map((c) => ({
    ...c,
    valor: gastos.filter((g) => g.categoria === c.id).reduce((s, g) => s + g.importe, 0),
    limite: Number(presupuestos[c.id]) || 0,
  })).filter((c) => c.valor > 0);
  porCategoria.sort((a, b) => b.valor - a.valor);

  $graficoContainer.innerHTML = porCategoria.length
    ? donutSVG(porCategoria, total)
    : `<p class="vacio">Sin gastos este mes</p>`;
  if (porCategoria.length) animarDonut($graficoContainer);

  $desglose.innerHTML = porCategoria
    .map((c) => {
      const pct = total > 0 ? Math.round((c.valor / total) * 100) : 0;
      const barraPresupuesto =
        c.limite > 0
          ? (() => {
              const pctPresupuesto = Math.min(100, Math.round((c.valor / c.limite) * 100));
              const nivel = nivelBarra((c.valor / c.limite) * 100);
              return `
              <div class="barra-progreso">
                <div class="barra-progreso-relleno ${nivel}" data-ancho="${pctPresupuesto}%"></div>
              </div>
              <span class="desglose-presupuesto-texto">${formatoEuros(c.valor)} de ${formatoEuros(c.limite)}${
                c.valor > c.limite ? " · superado" : ""
              }</span>`;
            })()
          : "";
      return `
      <div class="desglose-fila">
        <div class="desglose-fila-top">
          <span class="icono-badge" style="--color-cat:${c.color}">${svgIcono(c.icono, 17)}</span>
          <span class="desglose-nombre">${c.nombre}</span>
          <span class="desglose-pct">${pct}%</span>
          <span class="desglose-importe">${formatoEuros(c.valor)}</span>
        </div>
        ${barraPresupuesto}
      </div>`;
    })
    .join("");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $desglose.querySelectorAll(".barra-progreso-relleno[data-ancho]").forEach((el) => {
        el.style.width = el.dataset.ancho;
      });
    });
  });

  actualizarPresupuestoTotal(presupuestos, porCategoria, total);
  renderLista(gastos);
}

function actualizarPresupuestoTotal(presupuestos, porCategoria, total) {
  const limiteTotal = Object.values(presupuestos).reduce((s, v) => s + (Number(v) || 0), 0);
  if (limiteTotal <= 0) {
    $presupuestoTotalBar.classList.add("oculto");
    return;
  }
  $presupuestoTotalBar.classList.remove("oculto");
  const pct = Math.min(100, Math.round((total / limiteTotal) * 100));
  const nivel = nivelBarra((total / limiteTotal) * 100);
  $presupuestoTotalRelleno.className = `barra-progreso-relleno ${nivel}`;
  $presupuestoTotalRelleno.style.width = "0%";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $presupuestoTotalRelleno.style.width = pct + "%";
    });
  });
  $presupuestoTotalTexto.textContent = `${formatoEuros(total)} de ${formatoEuros(limiteTotal)} presupuestados`;
}

function renderLista(gastos) {
  if (!gastos.length) {
    $lista.innerHTML = `<p class="vacio">No hay gastos registrados este mes</p>`;
    return;
  }
  $lista.innerHTML = gastos
    .map((g) => {
      const cat = getCategoria(g.categoria);
      const fechaStr = g.fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
      return `
      <div class="gasto-fila" data-id="${g.id}">
        <span class="icono-badge" style="--color-cat:${cat.color}">${svgIcono(cat.icono, 19)}</span>
        <div class="gasto-info">
          <div class="gasto-categoria">${cat.nombre}</div>
          <div class="gasto-nota">${g.nota ? g.nota : g.fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <span class="gasto-fecha">${fechaStr}</span>
        <span class="gasto-importe">${formatoEuros(g.importe)}</span>
      </div>`;
    })
    .join("");

  $lista.querySelectorAll(".gasto-fila").forEach((fila) => {
    fila.addEventListener("click", () => {
      const gasto = gastos.find((g) => g.id === fila.dataset.id);
      if (!gasto) return;
      abrirModal({
        modo: "editar",
        categoriaId: gasto.categoria,
        gasto,
        onGuardado: refrescar,
      });
    });
  });
}

async function actualizarComparacion(mesDate, totalActual) {
  const mesAnteriorDate = new Date(mesDate.getFullYear(), mesDate.getMonth() - 1, 1);
  let gastosAnterior;
  try {
    gastosAnterior = await gastosDelMes(mesAnteriorDate);
  } catch (err) {
    $comparacionMes.textContent = "—";
    return;
  }
  const totalAnterior = gastosAnterior.reduce((sum, g) => sum + g.importe, 0);

  $comparacionMes.classList.remove("subida", "bajada");
  if (totalAnterior === 0) {
    $comparacionMes.textContent = totalActual > 0 ? "Mes nuevo" : "—";
    return;
  }
  const diff = totalActual - totalAnterior;
  const pct = Math.round((diff / totalAnterior) * 100);
  const signo = diff >= 0 ? "+" : "";
  $comparacionMes.textContent = `${signo}${pct}% (${signo}${formatoEuros(diff)})`;
  $comparacionMes.classList.add(diff > 0 ? "subida" : "bajada");
}

function abrirModalPresupuestos() {
  $listaPresupuestos.innerHTML = CATEGORIAS.map(
    (c) => `
    <div class="presupuesto-fila">
      <span class="icono-badge" style="--color-cat:${c.color}">${svgIcono(c.icono, 19)}</span>
      <span class="presupuesto-nombre">${c.nombre}</span>
      <input
        type="number"
        inputmode="decimal"
        min="0"
        step="1"
        class="presupuesto-input"
        data-id="${c.id}"
        placeholder="Sin límite"
        value="${presupuestosActuales[c.id] ? presupuestosActuales[c.id] : ""}"
      />
    </div>`
  ).join("");
  $modalPresupuestos.classList.remove("oculto");
}

function cerrarModalPresupuestos() {
  $modalPresupuestos.classList.add("oculto");
}

async function onGuardarPresupuestos() {
  const mapa = {};
  $listaPresupuestos.querySelectorAll(".presupuesto-input").forEach((input) => {
    mapa[input.dataset.id] = Number(input.value) || 0;
  });
  $btnGuardarPresupuestos.disabled = true;
  $btnGuardarPresupuestos.textContent = "Guardando...";
  try {
    await guardarPresupuestos(mapa);
    presupuestosActuales = mapa;
    mostrarToast("Presupuestos guardados");
    cerrarModalPresupuestos();
    refrescar();
  } catch (err) {
    console.error(err);
    mostrarToast("Error al guardar: " + err.message);
  } finally {
    $btnGuardarPresupuestos.disabled = false;
    $btnGuardarPresupuestos.textContent = "Guardar presupuestos";
  }
}

function onExportar() {
  if (!gastosActuales.length) {
    mostrarToast("No hay gastos que exportar este mes");
    return;
  }
  exportarCSV(gastosActuales, `gastos-${$selectorMes.value}.csv`);
}
