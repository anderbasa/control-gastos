let timeoutId = null;

export function mostrarToast(mensaje, duracion = 2600) {
  const $toast = document.getElementById("toast");
  $toast.textContent = mensaje;
  $toast.classList.remove("oculto");
  $toast.classList.remove("toast-salir");
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    $toast.classList.add("toast-salir");
    setTimeout(() => $toast.classList.add("oculto"), 200);
  }, duracion);
}

export function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function formatoEuros(valor) {
  return valor.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// Icono de línea a partir de los <path> de config.js.
export function svgIcono(pathsInner, tamaño = 24) {
  return `<svg viewBox="0 0 24 24" width="${tamaño}" height="${tamaño}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${pathsInner}</svg>`;
}

// Anima un valor numérico de 0 (o su valor previo) hasta `valorFinal`, formateado con `formatoFn`.
const animacionesActivas = new WeakMap();

export function animarNumero(el, valorFinal, formatoFn = formatoEuros, duracion = 700) {
  if (animacionesActivas.has(el)) cancelAnimationFrame(animacionesActivas.get(el));
  const inicio = performance.now();
  const desde = 0;
  function paso(ahora) {
    const t = Math.min(1, (ahora - inicio) / duracion);
    const facilitado = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const valorActual = desde + (valorFinal - desde) * facilitado;
    el.textContent = formatoFn(valorActual);
    if (t < 1) {
      animacionesActivas.set(el, requestAnimationFrame(paso));
    } else {
      animacionesActivas.delete(el);
    }
  }
  animacionesActivas.set(el, requestAnimationFrame(paso));
}
