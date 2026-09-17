// Genera gráficas como imágenes PNG (canvas) para incrustar en el informe Excel.
// No se puede insertar un gráfico "vivo" de Excel sin librerías de pago, así que
// dibujamos nosotros mismos con el mismo lenguaje visual que la app.

function canvasABuffer(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      blob.arrayBuffer().then(resolve);
    }, "image/png");
  });
}

function euros(valor) {
  return valor.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function eurosCorto(valor) {
  if (valor >= 1000) return Math.round(valor / 100) / 10 + "k €";
  return Math.round(valor) + " €";
}

// porCategoria: [{ nombre, color, valor }], ya ordenado de mayor a menor.
export async function donutConLeyendaPNG(porCategoria, total) {
  const ancho = 720;
  const alto = Math.max(340, 60 + porCategoria.length * 30);
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);

  const cx = 190;
  const cy = alto / 2;
  const r = 130;
  const grosor = 42;

  ctx.strokeStyle = "#e7e8ed";
  ctx.lineWidth = grosor;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  let acumulado = -Math.PI / 2;
  porCategoria.forEach((c) => {
    const frac = total > 0 ? c.valor / total : 0;
    if (frac <= 0) return;
    const final = acumulado + frac * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, acumulado, final);
    ctx.strokeStyle = c.color;
    ctx.lineWidth = grosor;
    ctx.lineCap = "butt";
    ctx.stroke();
    acumulado = final;
  });

  ctx.fillStyle = "#14151a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 28px Arial";
  ctx.fillText(euros(total), cx, cy - 6);
  ctx.font = "13px Arial";
  ctx.fillStyle = "#6b7080";
  ctx.fillText("TOTAL DEL MES", cx, cy + 20);

  const lx = 400;
  let ly = 46;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#14151a";
  ctx.font = "bold 17px Arial";
  ctx.fillText("Gasto por categoría", lx, 28);

  porCategoria.forEach((c) => {
    const pct = total > 0 ? Math.round((c.valor / total) * 100) : 0;
    ctx.fillStyle = c.color;
    ctx.fillRect(lx, ly - 12, 15, 15);
    ctx.fillStyle = "#14151a";
    ctx.font = "bold 14px Arial";
    ctx.fillText(c.nombre, lx + 22, ly);
    ctx.fillStyle = "#6b7080";
    ctx.font = "13px Arial";
    ctx.fillText(`${euros(c.valor)} · ${pct}%`, lx + 22, ly + 17);
    ly += 42;
  });

  return canvasABuffer(canvas);
}

// gastos: [{ importe, fecha }]. diasDelMes: nº de días del mes mostrado.
export async function barrasPorDiaPNG(gastos, diasDelMes, colorBarra = "#5B5FEF") {
  const totalesPorDia = new Array(diasDelMes).fill(0);
  gastos.forEach((g) => {
    totalesPorDia[g.fecha.getDate() - 1] += g.importe;
  });

  const ancho = 720;
  const alto = 320;
  const margenIzq = 60;
  const margenDer = 20;
  const margenSup = 40;
  const margenInf = 34;
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);

  ctx.fillStyle = "#14151a";
  ctx.font = "bold 17px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Gasto por día del mes", margenIzq, 24);

  const areaAncho = ancho - margenIzq - margenDer;
  const areaAlto = alto - margenSup - margenInf;
  const maxVal = Math.max(...totalesPorDia, 1);
  const espacio = areaAncho / diasDelMes;
  const anchoBarra = Math.max(2, espacio * 0.6);

  ctx.strokeStyle = "#e7e8ed";
  ctx.lineWidth = 1;
  ctx.font = "11px Arial";
  ctx.fillStyle = "#9498a8";
  for (let i = 0; i <= 4; i++) {
    const y = margenSup + areaAlto - (areaAlto * i) / 4;
    ctx.beginPath();
    ctx.moveTo(margenIzq, y);
    ctx.lineTo(ancho - margenDer, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(eurosCorto((maxVal * i) / 4), margenIzq - 8, y);
  }

  totalesPorDia.forEach((valor, i) => {
    const h = maxVal > 0 ? (valor / maxVal) * areaAlto : 0;
    const x = margenIzq + i * espacio + (espacio - anchoBarra) / 2;
    const y = margenSup + areaAlto - h;
    ctx.fillStyle = valor > 0 ? colorBarra : "#e7e8ed";
    ctx.fillRect(x, y, anchoBarra, Math.max(h, valor > 0 ? 2 : 0));

    if ((i + 1) % 5 === 0 || i === 0) {
      ctx.fillStyle = "#6b7080";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(i + 1), x + anchoBarra / 2, alto - margenInf + 6);
    }
  });

  return canvasABuffer(canvas);
}
