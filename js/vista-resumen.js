import { CATEGORIAS, getCategoria } from "./config.js";
import { gastosEntre, getPresupuestos, guardarPresupuestos } from "./firebase.js";
import { donutSVG, animarDonut } from "./graficos.js";
import { formatoEuros, mostrarToast, svgIcono, animarNumero, escaparHtml } from "./ui.js";
import { abrirModal } from "./vista-registro.js";
import { exportarExcel } from "./excel.js";

const $selectorMes = document.getElementById("selector-mes");
const $totalMes = document.getElementById("total-mes");
const $mediaDiaria = document.getElementById("media-diaria");
const $comparacionMes = document.getElementById("comparacion-mes");
const $comparacionNota = document.getElementById("comparacion-nota");
const $graficoContainer = document.getElementById("grafico-container");
const $desglose = document.getElementById("desglose-categorias");
const $lista = document.getElementById("lista-gastos");
const $presupuestoTotalBar = document.getElementById("presupuesto-total-bar");
const $presupuestoTotalRelleno = document.getElementById("presupuesto-total-relleno");
const $presupuestoTotalTexto = document.getElementById("presupuesto-total-texto");

const $btnPresupuestos = document.getElementById("btn-presupuestos");
const $btnExportarExcel = document.getElementById("btn-exportar-excel");
const $modalPresupuestos = document.getElementById("modal-presupuestos");
const $btnCerrarPresupuestos = document.getElementById("btn-cerrar-presupuestos");
const $listaPresupuestos = document.getElementById("lista-presupuestos");
const $btnGuardarPresupuestos = document.getElementById("btn-guardar-presupuestos");

const $buscarGasto = document.getElementById("buscar-gasto");
const $filtroCategoria = document.getElementById("filtro-categoria");
const $ordenGastos = document.getElementById("orden-gastos");
const $listaResumenFiltro = document.getElementById("lista-resumen-filtro");

const $tendencia = document.getElementById("tendencia");
const $tendenciaBarras = document.getElementById("tendencia-barras");
const $tendenciaMedia = document.getElementById("tendencia-media");

const MESES_TENDENCIA = 6;

let gastosActuales = [];
let presupuestosActuales = {};
let statsActuales = { total: 0, mediaDiaria: 0, diasDelMes: 30, comparacionTexto: "—", comparacionEtiqueta: "Vs. mes anterior" };
// Totales por categoría del periodo con el que se compara; null si ese periodo no tiene gastos.
let totalesAnteriores = null;
let etiquetaComparacion = "mes anterior";

function normalizar(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

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
  $btnExportarExcel.addEventListener("click", onExportarExcel);

  CATEGORIAS.forEach((c) => {
    $filtroCategoria.insertAdjacentHTML("beforeend", `<option value="${c.id}">${c.nombre}</option>`);
  });
  $buscarGasto.addEventListener("input", () => renderLista(gastosActuales));
  $filtroCategoria.addEventListener("change", () => renderLista(gastosActuales));
  $ordenGastos.addEventListener("change", () => renderLista(gastosActuales));

  $tendenciaBarras.addEventListener("click", (e) => {
    const col = e.target.closest(".tendencia-col");
    if (!col || col.dataset.mes === $selectorMes.value) return;
    $selectorMes.value = col.dataset.mes;
    refrescar();
  });
  document.addEventListener("datos-restaurados", refrescar);
}

function claveMes(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

// Con qué se compara un mes. Si está en curso, con el mismo tramo del mes anterior (del 1 al día de
// hoy, sin pasarse de los días que tuvo ese mes): comparar lo que llevas con un mes entero siempre
// saldría "a la baja". Si ya terminó, con el mes anterior completo.
export function rangoComparable(mesDate, hoy = new Date()) {
  const enCurso = mesDate.getFullYear() === hoy.getFullYear() && mesDate.getMonth() === hoy.getMonth();
  if (!enCurso) return { enCurso: false, diaLimite: null, etiqueta: "mes anterior" };
  const nombreMesAnterior = new Date(mesDate.getFullYear(), mesDate.getMonth() - 1, 1)
    .toLocaleDateString("es-ES", { month: "short" })
    .replace(".", "");
  const diasMesAnterior = new Date(mesDate.getFullYear(), mesDate.getMonth(), 0).getDate();
  const diaLimite = Math.min(hoy.getDate(), diasMesAnterior);
  const tramo = diaLimite === 1 ? "1" : `1–${diaLimite}`;
  return { enCurso: true, diaLimite, etiqueta: `${tramo} ${nombreMesAnterior}` };
}

export async function refrescar() {
  const mesDate = parseMes($selectorMes.value || mesActualISO());
  const mesSiguiente = new Date(mesDate.getFullYear(), mesDate.getMonth() + 1, 1);
  const inicioVentana = new Date(mesDate.getFullYear(), mesDate.getMonth() - (MESES_TENDENCIA - 1), 1);

  // Una sola consulta cubre el mes elegido, el anterior (comparación) y la tendencia.
  let ventana;
  let presupuestos;
  try {
    [ventana, presupuestos] = await Promise.all([gastosEntre(inicioVentana, mesSiguiente), getPresupuestos()]);
  } catch (err) {
    console.error(err);
    mostrarToast("Error al cargar datos: " + err.message);
    return;
  }
  const claveElegido = claveMes(mesDate);
  const claveAnterior = claveMes(new Date(mesDate.getFullYear(), mesDate.getMonth() - 1, 1));
  const gastos = ventana.filter((g) => claveMes(g.fecha) === claveElegido);
  const gastosAnterior = ventana.filter((g) => claveMes(g.fecha) === claveAnterior);
  gastosActuales = gastos;
  presupuestosActuales = presupuestos;

  const total = gastos.reduce((sum, g) => sum + g.importe, 0);
  animarNumero($totalMes, total);

  const hoy = new Date();
  const rango = rangoComparable(mesDate, hoy);
  const diasDelMes = new Date(mesDate.getFullYear(), mesDate.getMonth() + 1, 0).getDate();
  const diasTranscurridos = rango.enCurso ? hoy.getDate() : diasDelMes;
  const mediaDiariaValor = diasTranscurridos > 0 ? total / diasTranscurridos : 0;
  $mediaDiaria.textContent = formatoEuros(mediaDiariaValor);

  const anteriorComparable = rango.diaLimite
    ? gastosAnterior.filter((g) => g.fecha.getDate() <= rango.diaLimite)
    : gastosAnterior;
  const comparacion = actualizarComparacion({
    hayHistorial: gastosAnterior.length > 0,
    anteriorComparable,
    totalActual: total,
    rango,
  });
  totalesAnteriores = comparacion.totalesPorCategoria;
  etiquetaComparacion = rango.etiqueta;

  statsActuales = {
    total,
    mediaDiaria: mediaDiariaValor,
    diasDelMes,
    comparacionTexto: comparacion.texto,
    comparacionEtiqueta: rango.enCurso ? `Vs. ${rango.etiqueta}` : "Vs. mes anterior",
  };

  renderTendencia(ventana, mesDate);

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
          <span class="desglose-nombre">${c.nombre}${deltaCategoriaHtml(c.id, c.valor)}</span>
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

  actualizarPresupuestoTotal(presupuestos, porCategoria);
  renderLista(gastos);
}

function actualizarPresupuestoTotal(presupuestos, porCategoria) {
  const limiteTotal = Object.values(presupuestos).reduce((s, v) => s + (Number(v) || 0), 0);
  if (limiteTotal <= 0) {
    $presupuestoTotalBar.classList.add("oculto");
    return;
  }
  // Solo cuenta el gasto de las categorías que tienen presupuesto; comparar el gasto total
  // con la suma de presupuestos parciales daría un porcentaje engañoso.
  const total = porCategoria.filter((c) => c.limite > 0).reduce((s, c) => s + c.valor, 0);
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

// Cambio de una categoría respecto al periodo de comparación. Sin datos en ese periodo no se
// muestra nada, para no llenar todas las filas de "nuevo" cuando aún no hay historial.
function deltaCategoriaHtml(categoriaId, valorActual) {
  if (!totalesAnteriores) return "";
  const anterior = totalesAnteriores[categoriaId] || 0;
  if (anterior === 0) {
    const texto = etiquetaComparacion === "mes anterior" ? "nuevo este mes" : `sin gasto en ${etiquetaComparacion}`;
    return `<span class="desglose-delta">${escaparHtml(texto)}</span>`;
  }
  const pct = Math.round(((valorActual - anterior) / anterior) * 100);
  if (pct === 0) return `<span class="desglose-delta">sin cambios vs. ${escaparHtml(etiquetaComparacion)}</span>`;
  const clase = pct > 0 ? "subida" : "bajada";
  const flecha = pct > 0 ? "↑" : "↓";
  return `<span class="desglose-delta ${clase}">${flecha} ${Math.abs(pct)}% vs. ${escaparHtml(etiquetaComparacion)}</span>`;
}

function aplicarFiltros(gastos) {
  const texto = normalizar($buscarGasto.value.trim());
  const categoria = $filtroCategoria.value;
  const filtrados = gastos.filter((g) => {
    if (categoria !== "todas" && g.categoria !== categoria) return false;
    if (!texto) return true;
    return normalizar(`${g.nota} ${getCategoria(g.categoria).nombre}`).includes(texto);
  });
  const orden = $ordenGastos.value;
  filtrados.sort((a, b) => {
    if (orden === "fecha-asc") return a.fecha - b.fecha;
    if (orden === "importe-desc") return b.importe - a.importe;
    if (orden === "importe-asc") return a.importe - b.importe;
    return b.fecha - a.fecha;
  });
  return { filtrados, hayFiltro: Boolean(texto) || categoria !== "todas" };
}

function renderLista(todos) {
  if (!todos.length) {
    $listaResumenFiltro.classList.add("oculto");
    $lista.innerHTML = `<p class="vacio">No hay gastos registrados este mes</p>`;
    return;
  }
  const { filtrados: gastos, hayFiltro } = aplicarFiltros(todos);
  if (hayFiltro) {
    const suma = gastos.reduce((s, g) => s + g.importe, 0);
    $listaResumenFiltro.textContent = `${gastos.length} ${gastos.length === 1 ? "movimiento" : "movimientos"} · ${formatoEuros(suma)}`;
    $listaResumenFiltro.classList.remove("oculto");
  } else {
    $listaResumenFiltro.classList.add("oculto");
  }
  if (!gastos.length) {
    $lista.innerHTML = `<p class="vacio">Ningún movimiento coincide con la búsqueda</p>`;
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
          <div class="gasto-nota">${g.nota ? escaparHtml(g.nota) : g.fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</div>
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
        categoriaId: gasto.categoria,
        gasto,
        onGuardado: refrescar,
      });
    });
  });
}

function valorCorto(valor) {
  if (valor <= 0) return "–";
  if (valor >= 1000) return `${(valor / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })}k`;
  return `${Math.round(valor)} €`;
}

// Barras de los últimos MESES_TENDENCIA meses terminando en el mes elegido; tocar una barra cambia de mes.
function renderTendencia(ventana, mesElegido) {
  const totales = {};
  ventana.forEach((g) => {
    const k = claveMes(g.fecha);
    totales[k] = (totales[k] || 0) + g.importe;
  });

  const meses = [];
  for (let i = MESES_TENDENCIA - 1; i >= 0; i--) {
    const d = new Date(mesElegido.getFullYear(), mesElegido.getMonth() - i, 1);
    const clave = claveMes(d);
    let etiqueta = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
    if (d.getMonth() === 0) etiqueta += ` ${String(d.getFullYear()).slice(2)}`;
    meses.push({
      clave,
      etiqueta,
      total: totales[clave] || 0,
      nombreLargo: d.toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
    });
  }

  const conDatos = meses.filter((m) => m.total > 0);
  if (!conDatos.length) {
    $tendencia.classList.add("oculto");
    return;
  }
  $tendencia.classList.remove("oculto");
  $tendenciaMedia.textContent =
    conDatos.length >= 2
      ? `media ${formatoEuros(conDatos.reduce((s, m) => s + m.total, 0) / conDatos.length)}/mes`
      : "";

  const maximo = Math.max(...meses.map((m) => m.total));
  const claveElegida = claveMes(mesElegido);
  $tendenciaBarras.innerHTML = meses
    .map((m) => {
      const alto = maximo > 0 ? Math.round((m.total / maximo) * 100) : 0;
      return `
      <button class="tendencia-col${m.clave === claveElegida ? " activo" : ""}" data-mes="${m.clave}"
        aria-label="${m.nombreLargo}: ${formatoEuros(m.total)}">
        <span class="tendencia-valor">${valorCorto(m.total)}</span>
        <span class="tendencia-zona"><span class="tendencia-barra" data-alto="${alto}%"></span></span>
        <span class="tendencia-mes">${m.etiqueta}</span>
      </button>`;
    })
    .join("");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $tendenciaBarras.querySelectorAll(".tendencia-barra").forEach((el) => {
        el.style.height = el.dataset.alto;
      });
    });
  });
}

// Compara el mes con `anteriorComparable` (el mes anterior entero, o su mismo tramo si el mes está en
// curso; ver rangoComparable) y pinta el resultado en la tarjeta. `hayHistorial` dice si el mes
// anterior tiene algún gasto, para distinguir "mes nuevo" de "no gasté nada en ese tramo".
function actualizarComparacion({ hayHistorial, anteriorComparable, totalActual, rango }) {
  const totalAnterior = anteriorComparable.reduce((sum, g) => sum + g.importe, 0);

  $comparacionMes.classList.remove("subida", "bajada");
  $comparacionNota.classList.add("oculto");
  if (totalAnterior === 0) {
    const texto = totalActual === 0 ? "—" : hayHistorial ? `Sin gasto en ${rango.etiqueta}` : "Mes nuevo";
    $comparacionMes.textContent = texto;
    return { texto, totalesPorCategoria: null };
  }

  const totalesPorCategoria = {};
  anteriorComparable.forEach((g) => {
    totalesPorCategoria[g.categoria] = (totalesPorCategoria[g.categoria] || 0) + g.importe;
  });

  const diff = totalActual - totalAnterior;
  const pct = Math.round((diff / totalAnterior) * 100);
  const signo = diff >= 0 ? "+" : "";
  const texto = `${signo}${pct}% (${signo}${formatoEuros(diff)})`;
  $comparacionMes.textContent = texto;
  $comparacionMes.classList.add(diff > 0 ? "subida" : "bajada");

  // Se enseña con qué se ha comparado para que el porcentaje no parezca salir de la nada.
  if (rango.enCurso) {
    $comparacionNota.textContent = `${rango.etiqueta}: ${formatoEuros(totalAnterior)}`;
    $comparacionNota.classList.remove("oculto");
  }
  return { texto, totalesPorCategoria };
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

async function onExportarExcel() {
  if (!gastosActuales.length) {
    mostrarToast("No hay gastos que exportar este mes");
    return;
  }
  const mesId = $selectorMes.value || mesActualISO();
  const nombreMes = parseMes(mesId).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  $btnExportarExcel.disabled = true;
  $btnExportarExcel.querySelector("span").textContent = "Generando...";
  try {
    await exportarExcel({ gastos: gastosActuales, nombreMes, mesId, stats: statsActuales });
  } catch (err) {
    console.error(err);
    mostrarToast("Error al exportar: " + err.message);
  } finally {
    $btnExportarExcel.disabled = false;
    $btnExportarExcel.querySelector("span").textContent = "Exportar a Excel";
  }
}
