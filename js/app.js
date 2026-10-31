import { estaConfigurado } from "./firebase.js";
import { initVistaRegistro } from "./vista-registro.js";
import { initVistaResumen, refrescar as refrescarResumen, abrirModalPresupuestos } from "./vista-resumen.js";
import { initCopia } from "./copia.js";
import { initDisponible, actualizarDisponible } from "./disponible.js";

const $vistaRegistro = document.getElementById("vista-registro");
const $vistaResumen = document.getElementById("vista-resumen");
const $btnResumen = document.getElementById("btn-resumen");
const $btnVolver = document.getElementById("btn-volver");
const $avisoConfig = document.getElementById("aviso-config");

function mostrarResumen() {
  $vistaRegistro.classList.add("oculto");
  $vistaResumen.classList.remove("oculto");
  return refrescarResumen();
}

function mostrarRegistro() {
  $vistaResumen.classList.add("oculto");
  $vistaRegistro.classList.remove("oculto");
  // En el resumen se pueden editar o borrar gastos y cambiar presupuestos.
  actualizarDisponible();
}

$btnResumen.addEventListener("click", mostrarResumen);
$btnVolver.addEventListener("click", mostrarRegistro);
document.addEventListener("gasto-guardado", actualizarDisponible);
document.addEventListener("datos-restaurados", actualizarDisponible);

if (!estaConfigurado()) {
  $avisoConfig.classList.remove("oculto");
}

initVistaRegistro();
initVistaResumen();
initCopia();
initDisponible({
  onPedirPresupuesto: async () => {
    await mostrarResumen();
    abrirModalPresupuestos();
  },
});
