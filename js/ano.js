import { gastosEntre } from "./firebase.js";
import { CATEGORIAS, getCategoria } from "./config.js";
import { formatoEuros, svgIcono, escaparHtml, vibrar } from "./ui.js";

// "Tu año en gastos": pantallas a pantalla completa que se pasan tocando (tercio izquierdo = atrás).
const $historias = document.getElementById("historias");
const $barras = document.getElementById("historias-barras");
const $diapo = document.getElementById("historias-diapo");

const FONDOS = [
  "linear-gradient(160deg, #6c70ff, #8b5cf6)",
  "linear-gradient(160deg, #ff7a45, #ff2d55)",
  "linear-gradient(160deg, #0ea5e9, #6366f1)",
  "linear-gradient(160deg, #22c55e, #0ea5e9)",
  "linear-gradient(160deg, #f59e0b, #ef4444)",
  "linear-gradient(160deg, #a855f7, #ec4899)",
  "linear-gradient(160deg, #5b5fef, #8b5cf6)",
];
const INICIALES_MES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const normalizar = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

let diapos = [];
let actual = 0;

export function initAno() {
  $historias.addEventListener("click", (e) => {
    if (e.target.closest("#historias-cerrar, .historias-fin")) return cerrar();
    ir(e.clientX < window.innerWidth / 3 ? actual - 1 : actual + 1);
  });
}

export async function abrirAno(anio) {
  diapos = [`<p class="h-sub">Preparando tu ${anio}…</p>`];
  actual = 0;
  document.documentElement.classList.add("sin-scroll");
  $historias.classList.remove("oculto");
  pintar();
  try {
    const gastos = await gastosEntre(new Date(anio, 0, 1), new Date(anio + 1, 0, 1));
    diapos = construir(anio, gastos);
  } catch (err) {
    console.error(err);
    diapos = [`<p class="h-sub">No se pudo cargar tu año: ${escaparHtml(err.message)}</p>`];
  }
  actual = 0;
  pintar();
}

function cerrar() {
  $historias.classList.add("oculto");
  document.documentElement.classList.remove("sin-scroll");
}

function ir(i) {
  if (i < 0) return;
  if (i >= diapos.length) return cerrar();
  vibrar();
  actual = i;
  pintar();
}

function pintar() {
  $historias.style.background = FONDOS[actual % FONDOS.length];
  $barras.innerHTML = diapos.map((_, i) => `<span class="${i <= actual ? "lleno" : ""}"></span>`).join("");
  $diapo.innerHTML = `<div class="h-entra">${diapos[actual]}</div>`;
}

// Calcula todo el año y devuelve el HTML de cada pantalla. Exportada para poder probarla.
export function construir(anio, gastos) {
  if (!gastos.length) {
    return [`<p class="h-eyebrow">${anio}</p><h2 class="h-titulo">Aún no hay gastos este año</h2>
      <button class="historias-fin btn-h">Cerrar</button>`];
  }
  const total = gastos.reduce((s, g) => s + g.importe, 0);

  const porMes = new Array(12).fill(0);
  gastos.forEach((g) => (porMes[g.fecha.getMonth()] += g.importe));
  const mesMax = porMes.indexOf(Math.max(...porMes));
  const mesesConGasto = porMes.filter((v) => v > 0).length;

  const porCat = CATEGORIAS.map((c) => ({ ...c, valor: gastos.filter((g) => g.categoria === c.id).reduce((s, g) => s + g.importe, 0) }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const estrella = porCat[0];

  const porDia = {};
  gastos.forEach((g) => {
    const k = g.fecha.toDateString();
    porDia[k] ??= { fecha: g.fecha, total: 0 };
    porDia[k].total += g.importe;
  });
  const diaMax = Object.values(porDia).sort((a, b) => b.total - a.total)[0];
  const mayor = [...gastos].sort((a, b) => b.importe - a.importe)[0];

  const notas = {};
  gastos.filter((g) => g.nota).forEach((g) => {
    const k = normalizar(g.nota);
    notas[k] ??= { texto: g.nota, veces: 0, total: 0 };
    notas[k].veces++;
    notas[k].total += g.importe;
  });
  const clasico = Object.values(notas).sort((a, b) => b.veces - a.veces || b.total - a.total)[0];

  const fecha = (f) => f.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const nombreMes = new Date(anio, mesMax, 1).toLocaleDateString("es-ES", { month: "long" });
  const maxMes = porMes[mesMax];

  const d = [];
  d.push(`<p class="h-eyebrow">${anio}</p><h2 class="h-titulo">Tu año<br>en gastos</h2><p class="h-sub">Toca la pantalla para avanzar</p>`);
  d.push(`<p class="h-eyebrow">Este año has gastado</p><div class="h-cifra">${formatoEuros(total)}</div>
    <p class="h-sub">en ${plural(gastos.length, "gasto", "gastos")} · unos ${formatoEuros(total / mesesConGasto)} al mes</p>`);
  d.push(`<p class="h-eyebrow">Tu mes más caro</p><div class="h-grande h-mayus">${nombreMes}</div><p class="h-sub">${formatoEuros(maxMes)}</p>
    <div class="h-meses">${porMes
      .map((v, i) => `<div><span class="${i === mesMax ? "max" : ""}" style="height:${maxMes ? Math.max(3, Math.round((v / maxMes) * 100)) : 3}%"></span><small>${INICIALES_MES[i]}</small></div>`)
      .join("")}</div>`);
  d.push(`<p class="h-eyebrow">Tu categoría estrella</p>
    <span class="icono-badge h-icono" style="--color-cat:${estrella.color}">${svgIcono(estrella.icono, 40)}</span>
    <div class="h-grande">${estrella.nombre}</div>
    <p class="h-sub">${Math.round((estrella.valor / total) * 100)}% de todo lo que gastaste · ${formatoEuros(estrella.valor)}</p>
    ${porCat.length > 1 ? `<ol class="h-lista">${porCat.slice(1, 4).map((c) => `<li><span>${c.nombre}</span><strong>${formatoEuros(c.valor)}</strong></li>`).join("")}</ol>` : ""}`);
  d.push(`<p class="h-eyebrow">Récords</p>
    <div class="h-bloque"><span>Tu día más caro</span><strong class="h-mayus">${fecha(diaMax.fecha)}</strong><em>${formatoEuros(diaMax.total)}</em></div>
    <div class="h-bloque"><span>Tu gasto más grande</span><strong>${mayor.nota ? escaparHtml(mayor.nota) : getCategoria(mayor.categoria).nombre}</strong>
      <em>${formatoEuros(mayor.importe)} · ${mayor.fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</em></div>`);
  if (clasico && clasico.veces >= 2) {
    d.push(`<p class="h-eyebrow">Tu clásico</p><div class="h-grande">«${escaparHtml(clasico.texto)}»</div>
      <p class="h-sub">${clasico.veces} veces · ${formatoEuros(clasico.total)} en total</p>`);
  }
  d.push(`<h2 class="h-titulo">¡Eso es todo!</h2><p class="h-sub">Gracias por apuntar tus gastos en ${anio}.</p>
    <button class="historias-fin btn-h">Cerrar</button>`);
  return d;
}
