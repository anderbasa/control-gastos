let timeoutId = null;

export function mostrarToast(mensaje, duracion = 2200) {
  const $toast = document.getElementById("toast");
  $toast.textContent = mensaje;
  $toast.classList.remove("oculto");
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => $toast.classList.add("oculto"), duracion);
}

export function formatoEuros(valor) {
  return valor.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
