import { estaConfigurado } from "./firebase.js";
import { initVistaRegistro } from "./vista-registro.js";
import { initVistaResumen, refrescar as refrescarResumen } from "./vista-resumen.js";
import { initCopia } from "./copia.js";

const $vistaRegistro = document.getElementById("vista-registro");
const $vistaResumen = document.getElementById("vista-resumen");
const $btnResumen = document.getElementById("btn-resumen");
const $btnVolver = document.getElementById("btn-volver");
const $avisoConfig = document.getElementById("aviso-config");

function mostrarResumen() {
  $vistaRegistro.classList.add("oculto");
  $vistaResumen.classList.remove("oculto");
  refrescarResumen();
}

function mostrarRegistro() {
  $vistaResumen.classList.add("oculto");
  $vistaRegistro.classList.remove("oculto");
}

$btnResumen.addEventListener("click", mostrarResumen);
$btnVolver.addEventListener("click", mostrarRegistro);

if (!estaConfigurado()) {
  $avisoConfig.classList.remove("oculto");
}

initVistaRegistro();
initVistaResumen();
initCopia();
