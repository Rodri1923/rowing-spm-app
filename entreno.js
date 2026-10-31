// =============================
// PESTAÑA ENTRENO
// =============================
// Contador de remadas (SPM) + cronómetro. Tocar en cualquier lugar de esta
// pestaña que no sea un botón cuenta una remada. Mientras el cronómetro
// corre, cada lectura de SPM se graba junto con las vueltas, y al terminar
// el entreno queda guardado en el Historial (reemplaza al viejo botón REC:
// ya no hay que acordarse de grabar).
// Con una pasada en curso aparecen los botes abajo de la medición: un toque
// le anota a ese bote el SPM que se acaba de medir.

import {
  $, vibrate, store, history, uid, toast, requestWakeLock, escapeHtml,
  formatClock, computeScale, buildChartMarkup,
} from "./core.js";
import { runningBoats, recordBoatSpm } from "./pasadas.js";

const view = $("view-entreno");
const display = $("spm-display");
const status = $("status");
const circle = $("circle");
const sphereFx = $("sphere-fx");
const ripples = document.querySelectorAll(".ripple");
const chartLine = $("chart-line");
const chartArea = $("chart-area");
const chartPoints = $("chart-points");
const chartYMax = $("chart-y-max");
const chartYMid = $("chart-y-mid");
const chartYMin = $("chart-y-min");
const swTime = $("sw-time");
const swLeft = $("sw-left");
const swRight = $("sw-right");
const swLastLap = $("sw-last-lap");
const spmBoats = $("spm-boats");


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
const MAX_REALISTIC_SPM = 65; // por encima de esto, es una lectura inválida
const IDLE_TEXT = "Tocá la pantalla en cada remada";

const VIBRATE_TAP_MS = 15;
const VIBRATE_RESET_PATTERN = [20, 40, 20];
const VIBRATE_ALERT_PATTERN = [40, 60, 40, 60, 40];

const STOPWATCH_KEY = "spm_stopwatch";
const END_CONFIRM_MS = 3000;
const MIN_SESSION_MS = 5000; // menos que esto no vale la pena guardarlo
const VIBRATE_SW_START = 30;
const VIBRATE_SW_PAUSE = [20, 40, 20];
const VIBRATE_SW_LAP = 40;


// =============================
// ESTADO SPM
// =============================

let lastTapTime = null;
let intervals = [];
let spmHistory = [];
let lastTapTimestamp = 0;
let spmSeries = []; // { ts, spm, state } — últimos 60s para el gráfico
let currentSpm = null;  // última lectura válida (para anotarla a un bote)
let measureKey = null;  // identifica esta medición (de la primera remada al reset)


// =============================
// ESFERA CENTRAL
// =============================
// 18 anillos girando en 3D, un solo color de marca (el color lo pone el
// CSS según el estado del círculo). Se genera una sola vez al cargar.

const SPHERE_RING_COUNT = 18;

function buildSphere() {
  if (!sphereFx) return;
  sphereFx.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= SPHERE_RING_COUNT; i++) {
    const ring = document.createElement("div");
    ring.className = "sphere-ring";
    const duration = (SPHERE_RING_COUNT * 0.26).toFixed(2);
    const delay = (i * 0.075).toFixed(3);
    ring.style.animation = `sphere-spin ${duration}s linear ${delay}s infinite`;
    ring.style.opacity = (0.05 + i * 0.02).toFixed(3);
    frag.appendChild(ring);
  }
  sphereFx.appendChild(frag);
}


// =============================
// LÓGICA DE TAP
// =============================

function handleTap() {
  const now = Date.now();

  // Por si el wake lock se liberó (ej. app en background), reintentar
  requestWakeLock();

  // Ripple "líquido": la onda principal + una gotita de impacto chica y
  // rápida. Se usan solo 2 de las 3 ripples (la tercera queda libre para
  // el pulso ambiental en idle) para no amontonar ondas si se tapea rápido.
  const waveRipple = ripples[0];
  waveRipple.classList.remove("active");
  void waveRipple.offsetWidth;
  waveRipple.classList.add("active");

  const impactRipple = ripples[1];
  impactRipple.classList.remove("active-impact");
  void impactRipple.offsetWidth;
  impactRipple.classList.add("active-impact");

  // Double tap → reset
  if (now - lastTapTimestamp < DOUBLE_TAP_THRESHOLD) {
    vibrate(VIBRATE_RESET_PATTERN);
    resetSpm();
    return;
  }
  lastTapTimestamp = now;

  if (!lastTapTime) {
    lastTapTime = now;
    measureKey = uid();
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
    resetSpm();
    return;
  }
  vibrate(VIBRATE_TAP_MS);

  intervals.push(delta);
  if (intervals.length > MAX_INTERVALS) {
    intervals.shift();
  }

  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const roundedSpm = Math.round((60 / avg) * STROKES_PER_TAP);

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
  currentSpm = roundedSpm;

  spmHistory.push(roundedSpm);
  if (spmHistory.length > STABILITY_SAMPLES) {
    spmHistory.shift();
  }

  // Se calcula el estado de ESTE tap antes de guardarlo, para que el punto
  // en el gráfico quede pintado con el color que tenía en ese momento.
  const stability = computeStability();

  spmSeries.push({ ts: now, spm: roundedSpm, state: stability.state });
  renderChart();
  stopwatchSample(roundedSpm, stability.state);

  status.textContent = stability.text;
  setState(stability.state);
  renderSpmBoats();
}


// =============================
// ESTABILIDAD
// =============================

function computeStability() {
  if (spmHistory.length < 2) {
    return { state: "warning", text: "Midiendo..." };
  }

  const last = spmHistory[spmHistory.length - 1];
  const prev = spmHistory[spmHistory.length - 2];

  if (Math.abs(last - prev) > BREAK_THRESHOLD) {
    return { state: "warning", text: "Inestable" };
  }

  if (spmHistory.length < STABILITY_SAMPLES) {
    return { state: "warning", text: "Ajustando..." };
  }

  const avgSpm = spmHistory.reduce((a, b) => a + b, 0) / spmHistory.length;
  const withinTolerance = spmHistory.every((v) => Math.abs(v - avgSpm) <= SPM_TOLERANCE);
  const range = Math.max(...spmHistory) - Math.min(...spmHistory);

  return withinTolerance && range <= RANGE_THRESHOLD
    ? { state: "active", text: "Estable" }
    : { state: "warning", text: "Inestable" };
}


// =============================
// GRÁFICO SPM / TIEMPO (últimos 60s)
// =============================

function renderChart() {
  const now = Date.now();

  // Los puntos más viejos que la ventana se descartan solos
  spmSeries = spmSeries.filter((p) => now - p.ts <= CHART_WINDOW_MS);

  if (spmSeries.length < 2) {
    chartLine.innerHTML = "";
    chartArea.innerHTML = "";
    chartPoints.innerHTML = "";
    chartYMax.textContent = "";
    chartYMid.textContent = "";
    chartYMin.textContent = "";
    return;
  }

  const { min, max } = computeScale(spmSeries.map((p) => p.spm));

  const coords = spmSeries.map((p) => ({
    x: 300 - ((now - p.ts) / CHART_WINDOW_MS) * 300,
    y: 100 - ((p.spm - min) / (max - min)) * 100,
  }));
  const states = spmSeries.map((p) => p.state || "active");

  const { lineMarkup, areaMarkup, pointsMarkup } = buildChartMarkup(coords, states, 100);
  chartLine.innerHTML = lineMarkup;
  chartArea.innerHTML = areaMarkup;
  chartPoints.innerHTML = pointsMarkup;

  chartYMax.textContent = Math.round(max);
  chartYMid.textContent = Math.round((max + min) / 2);
  chartYMin.textContent = Math.round(min);
}


// =============================
// UI STATE
// =============================

function setState(state) {
  circle.classList.remove("idle", "warning", "active", "alert");
  circle.classList.remove("idle-glow", "warning-glow", "active-glow", "alert-glow");
  display.classList.remove("idle", "warning", "active", "alert");

  circle.classList.add(state, state + "-glow");
  display.classList.add(state);

  // El fondo rojo de alerta se aplica desde el body (ver styles.css)
  document.body.classList.remove("idle", "warning", "active", "alert");
  document.body.classList.add(state);
}

function resetSpm() {
  lastTapTime = null;
  intervals = [];
  spmHistory = [];
  spmSeries = [];
  currentSpm = null;
  measureKey = null;

  display.textContent = "CCR";
  status.textContent = IDLE_TEXT;

  setState("idle");
  renderChart();
  renderSpmBoats();
}


// =============================
// SPM POR BOTE (con una pasada en curso)
// =============================
// Se mide como siempre y después se toca el bote: no hay que elegirlo
// antes. Si no se toca ninguno, la medición no se anota a nadie.

export function renderSpmBoats() {
  const boats = runningBoats();
  spmBoats.hidden = boats.length === 0;
  if (!boats.length) return;

  const label = currentSpm === null
    ? "Pasada en curso · medí un bote y tocalo para anotarle el SPM"
    : `Anotar <strong>${currentSpm} spm</strong> a:`;

  spmBoats.innerHTML = `
    <div class="spm-boats-label">${label}</div>
    <div class="spm-boats-row">
      ${boats.map((b) => {
        const readings = b.spm || [];
        const mine = readings.some((r) => r.key === measureKey);
        const last = readings[readings.length - 1];
        return `
          <button type="button" class="spm-boat" data-boat="${b.id}" style="--boat:${b.color}"
            aria-pressed="${mine}" ${currentSpm === null ? "disabled" : ""}>
            <span class="spm-boat-name">${escapeHtml(b.name)}</span>
            <span class="spm-boat-value">${last ? `${last.spm} spm` : "–"}</span>
          </button>`;
      }).join("")}
    </div>`;
}

function assignSpm(boatId) {
  if (currentSpm === null || !measureKey) return;
  const boat = runningBoats().find((b) => b.id === boatId);
  if (!boat) return;
  recordBoatSpm(boatId, currentSpm, measureKey);
  vibrate(VIBRATE_SW_LAP);
  toast(`${currentSpm} spm → ${boat.name}`);
  renderSpmBoats();
}


// =============================
// CRONÓMETRO
// =============================
// Se calcula siempre como acumulado + (ahora - inicio) con Date.now(), no
// con un contador de ticks: así no se desfasa si el navegador frena los
// timers, y el estado se puede guardar y recuperar tras recargar la app.
//
// Botones al estilo del cronómetro del iPhone:
//   detenido → [ VUELTA (apagado) ] [ INICIAR ]
//   corriendo → [ VUELTA ]          [ PAUSAR ]
//   pausado   → [ TERMINAR ]        [ CONTINUAR ]
// TERMINAR pide un segundo toque y guarda el entreno en el Historial.

function freshStopwatch() {
  return {
    running: false,
    startedAt: 0,
    elapsedBefore: 0,
    sessionStartedAt: 0, // fecha real en que arrancó el entreno
    laps: [],            // { total, split, avgSpm }  (avgSpm null si no hubo remadas)
    lapStartMs: 0,       // acumulado en el que arrancó la vuelta actual
    lapSpmSum: 0,
    lapSpmCount: 0,
    samples: [],         // { t (s), spm, state } — para el gráfico del Historial
  };
}

let sw = freshStopwatch();
let swFrame = null;
let endConfirmTimer = null;

function swElapsed() {
  return sw.elapsedBefore + (sw.running ? Date.now() - sw.startedAt : 0);
}

function swStarted() {
  return sw.running || sw.elapsedBefore > 0;
}

function saveStopwatch() {
  store.set(STOPWATCH_KEY, sw);
}

function loadStopwatch() {
  const data = store.get(STOPWATCH_KEY, null);
  if (data && typeof data.elapsedBefore === "number" && Array.isArray(data.laps)) {
    sw = { ...freshStopwatch(), ...data };
  }
}

function renderStopwatch() {
  swTime.textContent = formatClock(swElapsed());

  const started = swStarted();
  swRight.textContent = sw.running ? "PAUSAR" : started ? "CONTINUAR" : "INICIAR";
  swRight.classList.toggle("sw-pause", sw.running);

  const canEnd = started && !sw.running;
  swLeft.textContent = canEnd ? (endConfirmTimer ? "¿TERMINAR?" : "TERMINAR") : "VUELTA";
  swLeft.classList.toggle("sw-end", canEnd);
  swLeft.classList.toggle("sw-confirm", canEnd && endConfirmTimer !== null);
  swLeft.disabled = !sw.running && !canEnd;

  const lap = sw.laps[sw.laps.length - 1];
  if (lap) {
    const avg = lap.avgSpm === null ? "–" : lap.avgSpm;
    swLastLap.innerHTML =
      `<span class="lap-label">Vuelta ${sw.laps.length}</span>` +
      `<span class="lap-split">${formatClock(lap.split)}</span>` +
      `<span class="lap-spm">${avg} <small>spm</small></span>`;
  } else {
    swLastLap.innerHTML = `<span class="lap-hint">${
      sw.running ? "VUELTA marca un parcial con su promedio de remadas"
        : started ? "TERMINAR guarda el entreno en Historial"
          : "El entreno se guarda solo mientras corre el cronómetro"
    }</span>`;
  }
}

function tickStopwatch() {
  swTime.textContent = formatClock(swElapsed());
  swFrame = sw.running ? requestAnimationFrame(tickStopwatch) : null;
}

function startTicking() {
  if (swFrame === null) swFrame = requestAnimationFrame(tickStopwatch);
}

function cancelEndConfirm() {
  clearTimeout(endConfirmTimer);
  endConfirmTimer = null;
}

function toggleStopwatch() {
  cancelEndConfirm();
  if (sw.running) {
    sw.elapsedBefore = swElapsed();
    sw.running = false;
    vibrate(VIBRATE_SW_PAUSE);
  } else {
    if (!swStarted()) sw.sessionStartedAt = Date.now();
    sw.startedAt = Date.now();
    sw.running = true;
    vibrate(VIBRATE_SW_START);
    startTicking();
  }
  saveStopwatch();
  renderStopwatch();
}

function pushLap(total) {
  sw.laps.push({
    total,
    split: total - sw.lapStartMs,
    avgSpm: sw.lapSpmCount ? Math.round(sw.lapSpmSum / sw.lapSpmCount) : null,
  });
  sw.lapStartMs = total;
  sw.lapSpmSum = 0;
  sw.lapSpmCount = 0;
}

function lapStopwatch() {
  if (!sw.running) return;
  pushLap(swElapsed());
  vibrate(VIBRATE_SW_LAP);
  saveStopwatch();
  renderStopwatch();
}

// Terminar pide un segundo toque: con salpicaduras o guantes, un toque
// accidental no debe cortar el entreno.
function endStopwatch() {
  if (endConfirmTimer === null) {
    endConfirmTimer = setTimeout(() => {
      endConfirmTimer = null;
      renderStopwatch();
    }, END_CONFIRM_MS);
    vibrate(VIBRATE_SW_LAP);
    renderStopwatch();
    return;
  }
  cancelEndConfirm();

  const total = swElapsed();
  // El tramo después de la última vuelta también es un parcial
  if (sw.laps.length && total - sw.lapStartMs >= 1000) pushLap(total);

  if (total >= MIN_SESSION_MS) {
    history.upsert({
      id: uid(),
      type: "entreno",
      date: sw.sessionStartedAt || Date.now() - total,
      durationMs: total,
      laps: sw.laps,
      samples: sw.samples,
    });
    toast("Entreno guardado en Historial");
  }

  sw = freshStopwatch();
  vibrate(VIBRATE_RESET_PATTERN);
  saveStopwatch();
  renderStopwatch();
}

// Cada lectura válida de SPM mientras corre el cronómetro
function stopwatchSample(spm, state) {
  if (!sw.running) return;
  sw.lapSpmSum += spm;
  sw.lapSpmCount++;
  sw.samples.push({ t: swElapsed() / 1000, spm, state });
  saveStopwatch();
}


// =============================
// INICIO
// =============================

export function initEntreno() {
  buildSphere();
  status.textContent = IDLE_TEXT;

  view.addEventListener("click", handleTap);

  // Tocar la tarjeta de botes no cuenta como remada
  spmBoats.addEventListener("click", (e) => {
    e.stopPropagation();
    const btn = e.target.closest("[data-boat]");
    if (btn && !btn.disabled) assignSpm(btn.dataset.boat);
  });

  // Los botones del cronómetro no cuentan como remada
  swRight.addEventListener("click", (e) => { e.stopPropagation(); toggleStopwatch(); });
  swLeft.addEventListener("click", (e) => {
    e.stopPropagation();
    if (sw.running) lapStopwatch();
    else endStopwatch();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    swTime.textContent = formatClock(swElapsed());
    if (sw.running) startTicking();
  });

  // Auto reset del SPM + deslizar el gráfico hacia "ahora"
  setInterval(() => {
    if (lastTapTime && Date.now() - lastTapTime > AUTO_RESET_TIME) {
      resetSpm();
      return;
    }
    renderChart();
  }, 1000);

  loadStopwatch();
  renderStopwatch();
  if (sw.running) startTicking();
}
