import { getCategoria, CATEGORIAS } from "./config.js";

const COLOR_ENCABEZADO = "FF5B5FEF";
const COLOR_TEXTO_CLARO = "FFFFFFFF";
const COLOR_TITULO = "FF14151A";
const FORMATO_MONEDA = '#,##0.00 "€"';

function estilarTitulo(hoja, ultimaColumna, texto) {
  hoja.mergeCells(`A1:${ultimaColumna}1`);
  const celda = hoja.getCell("A1");
  celda.value = texto;
  celda.font = { bold: true, size: 14, color: { argb: COLOR_TITULO } };
  celda.alignment = { vertical: "middle" };
  hoja.getRow(1).height = 28;
}

function estilarCabecera(fila) {
  fila.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLOR_TEXTO_CLARO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ENCABEZADO } };
    cell.alignment = { vertical: "middle" };
  });
}

// gastos: [{ importe, categoria, nota, fecha }], nombreMes: "septiembre de 2026", mesId: "2026-09"
export async function exportarExcel({ gastos, nombreMes, mesId }) {
  if (typeof ExcelJS === "undefined") {
    throw new Error("No se pudo cargar la librería de Excel (revisa tu conexión)");
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Control de Gastos";
  wb.created = new Date();

  const ordenados = [...gastos].sort((a, b) => a.fecha - b.fecha);
  const totalGeneral = ordenados.reduce((s, g) => s + g.importe, 0);

  // --- Hoja 1: Gastos ---
  const hoja = wb.addWorksheet(`Gastos ${mesId}`, { views: [{ state: "frozen", ySplit: 2 }] });
  hoja.columns = [
    { key: "fecha", width: 13 },
    { key: "hora", width: 8 },
    { key: "categoria", width: 24 },
    { key: "importe", width: 13 },
    { key: "nota", width: 32 },
  ];

  estilarTitulo(hoja, "E", `Gastos de ${nombreMes}`);

  const filaCabecera = hoja.addRow(["Fecha", "Hora", "Categoría", "Importe", "Nota"]);
  estilarCabecera(filaCabecera);
  hoja.autoFilter = { from: "A2", to: "E2" };

  ordenados.forEach((g) => {
    hoja.addRow([
      g.fecha.toLocaleDateString("es-ES"),
      g.fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      getCategoria(g.categoria).nombre,
      g.importe,
      g.nota || "",
    ]);
  });

  hoja.getColumn(4).numFmt = FORMATO_MONEDA;

  const filaTotal = hoja.addRow([
    "",
    "",
    "TOTAL",
    { formula: `SUM(D3:D${2 + ordenados.length})`, result: totalGeneral },
    "",
  ]);
  filaTotal.font = { bold: true };
  filaTotal.getCell(4).numFmt = FORMATO_MONEDA;

  // --- Hoja 2: Resumen por categoría ---
  const resumen = wb.addWorksheet("Resumen");
  resumen.columns = [
    { key: "categoria", width: 24 },
    { key: "importe", width: 14 },
    { key: "pct", width: 12 },
  ];

  estilarTitulo(resumen, "C", `Resumen por categoría — ${nombreMes}`);

  const filaCabeceraResumen = resumen.addRow(["Categoría", "Importe", "% del total"]);
  estilarCabecera(filaCabeceraResumen);

  const porCategoria = CATEGORIAS.map((c) => ({
    nombre: c.nombre,
    valor: ordenados.filter((g) => g.categoria === c.id).reduce((s, g) => s + g.importe, 0),
  }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  porCategoria.forEach((c) => {
    resumen.addRow([c.nombre, c.valor, totalGeneral > 0 ? c.valor / totalGeneral : 0]);
  });

  resumen.getColumn(2).numFmt = FORMATO_MONEDA;
  resumen.getColumn(3).numFmt = "0.0%";

  const filaTotalResumen = resumen.addRow(["TOTAL", totalGeneral, 1]);
  filaTotalResumen.font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gastos-${mesId}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
