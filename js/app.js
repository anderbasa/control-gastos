import { estaConfigurado } from "./firebase.js";
import { initVistaRegistro } from "./vista-registro.js";
import {
  initVistaResumen,
  refrescar as refrescarResumen,
  abrirModalPresupuestos,
  datosInforme,
  datosInformeListos,
} from "./vista-resumen.js";
import { initAno, abrirAno } from "./ano.js";
import { initVistaInforme, mostrarInforme } from "./vista-informe.js";
import { initCopia } from "./copia.js";
import { initDisponible, actualizarDisponible } from "./disponible.js";

const VISTAS = {
  registro: document.getElementById("vista-registro"),
  resumen: document.getElementById("vista-resumen"),
  informe: document.getElementById("vista-informe"),
};
const $avisoConfig = document.getElementById("aviso-config");

function mostrarVista(nombre) {
  Object.entries(VISTAS).forEach(([clave, $vista]) => $vista.classList.toggle("oculto", clave !== nombre));
  window.scrollTo(0, 0);
}

function mostrarResumen() {
  mostrarVista("resumen");
  return refrescarResumen();
}

function mostrarRegistro() {
  mostrarVista("registro");
  // En el resumen se pueden editar o borrar gastos y cambiar presupuestos.
  actualizarDisponible();
}

const $topbar = document.querySelector(".topbar");
window.addEventListener(
  "scroll",
  () => $topbar.classList.toggle("con-scroll", window.scrollY > 4),
  { passive: true }
);

document.getElementById("btn-resumen").addEventListener("click", mostrarResumen);
document.getElementById("btn-volver").addEventListener("click", mostrarRegistro);
document.getElementById("btn-ver-informe").addEventListener("click", async () => {
  mostrarVista("informe");
  mostrarInforme(await datosInformeListos());
});
document.getElementById("btn-ano").addEventListener("click", () => abrirAno(datosInforme().mesDate.getFullYear()));
document.getElementById("btn-cerrar-informe").addEventListener("click", () => mostrarVista("resumen"));
document.addEventListener("gasto-guardado", actualizarDisponible);
document.addEventListener("datos-restaurados", actualizarDisponible);

if (!estaConfigurado()) {
  $avisoConfig.classList.remove("oculto");
}

initVistaRegistro();
initVistaResumen();
initVistaInforme();
initAno();
initCopia();
initDisponible({
  onPedirPresupuesto: async () => {
    await mostrarResumen();
    abrirModalPresupuestos();
  },
});
