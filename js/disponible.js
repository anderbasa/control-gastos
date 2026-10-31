import { gastosEntre, getPresupuestos } from "./firebase.js";
import { formatoEuros } from "./ui.js";

const $caja = document.getElementById("disponible-hoy");
const $etiqueta = document.getElementById("disponible-etiqueta");
const $detalle = document.getElementById("disponible-detalle");
const $valor = document.getElementById("disponible-valor");
const $sinPresupuesto = document.getElementById("disponible-sin-presupuesto");

// Cuánto se puede gastar hoy sin pasarse del presupuesto del mes. Solo cuentan las categorías con
// presupuesto (igual que la barra global del resumen). El cupo de hoy es lo que quedaba al empezar
// el día repartido entre los días que faltan (hoy incluido); a eso se le resta lo gastado hoy.
// Los gastos con fecha posterior a hoy se tratan como ya comprometidos. Devuelve null si no hay
// ningún presupuesto.
export function calcularDisponible({ gastos, presupuestos, hoy = new Date() }) {
  const limites = Object.entries(presupuestos).filter(([, v]) => Number(v) > 0);
  if (!limites.length) return null;
  const conPresupuesto = new Set(limites.map(([id]) => id));
  const limiteTotal = limites.reduce((s, [, v]) => s + Number(v), 0);

  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const inicioManana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  let otrosDias = 0;
  let gastadoHoy = 0;
  gastos.forEach((g) => {
    if (!conPresupuesto.has(g.categoria)) return;
    if (g.fecha >= inicioHoy && g.fecha < inicioManana) gastadoHoy += g.importe;
    else otrosDias += g.importe;
  });

  const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const diasRestantes = diasDelMes - hoy.getDate() + 1;
  const restanteAlEmpezarHoy = limiteTotal - otrosDias;
  const cupoHoy = Math.max(0, restanteAlEmpezarHoy) / diasRestantes;
  return {
    limiteTotal,
    gastadoHoy,
    restanteMes: limiteTotal - otrosDias - gastadoHoy,
    disponibleHoy: cupoHoy - gastadoHoy,
    diasRestantes,
  };
}

function pintar(r) {
  $sinPresupuesto.classList.toggle("oculto", r !== null);
  $caja.classList.toggle("oculto", r === null);
  if (!r) return;

  const dias = r.diasRestantes === 1 ? "para hoy" : `para ${r.diasRestantes} días`;
  if (r.restanteMes < 0) {
    $etiqueta.textContent = "Presupuesto del mes agotado";
    $detalle.textContent = `De ${formatoEuros(r.limiteTotal)} presupuestados`;
    $valor.textContent = `+${formatoEuros(-r.restanteMes)}`;
  } else if (r.disponibleHoy < 0) {
    $etiqueta.textContent = "Hoy te has pasado";
    $detalle.textContent = `Quedan ${formatoEuros(r.restanteMes)} del mes ${dias}`;
    $valor.textContent = `+${formatoEuros(-r.disponibleHoy)}`;
  } else {
    $etiqueta.textContent = "Hoy puedes gastar";
    $detalle.textContent = `Quedan ${formatoEuros(r.restanteMes)} del mes ${dias}`;
    $valor.textContent = formatoEuros(r.disponibleHoy);
  }
  $caja.classList.toggle("exceso", r.restanteMes < 0 || r.disponibleHoy < 0);
}

export async function actualizarDisponible() {
  const hoy = new Date();
  try {
    const [gastos, presupuestos] = await Promise.all([
      gastosEntre(new Date(hoy.getFullYear(), hoy.getMonth(), 1), new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)),
      getPresupuestos(),
    ]);
    pintar(calcularDisponible({ gastos, presupuestos, hoy }));
  } catch (err) {
    // Sin conexión: mejor no enseñar nada que una cifra vieja o equivocada.
    console.error(err);
    $caja.classList.add("oculto");
    $sinPresupuesto.classList.add("oculto");
  }
}

export function initDisponible({ onPedirPresupuesto }) {
  $sinPresupuesto.addEventListener("click", onPedirPresupuesto);
  actualizarDisponible();
}
