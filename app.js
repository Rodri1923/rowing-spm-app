// =============================
// ELEMENTOS DEL DOM
// =============================

const display = document.getElementById("spm-display");
const status = document.getElementById("status");
const circle = document.getElementById("circle");
const ripples = document.querySelectorAll(".ripple");


// =============================
// ESTADO INTERNO
// =============================

let lastTapTime = null;
let intervals = [];
let spmHistory = [];
let lastTapTimestamp = 0;


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
// EVENTO PRINCIPAL
// =============================

document.body.addEventListener("click", handleTap);


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

  display.textContent = roundedSpm;

  spmHistory.push(roundedSpm);
  if (spmHistory.length > STABILITY_SAMPLES) {
    spmHistory.shift();
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
// UI STATE
// =============================

function setState(state) {
  // RESET
  circle.classList.remove("idle", "warning", "active");
  display.classList.remove("idle", "warning", "active");

  circle.classList.remove("idle-glow", "warning-glow", "active-glow");

  // APPLY
  circle.classList.add(state);
  circle.classList.add(state + "-glow");

  display.classList.add(state);

  // IMPORTANTE: sincronizar ripple state base
  document.body.classList.remove("idle", "warning", "active");
  document.body.classList.add(state);
}


// =============================
// RESET
// =============================

function reset() {
  lastTapTime = null;
  intervals = [];
  spmHistory = [];

  display.textContent = "CCR";
  status.textContent = "Esperando medida";

  setState("idle");
}


// =============================
// AUTO RESET
// =============================

setInterval(() => {
  if (lastTapTime && Date.now() - lastTapTime > AUTO_RESET_TIME) {
    reset();
  }
}, 1000);