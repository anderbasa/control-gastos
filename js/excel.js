import { getCategoria, CATEGORIAS } from "./config.js";
import { donutConLeyendaPNG, barrasPorDiaPNG } from "./graficos-informe.js";

const COLOR_ENCABEZADO = "FF5B5FEF";
const COLOR_TEXTO_CLARO = "FFFFFFFF";
const COLOR_TITULO = "FF14151A";
const COLOR_SUAVE = "FF6B7080";
const FORMATO_MONEDA = '#,##0.00 "€"';

function estilarTitulo(hoja, ultimaColumna, texto, fila = 1) {
  hoja.mergeCells(`A${fila}:${ultimaColumna}${fila}`);
  const celda = hoja.getCell(`A${fila}`);
  celda.value = texto;
  celda.font = { bold: true, size: 16, color: { argb: COLOR_TITULO } };
  celda.alignment = { vertical: "middle" };
  hoja.getRow(fila).height = 30;
}

function estilarCabecera(fila) {
  fila.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLOR_TEXTO_CLARO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ENCABEZADO } };
    cell.alignment = { vertical: "middle" };
  });
}

function agregarBarraDatos(hoja, ref) {
  hoja.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "dataBar",
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: COLOR_ENCABEZADO },
        gradient: false,
        minLength: 0,
        maxLength: 100,
      },
    ],
  });
}

// gastos: [{ importe, categoria, nota, fecha }]
// stats: { mediaDiaria, diasDelMes, comparacionTexto } (opcional, del resumen ya calculado en pantalla)
export async function exportarExcel({ gastos, nombreMes, mesId, stats = {} }) {
  if (typeof ExcelJS === "undefined") {
    throw new Error("No se pudo cargar la librería de Excel (revisa tu conexión)");
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Control de Gastos";
  wb.created = new Date();

  const ordenados = [...gastos].sort((a, b) => a.fecha - b.fecha);
  const totalGeneral = ordenados.reduce((s, g) => s + g.importe, 0);

  const porCategoria = CATEGORIAS.map((c) => ({
    nombre: c.nombre,
    color: c.color,
    valor: ordenados.filter((g) => g.categoria === c.id).reduce((s, g) => s + g.importe, 0),
  }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const diasDelMes = stats.diasDelMes || new Date(...mesId.split("-").map(Number), 0).getDate();

  // --- Hoja 1: Informe (portada con gráficas) ---
  const informe = wb.addWorksheet("Informe", { properties: { tabColor: { argb: COLOR_ENCABEZADO } } });
  informe.columns = new Array(8).fill(0).map(() => ({ width: 11 }));
  estilarTitulo(informe, "H", `Informe de gastos — ${nombreMes}`);

  informe.getCell("A3").value = "Total del mes";
  informe.getCell("A3").font = { size: 11, color: { argb: COLOR_SUAVE } };
  informe.getCell("B3").value = totalGeneral;
  informe.getCell("B3").numFmt = FORMATO_MONEDA;
  informe.getCell("B3").font = { bold: true, size: 13 };

  informe.getCell("D3").value = "Media diaria";
  informe.getCell("D3").font = { size: 11, color: { argb: COLOR_SUAVE } };
  informe.getCell("E3").value = stats.mediaDiaria || 0;
  informe.getCell("E3").numFmt = FORMATO_MONEDA;
  informe.getCell("E3").font = { bold: true, size: 13 };

  informe.getCell("F3").value = "Vs. mes anterior";
  informe.getCell("F3").font = { size: 11, color: { argb: COLOR_SUAVE } };
  informe.getCell("G3").value = stats.comparacionTexto || "—";
  informe.getCell("G3").font = { bold: true, size: 13 };

  if (porCategoria.length) {
    const donutBuffer = await donutConLeyendaPNG(porCategoria, totalGeneral);
    const idDonut = wb.addImage({ buffer: donutBuffer, extension: "png" });
    informe.addImage(idDonut, { tl: { col: 0, row: 5 }, ext: { width: 480, height: 227 } });

    const barrasBuffer = await barrasPorDiaPNG(ordenados, diasDelMes);
    const idBarras = wb.addImage({ buffer: barrasBuffer, extension: "png" });
    informe.addImage(idBarras, { tl: { col: 0, row: 18 }, ext: { width: 480, height: 213 } });
  } else {
    informe.getCell("A6").value = "Sin gastos este mes.";
    informe.getCell("A6").font = { color: { argb: COLOR_SUAVE } };
  }

  // --- Hoja 2: Gastos (detalle) ---
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
  if (ordenados.length) agregarBarraDatos(hoja, `D3:D${2 + ordenados.length}`);

  const filaTotal = hoja.addRow([
    "",
    "",
    "TOTAL",
    { formula: `SUM(D3:D${2 + ordenados.length})`, result: totalGeneral },
    "",
  ]);
  filaTotal.font = { bold: true };
  filaTotal.getCell(4).numFmt = FORMATO_MONEDA;

  // --- Hoja 3: Resumen por categoría ---
  const resumen = wb.addWorksheet("Resumen");
  resumen.columns = [
    { key: "categoria", width: 24 },
    { key: "importe", width: 14 },
    { key: "pct", width: 12 },
  ];

  estilarTitulo(resumen, "C", `Resumen por categoría — ${nombreMes}`);

  const filaCabeceraResumen = resumen.addRow(["Categoría", "Importe", "% del total"]);
  estilarCabecera(filaCabeceraResumen);

  porCategoria.forEach((c) => {
    resumen.addRow([c.nombre, c.valor, totalGeneral > 0 ? c.valor / totalGeneral : 0]);
  });

  resumen.getColumn(2).numFmt = FORMATO_MONEDA;
  resumen.getColumn(3).numFmt = "0.0%";
  if (porCategoria.length) agregarBarraDatos(resumen, `B3:B${2 + porCategoria.length}`);

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
