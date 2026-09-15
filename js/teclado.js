import { svgIcono } from "./ui.js";

const ICONO_BACKSPACE =
  '<path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7Z"/><path d="M13 10l4 4M17 10l-4 4"/>';

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];

// Crea un teclado numérico dentro de `contenedorEl` que escribe en `elementoDisplay`.
// Devuelve un objeto con getter/setter `.valor` (string tipo "12,5").
export function crearTeclado(contenedorEl, elementoDisplay, { valorInicial = "0", onCambio } = {}) {
  contenedorEl.innerHTML = TECLAS.map((t) => {
    if (t === "⌫") return `<button class="tecla tecla-borrar" data-tecla="${t}">${svgIcono(ICONO_BACKSPACE, 20)}</button>`;
    return `<button class="tecla" data-tecla="${t}">${t}</button>`;
  }).join("");

  let valor = valorInicial;

  function actualizar() {
    elementoDisplay.textContent = valor;
    if (onCambio) onCambio(valor);
  }

  function pulsar(t) {
    if (t === "⌫") {
      valor = valor.length > 1 ? valor.slice(0, -1) : "0";
    } else if (t === ",") {
      if (!valor.includes(",")) valor += ",";
    } else if (valor === "0") {
      valor = t;
    } else if (valor.split(",")[1]?.length >= 2) {
      return;
    } else {
      valor += t;
    }
    actualizar();
  }

  contenedorEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".tecla");
    if (!btn) return;
    pulsar(btn.dataset.tecla);
  });

  actualizar();

  return {
    get valor() {
      return valor;
    },
    set valor(v) {
      valor = v;
      actualizar();
    },
  };
}

export function parseImporte(str) {
  return parseFloat(str.replace(",", "."));
}
