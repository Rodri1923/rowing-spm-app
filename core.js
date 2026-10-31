// =============================
// UTILIDADES COMPARTIDAS
// =============================
// Todo lo que usan varias pestañas: DOM, guardado local, formatos de
// tiempo, hojas (sheets) estilo iOS, avisos, sonido, vibración, wake lock,
// historial y el dibujo de gráficos SPM.

export const $ = (id) => document.getElementById(id);

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}


// =============================
// GUARDADO LOCAL
// =============================
// Todo vive en este celular (sin backend): funciona igual en el agua sin
// señal. Cada acceso va con try/catch porque localStorage puede fallar
// (modo privado, almacenamiento lleno).

export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn("No se pudo guardar", key, err);
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      // nada que hacer
    }
  },
};


// =============================
// HISTORIAL (entrenos y pasadas)
// =============================

const HISTORY_KEY = "ccr_history";
const HISTORY_MAX = 60;

export const history = {
  list() {
    const items = store.get(HISTORY_KEY, []);
    return Array.isArray(items) ? items : [];
  },
  // Agrega o reemplaza (mismo id) y deja lo más nuevo primero
  upsert(entry) {
    const items = this.list().filter((e) => e.id !== entry.id);
    items.unshift(entry);
    items.sort((a, b) => b.date - a.date);
    const kept = items.slice(0, HISTORY_MAX);
    // Si el almacenamiento del navegador (~5 MB) se llena, se descartan
    // los registros más viejos hasta que entre lo nuevo.
    while (!store.set(HISTORY_KEY, kept) && kept.length > 1) {
      kept.pop();
    }
  },
  remove(id) {
    store.set(HISTORY_KEY, this.list().filter((e) => e.id !== id));
  },
};


// =============================
// FORMATOS DE TIEMPO
// =============================

// 75400 → "01:15.4" · con horas → "1:02:03.4"
export function formatClock(ms) {
  const totalTenths = Math.floor(Math.max(0, ms) / 100);
  const tenths = totalTenths % 10;
  const totalSec = Math.floor(totalTenths / 10);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}.${tenths}` : `${mm}:${ss}.${tenths}`;
}

// Segundos → "m:ss". Se redondea una sola vez antes de separar
// minutos/segundos — si no, 119.6s podía mostrar "1:60" en vez de "2:00".
export function formatDuration(totalSeconds) {
  const rounded = Math.round(totalSeconds);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Ventaja de salida: 5 → "+0:05"
export function formatOffset(sec) {
  return `+${formatDuration(sec)}`;
}

// Diferencia de llegada: 800 → "+0.8 s" · 0 → "—"
export function formatGap(ms) {
  if (ms <= 0) return "—";
  return ms < 60000 ? `+${(ms / 1000).toFixed(1)} s` : `+${formatClock(ms)}`;
}


// =============================
// VIBRACIÓN
// =============================
// El entrenador mira el bote, no el teléfono: la vibración confirma
// la acción sin mirar la pantalla. iOS Safari no implementa
// navigator.vibrate — en iPhone todo funciona igual, sin este feedback.

export function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}


// =============================
// SONIDO (pitidos de largada)
// =============================
// Web Audio genera el tono en el momento: no hay archivos de audio que
// descargar, así que funciona offline. iOS exige que el contexto se cree
// tras un toque del usuario (unlockAudio se llama al tocar LARGAR).
// Ojo: en iPhone con el interruptor de silencio activado no suena.

let audioCtx = null;

export function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

export function beep(freq = 880, durMs = 120) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + durMs / 1000 + 0.02);
}


// =============================
// WAKE LOCK (evita que se apague la pantalla)
// =============================

let wakeLockSentinel = null;

export async function requestWakeLock() {
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


// =============================
// HOJAS (bottom sheets estilo iOS)
// =============================
// Una sola hoja a la vez. Cada apertura crea un contenedor nuevo, así los
// listeners que agrega quien la abre no se acumulan entre aperturas.

const sheetLayer = $("sheet-layer");
const sheetTitle = $("sheet-title");
const sheetBody = $("sheet-body");
const sheetBack = $("sheet-back");
const sheetDone = $("sheet-done");

let sheetOnClose = null;
let sheetCloseTimer = null;

export function openSheet({ title, content, onClose = null, onBack = null, doneLabel = "Listo" }) {
  const prev = sheetOnClose;
  sheetOnClose = null;
  if (prev) prev();
  clearTimeout(sheetCloseTimer);

  sheetTitle.textContent = title;
  sheetBack.hidden = !onBack;
  sheetBack.onclick = onBack;
  sheetDone.textContent = doneLabel;

  const box = document.createElement("div");
  if (typeof content === "string") box.innerHTML = content;
  else box.append(content);
  sheetBody.replaceChildren(box);
  sheetBody.scrollTop = 0;

  sheetOnClose = onClose;
  sheetLayer.hidden = false;
  requestAnimationFrame(() => sheetLayer.classList.add("open"));
  return box;
}

export function closeSheet() {
  if (sheetLayer.hidden) return;
  sheetLayer.classList.remove("open");
  sheetCloseTimer = setTimeout(() => {
    sheetLayer.hidden = true;
    sheetBody.replaceChildren();
  }, 280);
  const cb = sheetOnClose;
  sheetOnClose = null;
  if (cb) cb();
}

export function confirmSheet({ title, message, confirmLabel, destructive = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const box = openSheet({
      title,
      doneLabel: "Cancelar",
      content: `
        <p class="sheet-message">${escapeHtml(message)}</p>
        <button type="button" class="btn ${destructive ? "btn-danger" : "btn-primary"}" data-confirm>${escapeHtml(confirmLabel)}</button>
        <button type="button" class="btn btn-secondary" data-cancel>Cancelar</button>`,
      onClose: () => {
        if (!answered) resolve(false);
      },
    });
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-confirm]")) {
        answered = true;
        resolve(true);
        closeSheet();
      } else if (e.target.closest("[data-cancel]")) {
        closeSheet();
      }
    });
  });
}

sheetDone.addEventListener("click", closeSheet);
$("sheet-backdrop").addEventListener("click", closeSheet);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSheet();
});


// =============================
// AVISOS (toast)
// =============================

const toastEl = $("toast");
let toastTimer = null;

export function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}


// =============================
// GRÁFICOS SPM
// =============================

// Rango real de remo: un remero suele ir entre 14 y 65 SPM, rara vez pasa
// de 36. Se usa solo para que el gráfico no exagere ruido chico ni se
// desarme ante un mistap — no define ninguna zona "buena/mala".
const RATE_MIN_BOUND = 10;
const RATE_MAX_BOUND = 70;
const RATE_MIN_SPREAD = 6;

export function computeScale(values) {
  let min = Math.max(Math.min(...values), RATE_MIN_BOUND);
  let max = Math.min(Math.max(...values), RATE_MAX_BOUND);

  if (max - min < RATE_MIN_SPREAD) {
    const mid = (max + min) / 2;
    min = mid - RATE_MIN_SPREAD / 2;
    max = mid + RATE_MIN_SPREAD / 2;
  }

  return { min, max };
}

// Arma segmentos de línea + área coloreados según el estado que tenía CADA
// tap en el momento en que se registró (no el estado actual global) — así
// un tramo estable queda verde y solo los taps inestables quedan en
// amarillo, aunque el ritmo se haya "puesto amarillo" después.
export function buildChartMarkup(coords, states, baselineY) {
  let lineMarkup = "";
  let areaMarkup = "";

  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const segClass = `seg-${states[i - 1]}`; // color del tramo = estado del punto a su izquierda

    lineMarkup += `<line class="chart-seg-line ${segClass}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"></line>`;
    areaMarkup += `<polygon class="chart-seg-area ${segClass}" points="${a.x.toFixed(1)},${baselineY} ${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.x.toFixed(1)},${baselineY}"></polygon>`;
  }

  const pointsMarkup = coords
    .map((c, i) => `<circle class="chart-pt seg-${states[i]}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="2.4"></circle>`)
    .join("");

  return { lineMarkup, areaMarkup, pointsMarkup };
}

// Gráfico completo de un entreno guardado: points = [{ t (s), spm, state }]
export function renderSeriesSvg(svg, points, durationSec) {
  const values = points.map((p) => p.spm);
  const { min, max } = computeScale(values);

  const padLeft = 34;
  const padRight = 10;
  const padTop = 26;
  const padBottom = 34;
  const width = 400;
  const height = 220;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const duration = durationSec || 1;

  const coords = points.map((p) => ({
    x: padLeft + (p.t / duration) * plotW,
    y: padTop + (1 - (p.spm - min) / (max - min)) * plotH,
    spm: p.spm,
  }));
  const states = points.map((p) => p.state || "active");

  const { lineMarkup, areaMarkup } = buildChartMarkup(coords, states, padTop + plotH);

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

  const pointsMarkup = coords
    .map((c, i) => `<circle class="chart-pt seg-${states[i]}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="2.6"></circle>`)
    .join("");

  svg.innerHTML = `
    <line class="session-gridline" x1="${padLeft}" y1="${padTop + plotH / 2}" x2="${width - padRight}" y2="${padTop + plotH / 2}"></line>
    <text class="session-axis" x="${padLeft - 6}" y="${padTop + 4}" text-anchor="end">${Math.round(max)}</text>
    <text class="session-axis" x="${padLeft - 6}" y="${padTop + plotH}" text-anchor="end">${Math.round(min)}</text>
    <text class="session-axis" x="${padLeft}" y="${height - 8}" text-anchor="start">0:00</text>
    <text class="session-axis" x="${width - padRight}" y="${height - 8}" text-anchor="end">${formatDuration(duration)}</text>
    ${areaMarkup}
    ${lineMarkup}
    ${pointsMarkup}
    ${labelsMarkup}
  `;
}

export function averageSpm(points) {
  if (!points.length) return null;
  return Math.round(points.reduce((a, p) => a + p.spm, 0) / points.length);
}
