# Control de Gastos

Web estática de uso personal para registrar gastos diarios en 2 taps (categoría +
importe) desde una pegatina NFC, y consultar un resumen mensual. Sin login: los
datos viven en Firestore protegidos solo por reglas de seguridad.

## 1. Crear el proyecto de Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) → **Añadir proyecto**.
   Dale un nombre (p. ej. `control-gastos`) y sigue el asistente (puedes desactivar
   Google Analytics, no hace falta).
2. Dentro del proyecto, ve a **Compilación → Firestore Database → Crear base de datos**.
   - Elige una ubicación (p. ej. `eur3 (europe-west)`).
   - Empieza en **modo producción** (bloquea todo por defecto; las reglas de abajo
     abren solo lo necesario).
3. Ve a **Configuración del proyecto** (el engranaje) → pestaña **Tus apps** →
   icono `</>` (Web) → registra una app (nombre libre, no hace falta Hosting).
4. Firebase te mostrará un objeto `firebaseConfig` con `apiKey`, `authDomain`,
   `projectId`, etc. **Cópialo entero.**

## 2. Pegar las credenciales

Abre [`js/config.js`](js/config.js) y sustituye los valores `PEGA_AQUI_...` por los
que te dio Firebase:

```js
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "control-gastos-xxxx.firebaseapp.com",
  projectId: "control-gastos-xxxx",
  storageBucket: "control-gastos-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
```

> Esta config **no es secreta** (es normal que viaje en el HTML/JS de cualquier
> app Firebase), pero como no hay login, la seguridad real de tus datos depende
> 100% de las **reglas de Firestore** del paso siguiente. No las saltes.

Si quieres, aprovecha y añade o renombra categorías en el mismo archivo, en la
lista `CATEGORIAS`.

## 3. Reglas de seguridad de Firestore

Ve a **Firestore Database → Reglas** y pega esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /gastos/{gastoId} {
      allow read, write: if request.resource.data.importe is number
                          && request.resource.data.importe > 0
                          && request.resource.data.categoria is string;
      allow read: if true;
      allow delete: if true;
    }
    match /config/presupuestos {
      allow read, write: if true;
    }
  }
}
```

(`config/presupuestos` guarda los límites mensuales que pones en la pantalla de
presupuestos — un único documento, sin datos sensibles.)

Esto **no requiere login** (nadie te pide contraseña al abrir la web), pero sí
exige que cualquier escritura tenga la forma de un gasto válido — evita que un
bot que encuentre tu `projectId` te llene la base de basura aleatoria. Sigue
siendo una base de datos "de facto" pública para quien conozca tu config, así
que no la uses para nada más sensible que gastos personales.

## 4. Probar en local

No hace falta build ni `npm install`. Basta con servir la carpeta con cualquier
servidor estático (los módulos ES no funcionan con `file://`):

```bash
npx serve .
```

o si tienes Python:

```bash
python -m http.server 8080
```

Abre la URL que te dé, revisa que puedes registrar un gasto y que aparece en
Firestore Console → Firestore Database → Datos → colección `gastos`.

## 5. Desplegar en GitHub Pages

```bash
git init
git add .
git commit -m "Primera versión de Control de Gastos"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/control-gastos.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → Source: Deploy from a branch → Branch:
`main` / `/(root)`**. Al cabo de un minuto tu web estará en:

```
https://<tu-usuario>.github.io/control-gastos/
```

## 6. Programar la pegatina NFC

Con cualquier app de escritura NFC (p. ej. **NFC Tools** en Android/iOS):

1. Añade un registro tipo **URL / URI**.
2. Pega la URL de GitHub Pages del paso anterior.
3. Escribe la pegatina y acércala al móvil para probar que abre la web
   directamente en la pantalla de registro.

Para que se abra a pantalla completa como una app (sin la barra del navegador),
puedes primero "Añadir a pantalla de inicio" desde el navegador y, si tu
gestor NFC lo permite, apuntar la etiqueta a esa app instalada en vez de al
navegador — si no, abrir la URL normal funciona igual de bien.

## Funcionalidades

- **Registro rápido**: categoría + importe con teclado numérico propio, nota y
  fecha opcionales, en menos de 5 segundos.
- **Resumen mensual**: total, media diaria, comparación con el mes anterior,
  donut de desglose por categoría y lista editable de movimientos.
- **Presupuestos por categoría**: desde el icono ⚙️ del resumen defines un
  límite mensual por categoría (o lo dejas en blanco para no ponerle límite).
  Cada categoría con presupuesto muestra una barra de progreso (verde → ámbar
  a partir del 80% → rojo si te pasas), y si hay al menos un presupuesto
  definido aparece también una barra global bajo el total del mes.
- **Exportar a Excel**: el botón "Exportar a Excel" del resumen descarga un
  `.xlsx` con dos hojas — "Gastos" (todos los movimientos del mes, con
  cabecera de color, importes en formato moneda y fila de total con fórmula)
  y "Resumen" (total e importe por categoría con su % del gasto del mes).

## Estructura del proyecto

```
index.html              pantalla única (registro + resumen) + CDN de ExcelJS
css/estilo.css          estilos mobile-first (Plus Jakarta Sans + Space Grotesk)
js/config.js            credenciales Firebase + categorías (nombre, color, icono SVG)
js/firebase.js          init Firestore + CRUD de gastos y presupuestos
js/app.js               router entre vista registro / resumen
js/vista-registro.js    asistente de registro (importe → categoría) + modal de edición
js/teclado.js           teclado numérico reutilizado por el registro y la edición
js/vista-resumen.js     selector de mes, totales, presupuestos, gráfico, lista
js/graficos.js          donut SVG dibujado a mano, con animación de entrada
js/excel.js             generación del .xlsx (ExcelJS) con hojas Gastos + Resumen
js/ui.js                toasts, iconos SVG, formateo de moneda y animación de contadores
manifest.json / sw.js   soporte PWA básico (instalable, funciona offline salvo Firestore)
```

## Ampliar categorías

Edita el array `CATEGORIAS` en [`js/config.js`](js/config.js): cada entrada es
`{ id, nombre, emoji, color }`. El `id` es el valor que se guarda en Firestore,
así que si renombras una categoría existente cambia solo `nombre`/`emoji`/`color`,
no el `id` (o los gastos antiguos quedarán con una categoría "fantasma").
