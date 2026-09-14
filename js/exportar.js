import { getCategoria } from "./config.js";

function celdaCSV(valor) {
  const str = String(valor ?? "");
  return /[;"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function exportarCSV(gastos, nombreArchivo) {
  const cabecera = ["Fecha", "Hora", "Categoria", "Importe", "Nota"];
  const filas = gastos.map((g) => [
    g.fecha.toLocaleDateString("es-ES"),
    g.fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    getCategoria(g.categoria).nombre,
    g.importe.toFixed(2).replace(".", ","),
    g.nota || "",
  ]);
  const lineas = [cabecera, ...filas].map((fila) => fila.map(celdaCSV).join(";"));
  const csv = "﻿" + lineas.join("\r\n"); // BOM para que Excel detecte UTF-8

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
