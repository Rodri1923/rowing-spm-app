// =============================
// ARRANQUE Y NAVEGACIÓN
// =============================
// La app tiene 3 pestañas (Entreno, Pasadas, Historial) más la hoja de
// Ajustes. Cada una vive en su propio módulo; acá solo se conectan.

import { $, requestWakeLock } from "./core.js";
import { initEntreno } from "./entreno.js";
import { initPasadas, renderPasadas, isPasadaRunning } from "./pasadas.js";
import { initHistorial, renderHistorial } from "./historial.js";
import { initAjustes, openAjustes, openHowTo, shouldShowOnboarding } from "./ajustes.js";

const TABS = ["entreno", "pasadas", "historial"];
const SPLASH_MS = 2400; // lo que dura la animación de bienvenida


// =============================
// SPLASH DE BIENVENIDA
// =============================
// Se saca del todo del DOM cuando termina de desvanecerse, para no dejar
// una capa fixed invisible dando vueltas.

const splash = $("splash");

if (splash) {
  splash.addEventListener("animationend", (e) => {
    if (e.target === splash) splash.remove();
  });
}


// =============================
// PESTAÑAS
// =============================

function showTab(name) {
  document.body.dataset.tab = name;
  TABS.forEach((tab) => {
    $(`view-${tab}`).hidden = tab !== name;
  });
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.tab === name));
  });
  if (name === "pasadas") renderPasadas();
  if (name === "historial") renderHistorial();
  window.scrollTo(0, 0);
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

$("settings-btn").addEventListener("click", openAjustes);


// =============================
// WAKE LOCK
// =============================

requestWakeLock();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") requestWakeLock();
});


// =============================
// INICIO
// =============================

initAjustes();
initEntreno();
initPasadas();
initHistorial();

// Si se cerró la app en plena pasada, se vuelve directo a ella
showTab(isPasadaRunning() ? "pasadas" : "entreno");

if (shouldShowOnboarding()) {
  setTimeout(() => openHowTo(), SPLASH_MS);
}
