import { CATEGORIAS, getCategoria } from "./config.js";
import { gastosDelMes } from "./firebase.js";
import { donutSVG } from "./graficos.js";
import { formatoEuros, mostrarToast } from "./ui.js";
import { abrirModal } from "./vista-registro.js";

const $selectorMes = document.getElementById("selector-mes");
const $totalMes = document.getElementById("total-mes");
const $mediaDiaria = document.getElementById("media-diaria");
const $comparacionMes = document.getElementById("comparacion-mes");
const $graficoContainer = document.getElementById("grafico-container");
const $desglose = document.getElementById("desglose-categorias");
const $lista = document.getElementById("lista-gastos");

function mesActualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseMes(valor) {
  const [y, m] = valor.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export function initVistaResumen() {
  $selectorMes.value = mesActualISO();
  $selectorMes.addEventListener("change", refrescar);
}

export async function refrescar() {
  const mesDate = parseMes($selectorMes.value || mesActualISO());

  let gastos;
  try {
    gastos = await gastosDelMes(mesDate);
  } catch (err) {
    console.error(err);
    mostrarToast("Error al cargar gastos: " + err.message);
    return;
  }

  const total = gastos.reduce((sum, g) => sum + g.importe, 0);
  $totalMes.textContent = formatoEuros(total);

  const hoy = new Date();
  const esMesActual = mesDate.getFullYear() === hoy.getFullYear() && mesDate.getMonth() === hoy.getMonth();
  const diasDelMes = new Date(mesDate.getFullYear(), mesDate.getMonth() + 1, 0).getDate();
  const diasTranscurridos = esMesActual ? hoy.getDate() : diasDelMes;
  $mediaDiaria.textContent = formatoEuros(diasTranscurridos > 0 ? total / diasTranscurridos : 0);

  await actualizarComparacion(mesDate, total);

  const porCategoria = CATEGORIAS.map((c) => ({
    ...c,
    valor: gastos.filter((g) => g.categoria === c.id).reduce((s, g) => s + g.importe, 0),
  })).filter((c) => c.valor > 0);
  porCategoria.sort((a, b) => b.valor - a.valor);

  $graficoContainer.innerHTML = porCategoria.length
    ? donutSVG(porCategoria, total)
    : `<p class="vacio">Sin gastos este mes</p>`;

  $desglose.innerHTML = porCategoria
    .map((c) => {
      const pct = total > 0 ? Math.round((c.valor / total) * 100) : 0;
      return `
      <div class="desglose-fila">
        <span class="desglose-punto" style="background:${c.color}"></span>
        <span class="desglose-nombre">${c.emoji} ${c.nombre}</span>
        <span class="desglose-pct">${pct}%</span>
        <span class="desglose-importe">${formatoEuros(c.valor)}</span>
      </div>`;
    })
    .join("");

  renderLista(gastos);
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
        <span class="gasto-emoji" style="background:${cat.color}22">${cat.emoji}</span>
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
