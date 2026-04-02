const display = document.getElementById("spm-display");
const status = document.getElementById("status");
const circle = document.getElementById("circle");

let lastTapTime = null;
let intervals = [];
let lastTapTimestamp = 0;

// Config
const STROKES_PER_TAP = 1;
const MAX_SAMPLES = 3;
const DOUBLE_TAP_THRESHOLD = 300;
const AUTO_RESET_TIME = 30000;

document.body.addEventListener("click", handleTap);

function handleTap() {
  const now = Date.now();

  // Vibración
  if (navigator.vibrate) {
    navigator.vibrate(30);
  }

  // Double tap → reset
  if (now - lastTapTimestamp < DOUBLE_TAP_THRESHOLD) {
    reset();
    return;
  }
  lastTapTimestamp = now;

  // Primer tap
  if (!lastTapTime) {
    lastTapTime = now;
    status.textContent = "Midiendo...";
    setColor("yellow");
    return;
  }

  const delta = (now - lastTapTime) / 1000;
  lastTapTime = now;

  // Filtros
  if (delta < 0.3) return;
  if (delta > 15) {
    reset();
    return;
  }

  intervals.push(delta);
  if (intervals.length > MAX_SAMPLES) {
    intervals.shift();
  }

  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const spm = (60 / avg) * STROKES_PER_TAP;

  // 🔥 CAMBIO: redondeo
  display.textContent = Math.round(spm);

  updateState();
}

function updateState() {
  if (intervals.length < 2) {
    status.textContent = "Midiendo...";
    setColor("yellow");
  } else if (intervals.length < 3) {
    status.textContent = "Ajustando...";
    setColor("yellow");
  } else {
    status.textContent = "Estable";
    setColor("green");
  }
}

function setColor(color) {
  display.classList.remove("red", "yellow", "green");
  display.classList.add(color);

  circle.classList.remove("red-glow", "yellow-glow", "green-glow");
  circle.classList.add(color + "-glow");
}

function reset() {
  lastTapTime = null;
  intervals = [];
  display.textContent = "--";
  status.textContent = "Toca para empezar";
  setColor("red");
}

// Auto reset
setInterval(() => {
  if (lastTapTime && Date.now() - lastTapTime > AUTO_RESET_TIME) {
    reset();
  }
}, 1000);