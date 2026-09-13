// =============================
// ELEMENTOS DEL DOM
// =============================

const display = document.getElementById("spm-display");
const status = document.getElementById("status");
const circle = document.getElementById("circle");
const ripples = document.querySelectorAll(".ripple");
const chartLine = document.getElementById("chart-line");
const chartArea = document.getElementById("chart-area");
const chartPoints = document.getElementById("chart-points");
const chartYMax = document.getElementById("chart-y-max");
const chartYMin = document.getElementById("chart-y-min");
const themeToggleBtn = document.getElementById("theme-toggle");
const iconSun = document.getElementById("icon-sun");
const iconMoon = document.getElementById("icon-moon");
const recordBtn = document.getElementById("record-btn");
const chartCard = document.getElementById("chart-card");
const sessionView = document.getElementById("session-view");
const sessionViewTitle = document.getElementById("session-view-title");
const sessionSvg = document.getElementById("session-svg");
const promoBanner = document.getElementById("promo-banner");
const installLink = document.getElementById("install-link");
const installHint = document.getElementById("install-hint");


// =============================
// ESTADO INTERNO
// =============================

let lastTapTime = null;
let intervals = [];
let spmHistory = [];
let lastTapTimestamp = 0;
let spmSeries = []; // { ts, spm } — historial para el gráfico

// Grabación manual de una serie completa (para mostrarle al equipo después)
let isRecording = false;
let recordingSeries = []; // { t: segundos desde el inicio, spm }
let recordingStartTs = null;


// =============================
// CONFIGURACIÓN
// =============================

const STROKES_PER_TAP = 1;
const MAX_INTERVALS = 3;
const STABILITY_SAMPLES = 4;
const SPM_TOLERANCE = 2;
const RANGE_THRESHOLD = 2;
const BREAK_THRESHOLD = 2;
const DOUBLE_TAP_THRESHOLD = 300;
const AUTO_RESET_TIME = 30000;
const CHART_WINDOW_MS = 60000;

// Rango real de remo: un remero suele ir entre 14 y 65 SPM, rara vez pasa
// de 36. Se usa solo para que el gráfico no exagere ruido chico ni se
// desarme ante un mistap — no define ninguna zona "buena/mala".
const RATE_MIN_BOUND = 10;
const RATE_MAX_BOUND = 70;
const RATE_MIN_SPREAD = 6;
const MAX_REALISTIC_SPM = 65; // por encima de esto, es una lectura inválida

const LONG_PRESS_MS = 600;
const RECORDING_KEY = "spm_recording";


// =============================
// VIBRACIÓN (feedback táctil)
// =============================
// El entrenador mira el bote, no el teléfono: la vibración confirma
// que el tap se registró sin necesidad de mirar la pantalla.
// Sin toggle ni configuración: se mantiene simple a propósito.
// Nota: iOS Safari no implementa navigator.vibrate (ninguna versión) —
// en iPhone la app funciona igual, solo sin este feedback.

const VIBRATE_TAP_MS = 15;
const VIBRATE_RESET_PATTERN = [20, 40, 20];
const VIBRATE_ALERT_PATTERN = [40, 60, 40, 60, 40];
const VIBRATE_RECORD_START = 30;
const VIBRATE_RECORD_STOP = [30, 40, 30];

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}


// =============================
// WAKE LOCK (evita que se apague la pantalla)
// =============================

let wakeLockSentinel = null;

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || wakeLockSentinel) return;

  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
    });
  } catch (err) {
    // No es crítico: la app sigue funcionando igual, solo no se evita
    // que la pantalla se apague sola (navegador sin soporte o política).
    console.warn("Wake Lock no disponible:", err);
  }
}

requestWakeLock();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    requestWakeLock();
  }
});


// =============================
// SPLASH DE BIENVENIDA
// =============================
// Se saca del todo del DOM cuando termina de desvanecerse, para no dejar
// una capa fixed invisible dando vueltas.

const splash = document.getElementById("splash");

if (splash) {
  splash.addEventListener("animationend", (e) => {
    if (e.target === splash) splash.remove();
  });
}


// =============================
// EVENTO PRINCIPAL (tap normal vs. mantener presionado)
// =============================
// Un tap corto cuenta una remada. Mantener presionado (en cualquier lugar)
// prende/apaga la grabación de una serie — un gesto extra, sin agregar
// botones nuevos en pantalla. El click que dispara el navegador al soltar
// una presión larga se descarta para que no cuente como remada de más.

let pressTimer = null;
let longPressTriggered = false;

document.body.addEventListener("pointerdown", () => {
  longPressTriggered = false;
  pressTimer = setTimeout(() => {
    longPressTriggered = true;
    toggleRecording();
  }, LONG_PRESS_MS);
});

document.body.addEventListener("pointerup", () => {
  clearTimeout(pressTimer);
});

document.body.addEventListener("pointercancel", () => {
  clearTimeout(pressTimer);
});

document.body.addEventListener("click", () => {
  if (longPressTriggered) {
    longPressTriggered = false;
    return;
  }
  handleTap();
});


// =============================
// LÓGICA DE TAP
// =============================

function handleTap() {
  const now = Date.now();

  // Por si el wake lock se liberó (ej. app en background), reintentar
  requestWakeLock();

  // Ripple
  ripples.forEach(ripple => {
    ripple.classList.remove("active");
    void ripple.offsetWidth;
    ripple.classList.add("active");
  });

  // Double tap → reset
  if (now - lastTapTimestamp < DOUBLE_TAP_THRESHOLD) {
    vibrate(VIBRATE_RESET_PATTERN);
    reset();
    return;
  }
  lastTapTimestamp = now;

  if (!lastTapTime) {
    lastTapTime = now;
    vibrate(VIBRATE_TAP_MS);
    status.textContent = "Midiendo...";
    setState("warning");
    return;
  }

  const delta = (now - lastTapTime) / 1000;
  lastTapTime = now;

  if (delta < 0.3) return;
  if (delta > 15) {
    vibrate(VIBRATE_RESET_PATTERN);
    reset();
    return;
  }
  vibrate(VIBRATE_TAP_MS);

  intervals.push(delta);
  if (intervals.length > MAX_INTERVALS) {
    intervals.shift();
  }

  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const spm = (60 / avg) * STROKES_PER_TAP;
  const roundedSpm = Math.round(spm);

  // Nadie rema por encima de esto: es una lectura inválida (glitch de
  // pantalla, doble registro), no un ritmo real. Se avisa fuerte y no se
  // deja ensuciar el promedio con este tap.
  if (roundedSpm > MAX_REALISTIC_SPM) {
    intervals.pop();
    vibrate(VIBRATE_ALERT_PATTERN);
    status.textContent = "Lectura fuera de rango — repetí el tap";
    setState("alert");
    return;
  }

  display.textContent = roundedSpm;

  spmHistory.push(roundedSpm);
  if (spmHistory.length > STABILITY_SAMPLES) {
    spmHistory.shift();
  }

  spmSeries.push({ ts: now, spm: roundedSpm });
  renderChart();

  if (isRecording) {
    recordingSeries.push({ t: (now - recordingStartTs) / 1000, spm: roundedSpm });
  }

  updateState();
}


// =============================
// ESTABILIDAD
// =============================

function updateState() {
  if (spmHistory.length < 2) {
    status.textContent = "Midiendo...";
    setState("warning");
    return;
  }

  const last = spmHistory[spmHistory.length - 1];
  const prev = spmHistory[spmHistory.length - 2];

  if (Math.abs(last - prev) > BREAK_THRESHOLD) {
    status.textContent = "Inestable";
    setState("warning");
    return;
  }

  if (spmHistory.length < STABILITY_SAMPLES) {
    status.textContent = "Ajustando...";
    setState("warning");
    return;
  }

  const avgSpm =
    spmHistory.reduce((a, b) => a + b, 0) / spmHistory.length;

  const withinTolerance = spmHistory.every(
    (v) => Math.abs(v - avgSpm) <= SPM_TOLERANCE
  );

  const range = Math.max(...spmHistory) - Math.min(...spmHistory);

  const isStable = withinTolerance && range <= RANGE_THRESHOLD;

  if (isStable) {
    status.textContent = "Estable";
    setState("active");
  } else {
    status.textContent = "Inestable";
    setState("warning");
  }
}


// =============================
// GRÁFICO SPM / TIEMPO
// =============================

// Rango realista de remo (14-65 SPM) como piso/techo de seguridad, más un
// mínimo de escala para que el ritmo estable no se vea como una montaña rusa.
// La usan tanto el gráfico en vivo como la vista de grabación guardada.
function computeScale(values) {
  let min = Math.max(Math.min(...values), RATE_MIN_BOUND);
  let max = Math.min(Math.max(...values), RATE_MAX_BOUND);

  if (max - min < RATE_MIN_SPREAD) {
    const mid = (max + min) / 2;
    min = mid - RATE_MIN_SPREAD / 2;
    max = mid + RATE_MIN_SPREAD / 2;
  }

  return { min, max };
}

function renderChart() {
  const now = Date.now();

  // Los puntos más viejos que la ventana se descartan solos
  spmSeries = spmSeries.filter((p) => now - p.ts <= CHART_WINDOW_MS);

  if (spmSeries.length < 2) {
    chartLine.setAttribute("points", "");
    chartArea.setAttribute("points", "");
    chartPoints.innerHTML = "";
    chartYMax.textContent = "";
    chartYMin.textContent = "";
    return;
  }

  const { min, max } = computeScale(spmSeries.map((p) => p.spm));

  const coords = spmSeries.map((p) => {
    const x = 300 - ((now - p.ts) / CHART_WINDOW_MS) * 300;
    const y = 100 - ((p.spm - min) / (max - min)) * 100;
    return { x, y };
  });

  const linePoints = coords
    .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  chartLine.setAttribute("points", linePoints);

  const firstX = coords[0].x.toFixed(1);
  const lastX = coords[coords.length - 1].x.toFixed(1);
  chartArea.setAttribute("points", `${firstX},100 ${linePoints} ${lastX},100`);

  chartPoints.innerHTML = coords
    .map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="2.4"></circle>`)
    .join("");

  chartYMax.textContent = Math.round(max);
  chartYMin.textContent = Math.round(min);
}


// =============================
// UI STATE
// =============================

function setState(state) {
  // RESET
  circle.classList.remove("idle", "warning", "active", "alert");
  display.classList.remove("idle", "warning", "active", "alert");

  circle.classList.remove("idle-glow", "warning-glow", "active-glow", "alert-glow");

  // APPLY
  circle.classList.add(state);
  circle.classList.add(state + "-glow");

  display.classList.add(state);

  // IMPORTANTE: sincronizar ripple state base
  document.body.classList.remove("idle", "warning", "active", "alert");
  document.body.classList.add(state);
}


// =============================
// RESET
// =============================

function reset() {
  lastTapTime = null;
  intervals = [];
  spmHistory = [];
  spmSeries = [];

  display.textContent = "CCR";
  status.textContent = "Esperando medida";

  setState("idle");
  renderChart();
}


// =============================
// AUTO RESET
// =============================

setInterval(() => {
  if (lastTapTime && Date.now() - lastTapTime > AUTO_RESET_TIME) {
    reset();
    return;
  }
  // Desliza el gráfico hacia "ahora" aunque no haya taps nuevos
  renderChart();
}, 1000);


// =============================
// TEMA CLARO / OSCURO
// =============================

const THEME_KEY = "theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  // En oscuro se ofrece pasar a claro (ícono sol) y viceversa (ícono luna).
  // Nota: en <svg> la propiedad .hidden no siempre se refleja al atributo
  // (a diferencia de los elementos HTML normales), por eso se usa
  // setAttribute/removeAttribute directamente.
  const showSun = theme === "dark";
  iconSun.toggleAttribute("hidden", !showSun);
  iconMoon.toggleAttribute("hidden", showSun);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#000000" : "#eef2f8");
}

let currentTheme = localStorage.getItem(THEME_KEY) || "light";
applyTheme(currentTheme);

themeToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // no debe contar como tap de remada
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
});

// El link al club no debe contar como tap de remada
if (promoBanner) {
  promoBanner.addEventListener("click", (e) => e.stopPropagation());
}


// =============================
// INSTALAR LA APP (Agregar a inicio)
// =============================
// Android/Chrome exponen "beforeinstallprompt": se puede disparar el
// diálogo nativo de instalación con un botón. iOS Safari no tiene esa
// API — ahí no hay forma de instalar con un solo tap, así que se
// muestran los pasos manuales en su lugar.

const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

let deferredInstallPrompt = null;

if (!isStandalone) {
  if (isIos) {
    // No hay prompt programático en iOS: se deja la instrucción manual.
    installHint.hidden = false;
  } else {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      installLink.hidden = false;
    });
  }
}

installLink.addEventListener("click", async (e) => {
  e.stopPropagation(); // no debe contar como tap de remada
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  // El prompt nativo solo se puede usar una vez
  deferredInstallPrompt = null;
  installLink.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installLink.hidden = true;
  installHint.hidden = true;
});


// =============================
// GRABACIÓN DE UNA SERIE (para mostrarle al equipo)
// =============================
// Se guarda una sola grabación por vez — la última — en localStorage, para
// que el profe pueda mostrarla después aunque haya reiniciado el contador
// o recargado la página.

function toggleRecording() {
  if (!isRecording) {
    isRecording = true;
    recordingSeries = [];
    recordingStartTs = Date.now();
    recordBtn.classList.add("recording");
    vibrate(VIBRATE_RECORD_START);
  } else {
    isRecording = false;
    recordBtn.classList.remove("recording");
    vibrate(VIBRATE_RECORD_STOP);
    saveRecording();
  }
}

function saveRecording() {
  if (recordingSeries.length < 2) return; // nada útil que mostrar después

  const data = {
    savedAt: Date.now(),
    durationSec: recordingSeries[recordingSeries.length - 1].t,
    points: recordingSeries,
  };

  try {
    localStorage.setItem(RECORDING_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("No se pudo guardar la grabación:", err);
  }
}


// =============================
// VISTA DE LA GRABACIÓN GUARDADA
// =============================

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function renderSessionView(data) {
  const values = data.points.map((p) => p.spm);
  const { min, max } = computeScale(values);

  const padLeft = 34;
  const padRight = 10;
  const padTop = 26;
  const padBottom = 34;
  const width = 400;
  const height = 220;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const duration = data.durationSec || 1;

  const coords = data.points.map((p) => ({
    x: padLeft + (p.t / duration) * plotW,
    y: padTop + (1 - (p.spm - min) / (max - min)) * plotH,
    spm: p.spm,
  }));

  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPoints =
    `${coords[0].x.toFixed(1)},${padTop + plotH} ` +
    linePoints +
    ` ${coords[coords.length - 1].x.toFixed(1)},${padTop + plotH}`;

  const pointsMarkup = coords
    .map((c) => `<circle class="session-point" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="2.6"></circle>`)
    .join("");

  // Números chiquitos en el gráfico: con sesiones largas no entran todos
  // sin superponerse, así que se etiqueta como mucho ~12 puntos parejos
  // más el último (el más reciente), en vez de saturar el dibujo.
  const labelStep = Math.max(1, Math.ceil(coords.length / 12));
  const labelsMarkup = coords
    .map((c, i) => {
      const isLast = i === coords.length - 1;
      if (i % labelStep !== 0 && !isLast) return "";
      return `<text class="session-label" x="${c.x.toFixed(1)}" y="${(c.y - 8).toFixed(1)}">${c.spm}</text>`;
    })
    .join("");

  sessionSvg.innerHTML = `
    <line class="session-gridline" x1="${padLeft}" y1="${padTop + plotH / 2}" x2="${width - padRight}" y2="${padTop + plotH / 2}"></line>
    <text class="session-axis" x="${padLeft - 6}" y="${padTop + 4}" text-anchor="end">${Math.round(max)}</text>
    <text class="session-axis" x="${padLeft - 6}" y="${padTop + plotH}" text-anchor="end">${Math.round(min)}</text>
    <text class="session-axis" x="${padLeft}" y="${height - 8}" text-anchor="start">0:00</text>
    <text class="session-axis" x="${width - padRight}" y="${height - 8}" text-anchor="end">${formatDuration(duration)}</text>
    <polygon class="session-area" points="${areaPoints}"></polygon>
    <polyline class="session-line" points="${linePoints}"></polyline>
    ${pointsMarkup}
    ${labelsMarkup}
  `;

  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  sessionViewTitle.textContent =
    `Grabación · ${formatDuration(duration)} · ${data.points.length} remadas · promedio ${avg}`;
}

function openSessionView() {
  const raw = localStorage.getItem(RECORDING_KEY);
  if (!raw) {
    status.textContent = "No hay grabación guardada todavía";
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return;
  }

  renderSessionView(data);
  sessionView.hidden = false;
}

recordBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // no debe contar como tap ni abrir la vista de sesión
  toggleRecording();
});

chartCard.addEventListener("click", (e) => {
  e.stopPropagation(); // no debe contar como tap de remada
  if (longPressTriggered) {
    longPressTriggered = false;
    return;
  }
  if (!isRecording) openSessionView();
});

sessionView.addEventListener("click", (e) => {
  e.stopPropagation();
  sessionView.hidden = true;
});