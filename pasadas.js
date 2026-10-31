// =============================
// PESTAÑA PASADAS
// =============================
// Pasadas con varios botes y salida escalonada por handicap:
//   1. Armar: distancia + botes, cada uno con su ventaja de salida
//      (sugerida por categoría o puesta a mano).
//   2. Largada: cuenta regresiva con pitido, vibración y destello de color
//      para cada salida. Un único botón LLEGADA marca cada proa que cruza
//      — los botes pueden llegar a menos de 1 s, así que primero se marca
//      y después, tranquilo, se asigna qué bote era cada llegada.
//   3. Resultados: tiempo de cada bote desde su propia salida, y la opción
//      de repetir con el handicap ajustado según lo que pasó.
// En esta pestaña los toques NO cuentan como remadas.

import {
  $, vibrate, store, history, uid, escapeHtml, toast,
  formatClock, formatOffset, formatGap, formatDuration,
  openSheet, closeSheet, confirmSheet, beep, unlockAudio, requestWakeLock,
} from "./core.js";
import { BOAT_CLASSES, loadHandicap, suggestOffsets } from "./handicap.js";

const root = $("pasadas-root");
const flash = $("start-flash");

const PASADA_KEY = "ccr_pasada";
const DISTANCES = [250, 500, 1000, 2000];
const PRE_START_MS = 5000;        // cuenta regresiva antes de la primera salida
const ARRIVAL_DEBOUNCE_MS = 120;  // evita un doble registro por un mismo toque
const JUST_STARTED_MS = 1500;     // cuánto se muestra "¡SALE!" tras una salida

// Colores bien distintos entre sí, para reconocer cada bote de un vistazo
const BOAT_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ea580c", "#9333ea", "#0891b2",
  "#db2777", "#ca8a04", "#475569", "#0d9488", "#7c2d12", "#65a30d",
];

const VIBRATE_ARRIVAL = 40;
const VIBRATE_COUNT = 60;
const VIBRATE_GO = 400;


// =============================
// ESTADO
// =============================
// boat:    { id, name, boatClass, category, offset (s), auto, color, prevOffset? }
// arrival: { id, ms (desde la primera salida), boatId | null }

function freshPasada() {
  return {
    phase: "setup",       // setup | running | results
    distance: 1000,
    boats: [],
    startedAt: null,      // Date.now() de la primera salida (t = 0)
    arrivals: [],
    historyId: null,
  };
}

let p = loadPasada();
let frame = null;
let lastT = null;
let starts = [];   // [{ ms, boats }] ordenadas
let events = [];   // [{ ms, long, start }] pitidos de cuenta regresiva

function loadPasada() {
  const data = store.get(PASADA_KEY, null);
  return data && Array.isArray(data.boats) ? { ...freshPasada(), ...data } : freshPasada();
}

function save() {
  store.set(PASADA_KEY, p);
}

function boatById(id) {
  return p.boats.find((b) => b.id === id);
}

function resetRun() {
  p.phase = "setup";
  p.startedAt = null;
  p.arrivals = [];
  p.historyId = null;
}

function recomputeAuto() {
  const suggested = suggestOffsets(p.boats, p.distance);
  p.boats.forEach((b) => {
    if (b.auto) b.offset = suggested[b.id];
  });
}

function nextColor() {
  const used = new Set(p.boats.map((b) => b.color));
  return BOAT_COLORS.find((c) => !used.has(c)) || BOAT_COLORS[p.boats.length % BOAT_COLORS.length];
}

function boatDot(b) {
  return `<span class="boat-dot" style="--boat:${b.color}"></span>`;
}


// =============================
// 1. ARMAR LA PASADA
// =============================

function renderSetup() {
  const isCustom = !DISTANCES.includes(p.distance);

  const rows = p.boats.map((b) => {
    const note = b.prevOffset != null
      ? `antes ${formatOffset(b.prevOffset)}`
      : b.auto ? "sugerido" : "a mano";
    return `
      <div class="boat-row">
        <button type="button" class="boat-main" data-action="edit" data-id="${b.id}">
          ${boatDot(b)}
          <span class="boat-text">
            <span class="boat-name">${escapeHtml(b.name)}</span>
            <span class="boat-sub">${b.boatClass} · ${escapeHtml(b.category)}</span>
          </span>
        </button>
        <div class="stepper">
          <button type="button" data-action="minus" data-id="${b.id}" aria-label="Un segundo menos de ventaja">−</button>
          <span class="stepper-value">${formatOffset(b.offset)}<small>${note}</small></span>
          <button type="button" data-action="plus" data-id="${b.id}" aria-label="Un segundo más de ventaja">+</button>
        </div>
      </div>`;
  }).join("");

  root.innerHTML = `
    <h1 class="large-title">Pasadas</h1>

    <div class="group-label">Distancia (metros)</div>
    <div class="segmented">
      ${DISTANCES.map((d) => `<button type="button" data-action="distance" data-value="${d}" aria-pressed="${p.distance === d}">${d}</button>`).join("")}
      <button type="button" data-action="distance-custom" aria-pressed="${isCustom}">${isCustom ? p.distance : "Otra"}</button>
    </div>

    <div class="group-row">
      <span class="group-label">Botes y ventaja de salida</span>
      ${p.boats.length > 1 ? `<button type="button" class="link-btn" data-action="suggest">Sugerir</button>` : ""}
    </div>
    <div class="list">
      ${rows || `<div class="empty-row">Agregá los botes que salen en la pasada</div>`}
    </div>
    <button type="button" class="btn btn-secondary" data-action="add">+ Agregar bote</button>

    <p class="footnote">Sale primero el bote más lento (+0:00). Cada bote sale con la ventaja que tiene al lado. Tocá un bote para cambiar su nombre, tipo o categoría.</p>

    <button type="button" class="btn btn-go" data-action="start" ${p.boats.length ? "" : "disabled"}>LARGAR</button>`;
}

function addBoat() {
  const last = p.boats[p.boats.length - 1];
  const boat = {
    id: uid(),
    name: `Bote ${p.boats.length + 1}`,
    boatClass: last ? last.boatClass : "1x",
    category: last ? last.category : "Senior",
    offset: 0,
    auto: true,
    color: nextColor(),
  };
  p.boats.push(boat);
  recomputeAuto();
  save();
  renderPasadas();
  openBoatEditor(boat.id);
}

function openBoatEditor(id) {
  const b = boatById(id);
  if (!b) return;
  const cfg = loadHandicap();
  const categories = cfg.categories.some((c) => c.name === b.category)
    ? cfg.categories
    : [{ name: b.category }, ...cfg.categories];

  const box = openSheet({
    title: "Bote",
    content: `
      <label class="field">
        <span class="field-label">Nombre</span>
        <input type="text" data-name value="${escapeHtml(b.name)}" maxlength="30" autocomplete="off" placeholder="Ej: 4x de Ana">
      </label>
      <div class="group-label">Tipo de bote</div>
      <div class="segmented seg-wrap">
        ${BOAT_CLASSES.map((c) => `<button type="button" data-class="${c}" aria-pressed="${b.boatClass === c}">${c}</button>`).join("")}
      </div>
      <div class="group-label">Categoría</div>
      <div class="chips">
        ${categories.map((c) => `<button type="button" class="chip" data-cat="${escapeHtml(c.name)}" aria-pressed="${b.category === c.name}">${escapeHtml(c.name)}</button>`).join("")}
      </div>
      <button type="button" class="btn btn-danger-text" data-delete>Eliminar bote</button>`,
    onClose: () => {
      if (boatById(id) && !b.name.trim()) b.name = `Bote ${p.boats.indexOf(b) + 1}`;
      recomputeAuto();
      save();
      renderPasadas();
    },
  });

  box.querySelector("[data-name]").addEventListener("input", (e) => {
    b.name = e.target.value;
  });

  box.addEventListener("click", (e) => {
    const classBtn = e.target.closest("[data-class]");
    const catBtn = e.target.closest("[data-cat]");
    if (classBtn) {
      b.boatClass = classBtn.dataset.class;
      box.querySelectorAll("[data-class]").forEach((x) => x.setAttribute("aria-pressed", String(x === classBtn)));
    } else if (catBtn) {
      b.category = catBtn.dataset.cat;
      box.querySelectorAll("[data-cat]").forEach((x) => x.setAttribute("aria-pressed", String(x === catBtn)));
    } else if (e.target.closest("[data-delete]")) {
      p.boats = p.boats.filter((x) => x.id !== id);
      closeSheet();
    }
  });
}

function openCustomDistance() {
  const box = openSheet({
    title: "Distancia",
    content: `
      <label class="field">
        <span class="field-label">Metros</span>
        <input type="number" inputmode="numeric" min="50" max="10000" step="50" data-distance value="${p.distance}">
      </label>
      <button type="button" class="btn btn-primary" data-ok>Usar esta distancia</button>`,
  });
  const input = box.querySelector("[data-distance]");
  box.querySelector("[data-ok]").addEventListener("click", () => {
    const value = Math.round(Number(input.value));
    if (value >= 50 && value <= 10000) {
      p.distance = value;
      recomputeAuto();
      save();
      renderPasadas();
      closeSheet();
    } else {
      toast("Poné una distancia entre 50 y 10000 m");
    }
  });
}

function suggestAll() {
  p.boats.forEach((b) => {
    b.auto = true;
    delete b.prevOffset;
  });
  recomputeAuto();
  save();
  renderPasadas();
  toast("Ventajas sugeridas según tipo de bote y categoría");
}

function changeOffset(id, delta) {
  const b = boatById(id);
  if (!b) return;
  b.offset = Math.max(0, b.offset + delta);
  b.auto = false;
  save();
  renderPasadas();
}


// =============================
// 2. LARGADA Y LLEGADAS
// =============================

function startPasada() {
  unlockAudio();
  requestWakeLock();
  p.boats.forEach((b) => delete b.prevOffset);
  p.phase = "running";
  p.startedAt = Date.now() + PRE_START_MS;
  p.arrivals = [];
  p.historyId = null;
  vibrate(30);
  save();
  renderPasadas();
}

function buildSchedule() {
  const byOffset = new Map();
  [...p.boats].sort((a, b) => a.offset - b.offset).forEach((b) => {
    if (!byOffset.has(b.offset)) byOffset.set(b.offset, []);
    byOffset.get(b.offset).push(b);
  });
  starts = [...byOffset].map(([offset, boats]) => ({ ms: offset * 1000, boats }));

  events = [];
  starts.forEach((start) => {
    for (const s of [3, 2, 1]) events.push({ ms: start.ms - s * 1000, long: false, start });
    events.push({ ms: start.ms, long: true, start });
  });
}

function fireEvent(ev) {
  if (ev.long) {
    beep(1320, 450);
    vibrate(VIBRATE_GO);
    flash.style.setProperty("--flash", ev.start.boats[0].color);
    flash.classList.remove("on");
    void flash.offsetWidth;
    flash.classList.add("on");
  } else {
    beep(880, 110);
    vibrate(VIBRATE_COUNT);
  }
}

function ensureTick() {
  if (frame !== null) return;
  buildSchedule();
  lastT = null;
  frame = requestAnimationFrame(tick);
}

function tick() {
  frame = null;
  if (p.phase !== "running") return;

  const t = Date.now() - p.startedAt;
  // Si la app estuvo en segundo plano no se disparan de golpe todos los
  // pitidos atrasados: solo los que caen en este último instante.
  if (lastT !== null && t - lastT < 1000) {
    for (const ev of events) {
      if (ev.ms > lastT && ev.ms <= t) fireEvent(ev);
    }
  }
  lastT = t;

  updateRunDisplay(t);
  frame = requestAnimationFrame(tick);
}

function startNames(start) {
  return start.boats
    .map((b) => `<span class="boat-chip" style="--boat:${b.color}">${escapeHtml(b.name)}</span>`)
    .join("");
}

function updateRunDisplay(t) {
  const clock = $("run-clock");
  if (!clock) return;
  clock.textContent = formatClock(t);
  clock.classList.toggle("pre", t < 0);
  $("arrival-btn").classList.toggle("waiting", t < 0);

  const next = $("run-next");
  const just = [...starts].reverse().find((s) => t >= s.ms && t - s.ms < JUST_STARTED_MS);
  const upcoming = starts.find((s) => s.ms > t);

  let key;
  let html;
  let color = "";
  if (just) {
    key = `go-${just.ms}`;
    color = just.boats[0].color;
    html = `<span class="next-label">¡Sale!</span><span class="next-names">${startNames(just)}</span>`;
  } else if (upcoming) {
    const secs = Math.ceil((upcoming.ms - t) / 1000);
    key = `up-${upcoming.ms}-${secs}`;
    color = upcoming.boats[0].color;
    html = `<span class="next-label">Sale en</span>` +
      `<span class="next-count">${secs >= 60 ? formatDuration(secs) : secs}</span>` +
      `<span class="next-names">${startNames(upcoming)}</span>`;
  } else {
    key = "done";
    html = `<span class="next-done">Largaron todos · ${p.boats.length} ${p.boats.length === 1 ? "bote" : "botes"}</span>`;
  }

  if (next.dataset.key !== key) {
    next.dataset.key = key;
    next.innerHTML = html;
    next.style.setProperty("--boat", color);
    next.classList.toggle("go", Boolean(just));
  }
}

function renderRunning() {
  root.innerHTML = `
    <div class="run-top">
      <button type="button" class="link-btn" data-action="cancel">Cancelar</button>
      <span class="run-meta">${p.distance} m · ${p.boats.length} ${p.boats.length === 1 ? "bote" : "botes"}</span>
      <button type="button" class="link-btn strong" data-action="finish">Terminar</button>
    </div>
    <div id="run-clock" class="run-clock">00:00.0</div>
    <div id="run-next" class="run-next"></div>
    <div class="group-row">
      <span class="group-label">Llegadas</span>
      <button type="button" class="link-btn" data-action="undo" id="undo-btn" hidden>Deshacer última</button>
    </div>
    <ol id="arrivals" class="list arrivals"></ol>
    <button type="button" id="arrival-btn" class="arrival-btn">LLEGADA</button>`;
  renderArrivals();
}

function arrivalRow(a, index) {
  const b = a.boatId && boatById(a.boatId);
  return `
    <li>
      <button type="button" class="arrival-row" data-action="assign" data-id="${a.id}">
        <span class="arrival-n">${index + 1}</span>
        <span class="arrival-time">${formatClock(a.ms)}</span>
        ${b ? `<span class="boat-chip" style="--boat:${b.color}">${escapeHtml(b.name)}</span>`
          : `<span class="assign-cta">Asignar bote ›</span>`}
      </button>
    </li>`;
}

function renderArrivals() {
  const list = $("arrivals");
  if (!list) return;
  list.innerHTML = p.arrivals.length
    ? p.arrivals.map(arrivalRow).reverse().join("")
    : `<li class="empty-row">Tocá LLEGADA cada vez que una proa cruza la línea. Después asignás qué bote era.</li>`;
  $("undo-btn").hidden = p.arrivals.length === 0;
}

function registerArrival() {
  if (p.phase !== "running") return;
  const t = Date.now() - p.startedAt;
  if (t < 0) return;
  const last = p.arrivals[p.arrivals.length - 1];
  if (last && t - last.ms < ARRIVAL_DEBOUNCE_MS) return;

  // Con un solo bote no hay nada que asignar
  const boatId = p.boats.length === 1 && !p.arrivals.length ? p.boats[0].id : null;
  p.arrivals.push({ id: uid(), ms: t, boatId });
  vibrate(VIBRATE_ARRIVAL);
  save();
  renderArrivals();
}

function undoArrival() {
  p.arrivals.pop();
  save();
  renderArrivals();
}

function openAssign(arrivalId) {
  const index = p.arrivals.findIndex((a) => a.id === arrivalId);
  const a = p.arrivals[index];
  if (!a) return;

  const takenBy = new Map(
    p.arrivals.filter((x) => x.boatId && x.id !== a.id).map((x) => [x.boatId, p.arrivals.indexOf(x)])
  );
  const free = p.boats.filter((b) => !takenBy.has(b.id));
  const taken = p.boats.filter((b) => takenBy.has(b.id));

  const boatButton = (b, sub) => `
    <button type="button" class="assign-btn" data-boat="${b.id}" style="--boat:${b.color}" aria-pressed="${a.boatId === b.id}">
      <span class="boat-name">${escapeHtml(b.name)}</span>
      <span class="boat-sub">${sub}</span>
    </button>`;

  const box = openSheet({
    title: `Llegada ${index + 1} · ${formatClock(a.ms)}`,
    content: `
      <p class="sheet-message">¿Qué bote cruzó?</p>
      <div class="assign-grid">
        ${free.map((b) => boatButton(b, `${b.boatClass} · ${escapeHtml(b.category)}`)).join("") ||
          `<p class="footnote">Todos los botes ya tienen llegada.</p>`}
      </div>
      ${taken.length ? `
        <div class="group-label">Ya asignados (tocá para cambiar)</div>
        <div class="assign-grid taken">
          ${taken.map((b) => boatButton(b, `llegada ${takenBy.get(b.id) + 1}`)).join("")}
        </div>` : ""}
      ${a.boatId ? `<button type="button" class="btn btn-secondary" data-unassign>Quitar asignación</button>` : ""}
      <button type="button" class="btn btn-danger-text" data-delete>Borrar esta llegada</button>`,
    onClose: () => {
      save();
      if (p.phase === "results") syncHistory();
      renderPasadas();
    },
  });

  box.addEventListener("click", (e) => {
    const boatBtn = e.target.closest("[data-boat]");
    if (boatBtn) {
      const boatId = boatBtn.dataset.boat;
      p.arrivals.forEach((x) => {
        if (x.boatId === boatId) x.boatId = null;
      });
      a.boatId = boatId;
      closeSheet();
    } else if (e.target.closest("[data-unassign]")) {
      a.boatId = null;
      closeSheet();
    } else if (e.target.closest("[data-delete]")) {
      p.arrivals = p.arrivals.filter((x) => x.id !== a.id);
      closeSheet();
    }
  });
}

async function cancelPasada() {
  const ok = await confirmSheet({
    title: "Cancelar pasada",
    message: "Se pierden la largada y las llegadas marcadas. Los botes quedan cargados.",
    confirmLabel: "Cancelar pasada",
    destructive: true,
  });
  if (!ok) return;
  resetRun();
  save();
  renderPasadas();
}

async function finishPasada() {
  if (!p.arrivals.length) {
    const ok = await confirmSheet({
      title: "Terminar",
      message: "No marcaste ninguna llegada, así que la pasada no se guarda.",
      confirmLabel: "Terminar igual",
      destructive: true,
    });
    if (!ok) return;
    resetRun();
  } else {
    p.phase = "results";
    p.historyId = uid();
    syncHistory();
    vibrate([30, 40, 30]);
  }
  save();
  renderPasadas();
}


// =============================
// 3. RESULTADOS
// =============================

function computeResults() {
  const rows = p.arrivals
    .filter((a) => a.boatId && boatById(a.boatId))
    .sort((x, y) => x.ms - y.ms)
    .map((a) => {
      const boat = boatById(a.boatId);
      return { arrival: a, boat, timeMs: a.ms - boat.offset * 1000 };
    });
  const firstMs = rows.length ? rows[0].arrival.ms : 0;
  rows.forEach((r) => {
    r.gapMs = r.arrival.ms - firstMs;
  });
  const arrived = new Set(rows.map((r) => r.boat.id));
  return {
    rows,
    missing: p.boats.filter((b) => !arrived.has(b.id)),
    unassigned: p.arrivals.filter((a) => !a.boatId),
  };
}

// Se guarda al terminar y se actualiza cada vez que se corrige una
// asignación desde Resultados (mismo id, no se duplica).
function syncHistory() {
  if (!p.historyId) return;
  const { rows, missing } = computeResults();
  const plain = (b) => ({ name: b.name, color: b.color, boatClass: b.boatClass, category: b.category, offset: b.offset });
  history.upsert({
    id: p.historyId,
    type: "pasada",
    date: p.startedAt,
    distance: p.distance,
    results: rows.map((r) => ({ ...plain(r.boat), arrivalMs: r.arrival.ms, timeMs: r.timeMs, gapMs: r.gapMs })),
    missing: missing.map(plain),
  });
}

export function resultRowsMarkup(results, missing) {
  return results.map((r, i) => `
      <div class="result-row" ${r.arrivalId ? `role="button" tabindex="0" data-action="assign" data-id="${r.arrivalId}"` : ""}>
        <span class="result-pos">${i + 1}</span>
        ${boatDot(r)}
        <span class="boat-text">
          <span class="boat-name">${escapeHtml(r.name)}</span>
          <span class="boat-sub">${r.boatClass} · ${escapeHtml(r.category)} · salió ${formatOffset(r.offset)}</span>
        </span>
        <span class="result-time">${formatClock(r.timeMs)}<small>${formatGap(r.gapMs)}</small></span>
      </div>`).join("") +
    missing.map((b) => `
      <div class="result-row missing">
        <span class="result-pos">–</span>
        ${boatDot(b)}
        <span class="boat-text">
          <span class="boat-name">${escapeHtml(b.name)}</span>
          <span class="boat-sub">${b.boatClass} · ${escapeHtml(b.category)}</span>
        </span>
        <span class="result-time muted">Sin llegada</span>
      </div>`).join("");
}

function renderResults() {
  const { rows, missing, unassigned } = computeResults();
  const results = rows.map((r) => ({
    ...r.boat, arrivalId: r.arrival.id, timeMs: r.timeMs, gapMs: r.gapMs,
  }));

  root.innerHTML = `
    <h1 class="large-title">Resultados</h1>
    <p class="subtitle">${p.distance} m · ${p.boats.length} ${p.boats.length === 1 ? "bote" : "botes"} · guardada en Historial</p>

    ${unassigned.length ? `
      <div class="group-label">Llegadas sin asignar</div>
      <ol class="list arrivals">
        ${p.arrivals.map((a, i) => (a.boatId ? "" : arrivalRow(a, i))).join("")}
      </ol>` : ""}

    <div class="group-label">Orden de llegada</div>
    <div class="list">${resultRowsMarkup(results, missing)}</div>
    <p class="footnote">Con salida escalonada, el orden de llegada ya es el resultado con handicap. El tiempo es lo que tardó cada bote desde su propia salida. Tocá una fila para corregir la asignación.</p>

    <button type="button" class="btn btn-primary" data-action="adjust" ${rows.length < 2 ? "disabled" : ""}>Ajustar ventajas y repetir</button>
    <button type="button" class="btn btn-secondary" data-action="again">Repetir con las mismas ventajas</button>`;
}

// Nueva ventaja = vieja + lo que el bote llegó antes que el promedio.
// Si llegó 6 s antes que el resto, sale 6 s más tarde la próxima vez.
function adjustAndRepeat() {
  const { rows } = computeResults();
  if (rows.length < 2) return;

  const mean = rows.reduce((s, r) => s + r.arrival.ms, 0) / rows.length;
  const proposed = new Map(rows.map((r) => [r.boat.id, r.boat.offset + (mean - r.arrival.ms) / 1000]));

  p.boats.forEach((b) => {
    b.prevOffset = b.offset;
    if (proposed.has(b.id)) b.offset = proposed.get(b.id);
  });
  const min = Math.min(...p.boats.map((b) => b.offset));
  p.boats.forEach((b) => {
    b.offset = Math.max(0, Math.round(b.offset - min));
    b.auto = false;
  });

  resetRun();
  save();
  renderPasadas();
  toast("Ventajas ajustadas — revisalas antes de largar");
}

function repeatSame() {
  resetRun();
  save();
  renderPasadas();
}


// =============================
// EVENTOS E INICIO
// =============================

const ACTIONS = {
  edit: (id) => openBoatEditor(id),
  minus: (id) => changeOffset(id, -1),
  plus: (id) => changeOffset(id, 1),
  add: () => addBoat(),
  suggest: () => suggestAll(),
  "distance-custom": () => openCustomDistance(),
  start: () => startPasada(),
  cancel: () => cancelPasada(),
  finish: () => finishPasada(),
  undo: () => undoArrival(),
  assign: (id) => openAssign(id),
  adjust: () => adjustAndRepeat(),
  again: () => repeatSame(),
};

export function renderPasadas() {
  if (p.phase === "running") {
    renderRunning();
    ensureTick();
    updateRunDisplay(Date.now() - p.startedAt);
  } else if (p.phase === "results") {
    renderResults();
  } else {
    renderSetup();
  }
}

export function isPasadaRunning() {
  return p.phase === "running";
}

export function initPasadas() {
  root.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    if (el.dataset.action === "distance") {
      p.distance = Number(el.dataset.value);
      recomputeAuto();
      save();
      renderPasadas();
      return;
    }
    const action = ACTIONS[el.dataset.action];
    if (action) action(el.dataset.id);
  });

  // La llegada se marca al apoyar el dedo (pointerdown), no al soltarlo:
  // el "click" llega ~100 ms después y en una llegada reñida eso importa.
  root.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#arrival-btn")) registerArrival();
  });

  // Teclado / lectores de pantalla: Enter o espacio sobre LLEGADA
  root.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.id === "arrival-btn") {
      e.preventDefault();
      registerArrival();
    }
  });

  // Los pitidos siguen aunque se mire otra pestaña. Si la app se recargó
  // en plena pasada, iOS exige un toque para volver a habilitar el sonido.
  if (p.phase === "running") {
    ensureTick();
    document.addEventListener("pointerdown", unlockAudio, { once: true });
  }
}
