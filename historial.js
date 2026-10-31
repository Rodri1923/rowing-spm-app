// =============================
// PESTAÑA HISTORIAL
// =============================
// Entrenos (se guardan al TERMINAR el cronómetro) y pasadas (al terminar
// la pasada), lo más nuevo primero. Todo queda en este celular.

import {
  $, store, history, uid, escapeHtml, formatClock, formatDuration,
  openSheet, closeSheet, confirmSheet, renderSeriesSvg, averageSpm, toast,
} from "./core.js";
import { resultRowsMarkup } from "./pasadas.js";

const root = $("historial-root");

const ICON_ENTRENO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6M12 2v3"/></svg>`;
const ICON_PASADA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>`;

// Grabación del viejo botón REC (versiones anteriores): se copia una sola
// vez como entreno del Historial. La original NO se borra: otra copia de
// la app en el mismo dominio (ej. la versión publicada) puede seguir
// usándola.
const OLD_RECORDING_KEY = "spm_recording";
const MIGRATED_KEY = "ccr_recording_migrated";

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
    title: `Pasada ${entry.distance} m`,
    sub: `${count} ${count === 1 ? "bote" : "botes"}${winner ? ` · ganó ${escapeHtml(winner.name)}` : ""}`,
  };
}

export function renderHistorial() {
  const items = history.list();
  if (!items.length) {
    root.innerHTML = `
      <div class="empty">
        <p><strong>Todavía no hay nada guardado</strong></p>
        <p>Los entrenos se guardan al terminar el cronómetro, y las pasadas al terminar la pasada.</p>
      </div>`;
    return;
  }

  let html = "";
  let currentDay = null;
  items.forEach((entry) => {
    const day = dayLabel(entry.date);
    if (day !== currentDay) {
      if (currentDay !== null) html += `</div>`;
      html += `<div class="group-label">${day}</div><div class="list">`;
      currentDay = day;
    }
    const { title, sub } = summary(entry);
    html += `
      <button type="button" class="hist-row" data-id="${entry.id}">
        <span class="hist-icon ${entry.type}">${entry.type === "entreno" ? ICON_ENTRENO : ICON_PASADA}</span>
        <span class="boat-text">
          <span class="boat-name">${title}</span>
          <span class="boat-sub">${sub}</span>
        </span>
        <span class="hist-time">${timeLabel(entry.date)}</span>
        <span class="chevron" aria-hidden="true">›</span>
      </button>`;
  });
  root.innerHTML = html + `</div>`;
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
    title: `${summary(entry).title} · ${dayLabel(entry.date).toLowerCase()}`,
    content: `
      ${entry.type === "entreno" ? entrenoDetail(entry) : pasadaDetail(entry)}
      <button type="button" class="btn btn-danger-text" data-delete>Borrar del historial</button>`,
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
    if (row) openDetail(row.dataset.id);
  });
}
