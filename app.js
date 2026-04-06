// =============================
// ELEMENTOS DEL DOM
// =============================

const display = document.getElementById("spm-display");
const status = document.getElementById("status");
const circle = document.getElementById("circle");
const ripple = document.querySelector(".ripple");
const vibrationBtn = document.getElementById("vibration-toggle");


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
// VIBRACIÓN
// =============================

let vibrationEnabled = localStorage.getItem("vibration") !== "off";
updateVibrationUI();

function updateVibrationUI() {
  if (!vibrationBtn) return;

  vibrationBtn.textContent = vibrationEnabled ? "VIB ON" : "VIB OFF";
  vibrationBtn.classList.toggle("off", !vibrationEnabled);
}

if (vibrationBtn) {
  vibrationBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    vibrationEnabled = !vibrationEnabled;
    localStorage.setItem("vibration", vibrationEnabled ? "on" : "off");

    updateVibrationUI();
  });
}


// =============================
// EVENTO PRINCIPAL
// =============================

document.body.addEventListener("click", handleTap);


// =============================
// LÓGICA DE TAP
// =============================

function handleTap() {
  const now = Date.now();

  // Ripple
  ripple.classList.remove("active");
  void ripple.offsetWidth;
  ripple.classList.add("active");

  // Vibración
  if (vibrationEnabled && navigator.vibrate) {
    navigator.vibrate(20);
  }

  // Double tap → reset
  if (now - lastTapTimestamp < DOUBLE_TAP_THRESHOLD) {
    reset();
    return;
  }
  lastTapTimestamp = now;

  if (!lastTapTime) {
    lastTapTime = now;
    status.textContent = "Midiendo...";
    setColor("yellow");
    return;
  }

  const delta = (now - lastTapTime) / 1000;
  lastTapTime = now;

  if (delta < 0.3) return;
  if (delta > 15) {
    reset();
    return;
  }

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
    setColor("yellow");
    return;
  }

  const last = spmHistory[spmHistory.length - 1];
  const prev = spmHistory[spmHistory.length - 2];

  if (Math.abs(last - prev) > BREAK_THRESHOLD) {
    status.textContent = "Inestable";
    setColor("yellow");
    return;
  }

  if (spmHistory.length < STABILITY_SAMPLES) {
    status.textContent = "Ajustando...";
    setColor("yellow");
    return;
  }

  const avgSpm = spmHistory.reduce((a, b) => a + b, 0) / spmHistory.length;

  const withinTolerance = spmHistory.every(
    (v) => Math.abs(v - avgSpm) <= SPM_TOLERANCE
  );

  const max = Math.max(...spmHistory);
  const min = Math.min(...spmHistory);
  const range = max - min;

  const isStable = withinTolerance && range <= RANGE_THRESHOLD;

  if (isStable) {
    status.textContent = "Estable";
    setColor("green");
  } else {
    status.textContent = "Inestable";
    setColor("yellow");
  }
}


// =============================
// UI
// =============================

function setColor(color) {
  display.classList.remove("red", "yellow", "green");
  display.classList.add(color);

  circle.classList.remove("red-glow", "yellow-glow", "green-glow");
  circle.classList.add(color + "-glow");

  circle.classList.remove("red", "yellow", "green");
  circle.classList.add(color);
}


// =============================
// RESET
// =============================

function reset() {
  lastTapTime = null;
  intervals = [];
  spmHistory = [];

  display.textContent = "--";
  status.textContent = "Esperando medida";
  setColor("red");
}


// =============================
// AUTO RESET
// =============================

setInterval(() => {
  if (lastTapTime && Date.now() - lastTapTime > AUTO_RESET_TIME) {
    reset();
  }
}, 1000);