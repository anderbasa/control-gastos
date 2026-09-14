// Donut SVG dibujado a mano, sin librerías externas.
// segmentos: [{ id, nombre, color, valor }]
const R = 80;
const C = 100;
const GROSOR = 26;
const CIRCUNFERENCIA = 2 * Math.PI * R;

export function donutSVG(segmentos, total) {
  let acumulado = 0;
  const arcos = segmentos
    .filter((s) => s.valor > 0)
    .map((s) => {
      const frac = total > 0 ? s.valor / total : 0;
      const largo = frac * CIRCUNFERENCIA;
      const offset = -acumulado * CIRCUNFERENCIA;
      acumulado += frac;
      return `<circle class="arco" cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${s.color}"
        stroke-width="${GROSOR}" stroke-dasharray="0 ${CIRCUNFERENCIA}"
        data-dasharray="${largo} ${CIRCUNFERENCIA - largo}"
        stroke-dashoffset="${offset}" transform="rotate(-90 ${C} ${C})"></circle>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${C * 2} ${C * 2}" class="donut" role="img" aria-label="Desglose por categoría">
      <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="var(--borde)" stroke-width="${GROSOR}"></circle>
      ${arcos}
    </svg>
  `;
}

// Anima los arcos desde 0 hasta su valor real (doble rAF para forzar el reflow inicial).
export function animarDonut(contenedor) {
  const arcos = contenedor.querySelectorAll(".arco");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      arcos.forEach((arco) => {
        arco.setAttribute("stroke-dasharray", arco.dataset.dasharray);
      });
    });
  });
}
