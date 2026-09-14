// Donut SVG dibujado a mano, sin librerías externas.
// segmentos: [{ id, nombre, color, valor }]
export function donutSVG(segmentos, total) {
  const R = 80;
  const C = 100;
  const grosor = 26;
  const circunferencia = 2 * Math.PI * R;

  let acumulado = 0;
  const arcos = segmentos
    .filter((s) => s.valor > 0)
    .map((s) => {
      const frac = total > 0 ? s.valor / total : 0;
      const largo = frac * circunferencia;
      const dasharray = `${largo} ${circunferencia - largo}`;
      const offset = -acumulado * circunferencia;
      acumulado += frac;
      return `<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${s.color}"
        stroke-width="${grosor}" stroke-dasharray="${dasharray}"
        stroke-dashoffset="${offset}" transform="rotate(-90 ${C} ${C})"></circle>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${C * 2} ${C * 2}" class="donut" role="img" aria-label="Desglose por categoría">
      <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="var(--borde)" stroke-width="${grosor}"></circle>
      ${arcos}
    </svg>
  `;
}
