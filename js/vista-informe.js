import { CATEGORIAS, getCategoria } from "./config.js";
import { formatoEuros, svgIcono, escaparHtml, animarNumero, mostrarToast } from "./ui.js";
import { exportarExcel } from "./excel.js";

const $ = (id) => document.getElementById(id);
const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

let datos = null;
let porDia = {};
let diaElegido = null;

export function initVistaInforme() {
  $("informe-calendario").addEventListener("click", (e) => {
    const celda = e.target.closest(".cal-dia[data-dia]");
    if (!celda) return;
    diaElegido = Number(celda.dataset.dia);
    pintarCalendario();
  });
  $("btn-informe-excel").addEventListener("click", onExcel);
}

// d: lo que devuelve datosInforme() de vista-resumen.js
export function mostrarInforme(d) {
  datos = d;
  $("informe-titulo").textContent = d.nombreMes;
  const hay = d.gastos.length > 0;
  $("informe-vacio").classList.toggle("oculto", hay);
  $("informe-contenido").classList.toggle("oculto", !hay);
  if (!hay) return;

  porDia = {};
  d.gastos.forEach((g) => {
    const dia = g.fecha.getDate();
    porDia[dia] ??= { total: 0, gastos: [] };
    porDia[dia].total += g.importe;
    porDia[dia].gastos.push(g);
  });
  // Por defecto se abre el día en que más se gastó.
  diaElegido = Number(Object.entries(porDia).sort((a, b) => b[1].total - a[1].total)[0][0]);

  pintarCabecera();
  pintarClaves();
  pintarCalendario();
  pintarCategorias();
  pintarTop();
}

function totalesPorCategoria() {
  const total = datos.stats.total;
  return CATEGORIAS.map((c) => {
    const gastos = datos.gastos.filter((g) => g.categoria === c.id);
    const valor = gastos.reduce((s, g) => s + g.importe, 0);
    return { ...c, valor, n: gastos.length, pct: total > 0 ? Math.round((valor / total) * 100) : 0 };
  })
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);
}

function diasTranscurridos() {
  const hoy = new Date();
  const { mesDate, stats } = datos;
  const enCurso = mesDate.getFullYear() === hoy.getFullYear() && mesDate.getMonth() === hoy.getMonth();
  return { enCurso, dias: enCurso ? hoy.getDate() : stats.diasDelMes };
}

function pintarCabecera() {
  const { stats, gastos } = datos;
  animarNumero($("informe-total"), stats.total);
  const texto = stats.comparacionTexto;
  $("informe-comparacion").textContent =
    texto === "—" ? "" : texto === "Mes nuevo" ? "Primer mes con gastos" : `${stats.comparacionEtiqueta}: ${texto}`;
  const cifras = [
    plural(gastos.length, "gasto", "gastos"),
    `${formatoEuros(stats.total / gastos.length)} de media por gasto`,
    `${formatoEuros(stats.mediaDiaria)} al día`,
  ];
  $("informe-cifras").innerHTML = cifras.map((c) => `<span>${c}</span>`).join("");
}

function fechaLarga(fecha) {
  return fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function pintarClaves() {
  const claves = [];
  const cats = totalesPorCategoria();
  const top = cats[0];
  claves.push(
    `<strong>${top.pct}%</strong> de lo que gastaste fue en <strong>${top.nombre}</strong> (${formatoEuros(top.valor)}).`
  );

  const [diaTop, infoDia] = Object.entries(porDia).sort((a, b) => b[1].total - a[1].total)[0];
  const fechaDiaTop = new Date(datos.mesDate.getFullYear(), datos.mesDate.getMonth(), Number(diaTop));
  claves.push(
    `Tu día más caro fue el <strong>${fechaLarga(fechaDiaTop)}</strong>: ${formatoEuros(infoDia.total)} en ${plural(infoDia.gastos.length, "gasto", "gastos")}.`
  );

  const mayor = [...datos.gastos].sort((a, b) => b.importe - a.importe)[0];
  const nombreMayor = mayor.nota ? escaparHtml(mayor.nota) : getCategoria(mayor.categoria).nombre;
  claves.push(
    `Tu gasto más grande: <strong>${nombreMayor}</strong>, ${formatoEuros(mayor.importe)} el ${mayor.fecha.getDate()}.`
  );

  const { enCurso, dias } = diasTranscurridos();
  const diasConGasto = Object.keys(porDia).filter((d) => Number(d) <= dias).length;
  const sinGastar = dias - diasConGasto;
  claves.push(
    sinGastar > 0
      ? `<strong>${plural(sinGastar, "día", "días")}</strong> sin gastar nada${enCurso ? " en lo que va de mes" : ""}.`
      : "Has gastado algo todos los días del mes."
  );

  if (datos.totalesAnteriores) {
    const cambios = cats
      .filter((c) => datos.totalesAnteriores[c.id] > 0)
      .map((c) => ({ ...c, diff: c.valor - datos.totalesAnteriores[c.id] }));
    const subida = cambios.filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff)[0];
    const bajada = cambios.filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff)[0];
    const etiqueta = escaparHtml(datos.etiquetaComparacion);
    if (subida) claves.push(`Donde más ha subido: <strong>${subida.nombre}</strong>, +${formatoEuros(subida.diff)} vs. ${etiqueta}.`);
    if (bajada) claves.push(`Donde más has recortado: <strong>${bajada.nombre}</strong>, ${formatoEuros(bajada.diff)} vs. ${etiqueta}.`);
  }

  $("informe-claves").innerHTML = claves.map((c) => `<li>${c}</li>`).join("");
}

function pintarCalendario() {
  const anio = datos.mesDate.getFullYear();
  const mes = datos.mesDate.getMonth();
  const diasMes = new Date(anio, mes + 1, 0).getDate();
  const desfase = (new Date(anio, mes, 1).getDay() + 6) % 7; // lunes = 0
  const maximo = Math.max(...Object.values(porDia).map((d) => d.total));
  const { enCurso, dias } = diasTranscurridos();

  let html = DIAS_SEMANA.map((d) => `<span class="cal-cabecera">${d}</span>`).join("");
  html += '<span class="cal-hueco"></span>'.repeat(desfase);
  for (let d = 1; d <= diasMes; d++) {
    const total = porDia[d]?.total || 0;
    const intensidad = total > 0 ? 0.2 + 0.8 * (total / maximo) : 0;
    const clases = ["cal-dia"];
    if (total > 0) clases.push("con-gasto");
    if (intensidad > 0.55) clases.push("fuerte");
    if (enCurso && d > dias) clases.push("futuro");
    if (enCurso && d === dias) clases.push("hoy");
    if (d === diaElegido) clases.push("elegido");
    html += `<button type="button" class="${clases.join(" ")}" data-dia="${d}" style="--pct:${Math.round(intensidad * 100)}%"
      aria-label="${d}: ${formatoEuros(total)}">${d}</button>`;
  }
  $("informe-calendario").innerHTML = html;

  const info = porDia[diaElegido];
  const fecha = new Date(anio, mes, diaElegido);
  const titulo = `<div class="cal-dia-titulo"><span>${fechaLarga(fecha)}</span><strong>${formatoEuros(info?.total || 0)}</strong></div>`;
  $("informe-dia").innerHTML = info
    ? titulo +
      info.gastos
        .map((g) => {
          const cat = getCategoria(g.categoria);
          return `<div class="cal-gasto"><span class="icono-badge" style="--color-cat:${cat.color}">${svgIcono(cat.icono, 15)}</span>
            <span class="cal-gasto-texto">${g.nota ? escaparHtml(g.nota) : cat.nombre}</span>
            <span class="cal-gasto-importe">${formatoEuros(g.importe)}</span></div>`;
        })
        .join("")
    : titulo + '<p class="informe-ayuda">Ese día no gastaste nada.</p>';
}

function pintarCategorias() {
  const cats = totalesPorCategoria();
  const maximo = cats[0].valor;
  const etiqueta = escaparHtml(datos.etiquetaComparacion);
  $("informe-categorias").innerHTML = cats
    .map((c) => {
      const meta = [plural(c.n, "gasto", "gastos"), `${c.pct}%`];
      const anterior = datos.totalesAnteriores?.[c.id];
      if (anterior > 0) {
        const pct = Math.round(((c.valor - anterior) / anterior) * 100);
        if (pct !== 0) meta.push(`${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}% vs. ${etiqueta}`);
      }
      return `<div class="inf-cat">
        <span class="icono-badge" style="--color-cat:${c.color}">${svgIcono(c.icono, 17)}</span>
        <div class="inf-cat-cuerpo">
          <div class="inf-cat-fila"><span>${c.nombre}</span><strong>${formatoEuros(c.valor)}</strong></div>
          <div class="inf-cat-barra"><span style="--color-cat:${c.color}" data-ancho="${(c.valor / maximo) * 100}%"></span></div>
          <div class="inf-cat-meta">${meta.join(" · ")}</div>
        </div>
      </div>`;
    })
    .join("");
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      $("informe-categorias").querySelectorAll("[data-ancho]").forEach((el) => (el.style.width = el.dataset.ancho));
    })
  );
}

function pintarTop() {
  $("informe-top").innerHTML = [...datos.gastos]
    .sort((a, b) => b.importe - a.importe)
    .slice(0, 5)
    .map((g) => {
      const cat = getCategoria(g.categoria);
      const fecha = g.fecha.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
      return `<li>
        <span class="icono-badge" style="--color-cat:${cat.color}">${svgIcono(cat.icono, 17)}</span>
        <div class="inf-top-texto"><span>${g.nota ? escaparHtml(g.nota) : cat.nombre}</span><small>${cat.nombre} · ${fecha}</small></div>
        <strong>${formatoEuros(g.importe)}</strong>
      </li>`;
    })
    .join("");
}

async function onExcel() {
  const $btn = $("btn-informe-excel");
  $btn.disabled = true;
  $btn.textContent = "Generando...";
  try {
    await exportarExcel({ gastos: datos.gastos, nombreMes: datos.nombreMes, mesId: datos.mesId, stats: datos.stats });
  } catch (err) {
    console.error(err);
    mostrarToast("Error al exportar: " + err.message);
  } finally {
    $btn.disabled = false;
    $btn.textContent = "Descargar en Excel";
  }
}
