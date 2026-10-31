// =============================
// PESTAÑA HISTORIAL
// =============================
// Entrenos (se guardan al TERMINAR el cronómetro) y pasadas (al terminar
// la pasada), lo más nuevo primero. Todo queda en este celular.
// Cada día se comparte con un toque; "Seleccionar" permite elegir
// sesiones sueltas para compartirlas o borrarlas juntas.

import {
  $, store, history, uid, escapeHtml, formatClock, formatDuration,
  openSheet, closeSheet, confirmSheet, renderSeriesSvg, averageSpm, toast,
} from "./core.js";
import { resultRowsMarkup } from "./pasadas.js";
import { SHARE_ICON, entryTitle, openShareSheet } from "./compartir.js";

const root = $("historial-root");

const ICON_ENTRENO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6M12 2v3"/></svg>`;
const ICON_PASADA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>`;

// Grabación del viejo botón REC (versiones anteriores): se copia una sola
// vez como entreno del Historial. La original NO se borra: otra copia de
// la app en el mismo dominio (ej. la versión publicada) puede seguir
// usándola.
const OLD_RECORDING_KEY = "spm_recording";
const MIGRATED_KEY = "ccr_recording_migrated";

// Modo selección: null = normal, Set de ids = eligiendo
let selected = null;
let days = []; // [{ label, entries }] tal como se muestran

function migrateOldRecording() {
  const old = store.get(OLD_RECORDING_KEY, null);
  if (!old || store.get(MIGRATED_KEY, false)) return;
  if (Array.isArray(old.points) && old.points.length >= 2) {
    const durationMs = (old.durationSec || 0) * 1000;
    history.upsert({
      id: uid(),
      type: "entreno",
      date: (old.savedAt || Date.now()) - durationMs,
      durationMs,
      laps: [],
      samples: old.points,
    });
  }
  store.set(MIGRATED_KEY, true);
}

function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  const label = d.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function summary(entry) {
  if (entry.type === "entreno") {
    const parts = [formatDuration(entry.durationMs / 1000)];
    if (entry.laps.length) parts.push(`${entry.laps.length} ${entry.laps.length === 1 ? "vuelta" : "vueltas"}`);
    const avg = averageSpm(entry.samples);
    if (avg !== null) parts.push(`${avg} spm prom.`);
    return { title: "Entreno", sub: parts.join(" · ") };
  }
  const count = entry.results.length + entry.missing.length;
  const winner = entry.results[0];
  return {
    title: escapeHtml(entryTitle(entry)),
    sub: `${entry.distance} m · ${count} ${count === 1 ? "bote" : "botes"}${winner ? ` · ganó ${escapeHtml(winner.name)}` : ""}`,
  };
}

const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

export function renderHistorial() {
  const items = history.list();
  if (!items.length) selected = null;
  if (selected) {
    // Por si se borró algo mientras se elegía
    const ids = new Set(items.map((e) => e.id));
    selected.forEach((id) => { if (!ids.has(id)) selected.delete(id); });
  }

  const titleRow = `
    <div class="title-row">
      <h1 class="large-title">Historial</h1>
      ${items.length ? `<button type="button" class="link-btn${selected ? " strong" : ""}" data-select-mode>${selected ? "Cancelar" : "Seleccionar"}</button>` : ""}
    </div>`;

  if (!items.length) {
    root.innerHTML = `${titleRow}
      <div class="empty">
        <p><strong>Todavía no hay nada guardado</strong></p>
        <p>Los entrenos se guardan al terminar el cronómetro, y las pasadas al terminar la pasada.</p>
      </div>`;
    return;
  }

  // Agrupado por día, lo más nuevo primero
  days = [];
  items.forEach((entry) => {
    const label = dayLabel(entry.date);
    if (!days.length || days[days.length - 1].label !== label) days.push({ label, entries: [] });
    days[days.length - 1].entries.push(entry);
  });

  const row = (entry) => {
    const { title, sub } = summary(entry);
    const isSel = selected && selected.has(entry.id);
    return `
      <button type="button" class="hist-row" data-id="${entry.id}" ${selected ? `aria-pressed="${isSel}"` : ""}>
        ${selected ? `<span class="check" aria-hidden="true">${isSel ? CHECK : ""}</span>` : ""}
        <span class="hist-icon ${entry.type}">${entry.type === "entreno" ? ICON_ENTRENO : ICON_PASADA}</span>
        <span class="boat-text">
          <span class="boat-name">${title}</span>
          <span class="boat-sub">${sub}</span>
        </span>
        <span class="hist-time">${timeLabel(entry.date)}</span>
        ${selected ? "" : `<span class="chevron" aria-hidden="true">›</span>`}
      </button>`;
  };

  const dayAction = (day, i) => {
    if (!selected) {
      return `<button type="button" class="link-btn day-share" data-day-share="${i}">${SHARE_ICON} Compartir</button>`;
    }
    const all = day.entries.every((e) => selected.has(e.id));
    return `<button type="button" class="link-btn" data-day-select="${i}">${all ? "Quitar el día" : "Elegir el día"}</button>`;
  };

  const count = selected ? selected.size : 0;
  root.innerHTML = titleRow +
    days.map((day, i) => `
      <div class="group-row">
        <span class="group-label">${day.label}</span>
        ${dayAction(day, i)}
      </div>
      <div class="list">${day.entries.map(row).join("")}</div>`).join("") +
    (selected ? `
      <div class="select-bar">
        <button type="button" class="btn btn-primary btn-share" data-bulk-share ${count ? "" : "disabled"}>${SHARE_ICON} Compartir${count ? ` (${count})` : ""}</button>
        <button type="button" class="btn btn-danger" data-bulk-delete ${count ? "" : "disabled"}>Borrar${count ? ` (${count})` : ""}</button>
      </div>` : "");
}

// Al entrar a la pestaña se vuelve siempre a la vista normal
export function showHistorial() {
  selected = null;
  renderHistorial();
}

function selectedEntries() {
  return history.list().filter((e) => selected && selected.has(e.id));
}

async function deleteSelected() {
  const count = selected.size;
  const ok = await confirmSheet({
    title: "Borrar",
    message: `Se ${count === 1 ? "borra 1 sesión" : `borran ${count} sesiones`} de este celular y no se puede${count === 1 ? "" : "n"} recuperar.`,
    confirmLabel: count === 1 ? "Borrar 1 sesión" : `Borrar ${count} sesiones`,
    destructive: true,
  });
  if (!ok) return;
  history.removeMany([...selected]);
  selected = null;
  renderHistorial();
  toast(count === 1 ? "Sesión borrada" : `${count} sesiones borradas`);
}

function entrenoDetail(entry) {
  const avg = averageSpm(entry.samples);
  const laps = entry.laps.map((lap, i) => `
    <div class="lap-row">
      <span class="result-pos">${i + 1}</span>
      <span class="lap-split">${formatClock(lap.split)}</span>
      <span class="lap-spm">${lap.avgSpm ?? "–"} <small>spm</small></span>
      <span class="lap-total">${formatClock(lap.total)}</span>
    </div>`).join("");

  return `
    <div class="stats">
      <div class="stat"><span class="stat-value">${formatDuration(entry.durationMs / 1000)}</span><span class="stat-label">Duración</span></div>
      <div class="stat"><span class="stat-value">${entry.laps.length}</span><span class="stat-label">Vueltas</span></div>
      <div class="stat"><span class="stat-value">${avg ?? "–"}</span><span class="stat-label">SPM prom.</span></div>
    </div>
    ${entry.samples.length >= 2
      ? `<div class="group-label">Remadas por minuto</div><div class="list chart-box"><svg class="series-svg" viewBox="0 0 400 220"></svg></div>`
      : `<p class="footnote">No se midieron remadas durante este entreno.</p>`}
    ${laps ? `<div class="group-label">Vueltas · parcial · spm · total</div><div class="list">${laps}</div>` : ""}`;
}

function pasadaDetail(entry) {
  return `
    <p class="sheet-message">${entry.distance} m · ${timeLabel(entry.date)}</p>
    <div class="list">${resultRowsMarkup(entry.results, entry.missing)}</div>`;
}

function openDetail(id) {
  const entry = history.list().find((e) => e.id === id);
  if (!entry) return;

  const box = openSheet({
    title: `${entryTitle(entry)} · ${dayLabel(entry.date).toLowerCase()}`,
    content: `
      ${entry.type === "entreno" ? entrenoDetail(entry) : pasadaDetail(entry)}
      <button type="button" class="btn btn-primary btn-share" data-share>${SHARE_ICON} Compartir</button>
      <button type="button" class="btn btn-danger-text" data-delete>Borrar del historial</button>`,
  });

  box.querySelector("[data-share]").addEventListener("click", () => {
    openShareSheet([entry], { onBack: () => openDetail(id) });
  });

  const svg = box.querySelector(".series-svg");
  if (svg) renderSeriesSvg(svg, entry.samples, entry.durationMs / 1000);

  box.querySelector("[data-delete]").addEventListener("click", async () => {
    const ok = await confirmSheet({
      title: "Borrar",
      message: "Se borra de este celular y no se puede recuperar.",
      confirmLabel: "Borrar",
      destructive: true,
    });
    if (!ok) return;
    history.remove(id);
    closeSheet();
    renderHistorial();
    toast("Borrado del historial");
  });
}

export function initHistorial() {
  migrateOldRecording();
  root.addEventListener("click", (e) => {
    const row = e.target.closest(".hist-row");
    const dayShare = e.target.closest("[data-day-share]");
    const daySelect = e.target.closest("[data-day-select]");

    if (e.target.closest("[data-select-mode]")) {
      selected = selected ? null : new Set();
    } else if (dayShare) {
      openShareSheet(days[dayShare.dataset.dayShare].entries);
      return;
    } else if (daySelect) {
      const ids = days[daySelect.dataset.daySelect].entries.map((x) => x.id);
      const all = ids.every((id) => selected.has(id));
      ids.forEach((id) => (all ? selected.delete(id) : selected.add(id)));
    } else if (row && selected) {
      if (selected.has(row.dataset.id)) selected.delete(row.dataset.id);
      else selected.add(row.dataset.id);
    } else if (row) {
      openDetail(row.dataset.id);
      return;
    } else if (e.target.closest("[data-bulk-share]")) {
      openShareSheet(selectedEntries());
      return;
    } else if (e.target.closest("[data-bulk-delete]")) {
      deleteSelected();
      return;
    } else {
      return;
    }
    renderHistorial();
  });
}
