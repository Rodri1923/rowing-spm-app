// =============================
// AJUSTES Y AYUDA
// =============================
// Hoja de Ajustes (tema, tabla de handicap, instalar, link al club) y la
// guía "Cómo usar", que se muestra sola la primera vez.

import { store, escapeHtml, openSheet, closeSheet, formatDuration } from "./core.js";
import { BOAT_CLASSES, loadHandicap, saveHandicap, resetHandicap } from "./handicap.js";

const THEME_KEY = "theme";
const ONBOARDED_KEY = "ccr_onboarded";
const CLUB_URL = "https://www.instagram.com/clubcoloniarowing/?hl=es";


// =============================
// TEMA CLARO / OSCURO
// =============================
// El tema inicial lo pone un script chico en el <head> antes de pintar,
// para que no parpadee. Se guarda como texto plano (no JSON) para seguir
// leyendo lo que guardaban las versiones anteriores.

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#000000" : "#eef2f8");
}

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (err) {
    // sin guardado: el tema dura solo esta sesión
  }
  applyTheme(theme);
}


// =============================
// INSTALAR LA APP (Agregar a inicio)
// =============================
// Android/Chrome exponen "beforeinstallprompt": se puede disparar el
// diálogo nativo con un botón. iOS Safari no tiene esa API — ahí se
// muestran los pasos manuales.

const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
});

function installRow() {
  if (isStandalone) return "";
  if (deferredInstallPrompt) {
    return `<button type="button" class="list-row" data-install>Agregar a la pantalla de inicio <span class="chevron">›</span></button>`;
  }
  if (isIos) {
    return `<div class="list-row static">Para instalarla: tocá compartir → "Agregar a inicio"</div>`;
  }
  return "";
}


// =============================
// HOJA DE AJUSTES
// =============================

export function openAjustes() {
  const theme = currentTheme();
  const box = openSheet({
    title: "Ajustes",
    content: `
      <div class="group-label">Apariencia</div>
      <div class="segmented">
        <button type="button" data-theme-choice="light" aria-pressed="${theme === "light"}">Claro</button>
        <button type="button" data-theme-choice="dark" aria-pressed="${theme === "dark"}">Oscuro</button>
      </div>
      <p class="footnote">Con sol fuerte, el tema claro se lee mejor.</p>

      <div class="group-label">Pasadas</div>
      <div class="list">
        <button type="button" class="list-row" data-handicap>Tabla de handicap <span class="chevron">›</span></button>
      </div>

      <div class="group-label">App</div>
      <div class="list">
        <button type="button" class="list-row" data-help>Cómo usar <span class="chevron">›</span></button>
        ${installRow()}
        <a class="list-row" href="${CLUB_URL}" target="_blank" rel="noopener noreferrer">Club Colonia Rowing en Instagram <span class="chevron">↗</span></a>
      </div>

      <p class="footnote center">Funciona sin conexión. Todo se guarda en este celular.</p>`,
  });

  box.addEventListener("click", async (e) => {
    const themeBtn = e.target.closest("[data-theme-choice]");
    if (themeBtn) {
      setTheme(themeBtn.dataset.themeChoice);
      box.querySelectorAll("[data-theme-choice]").forEach((b) => b.setAttribute("aria-pressed", String(b === themeBtn)));
    } else if (e.target.closest("[data-handicap]")) {
      openHandicapEditor();
    } else if (e.target.closest("[data-help]")) {
      openHowTo({ onBack: openAjustes });
    } else if (e.target.closest("[data-install]") && deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      // El prompt nativo solo se puede usar una vez
      deferredInstallPrompt = null;
      closeSheet();
    }
  });
}


// =============================
// TABLA DE HANDICAP
// =============================

function parseTime(text) {
  const match = String(text).trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function openHandicapEditor() {
  const cfg = loadHandicap();

  const render = () => `
    <p class="footnote">Se usa para <strong>sugerir</strong> la ventaja de cada bote. Los valores vienen aproximados: calibralos con tus pasadas. En cada pasada siempre podés ajustar los botes a mano.</p>

    <div class="group-label">Tiempo de referencia en 1000 m (Senior)</div>
    <div class="list">
      ${BOAT_CLASSES.map((c) => `
        <label class="list-row edit-row">
          <span>${c}</span>
          <input type="text" inputmode="numeric" data-class-time="${c}" value="${formatDuration(cfg.classTimes[c])}" aria-label="Tiempo ${c} en minutos:segundos">
        </label>`).join("")}
    </div>

    <div class="group-label">Categorías · % del tiempo Senior</div>
    <div class="list">
      ${cfg.categories.map((c, i) => `
        <div class="list-row edit-row">
          <input type="text" class="cat-name" data-cat-name="${i}" value="${escapeHtml(c.name)}" maxlength="24" aria-label="Nombre de la categoría">
          <input type="number" inputmode="numeric" data-cat-factor="${i}" value="${c.factor}" min="50" max="200" aria-label="Porcentaje">
          <button type="button" class="row-delete" data-cat-delete="${i}" aria-label="Borrar categoría">✕</button>
        </div>`).join("")}
    </div>
    <p class="footnote">Ej: 110 % = tarda un 10 % más que un Senior en el mismo bote.</p>
    <button type="button" class="btn btn-secondary" data-cat-add>+ Agregar categoría</button>
    <button type="button" class="btn btn-danger-text" data-reset>Restablecer valores originales</button>`;

  const box = openSheet({ title: "Tabla de handicap", content: render(), onBack: openAjustes });
  const rerender = () => {
    box.innerHTML = render();
  };

  box.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.classTime) {
      const secs = parseTime(t.value);
      if (secs && secs > 0) cfg.classTimes[t.dataset.classTime] = secs;
      t.value = formatDuration(cfg.classTimes[t.dataset.classTime]);
    } else if (t.dataset.catName !== undefined) {
      const name = t.value.trim();
      if (name) cfg.categories[t.dataset.catName].name = name;
      t.value = cfg.categories[t.dataset.catName].name;
    } else if (t.dataset.catFactor !== undefined) {
      const factor = Math.round(Number(t.value));
      if (factor >= 50 && factor <= 200) cfg.categories[t.dataset.catFactor].factor = factor;
      t.value = cfg.categories[t.dataset.catFactor].factor;
    } else {
      return;
    }
    saveHandicap(cfg);
  });

  box.addEventListener("click", (e) => {
    const del = e.target.closest("[data-cat-delete]");
    if (del) {
      cfg.categories.splice(Number(del.dataset.catDelete), 1);
      saveHandicap(cfg);
      rerender();
    } else if (e.target.closest("[data-cat-add]")) {
      cfg.categories.push({ name: `Categoría ${cfg.categories.length + 1}`, factor: 100 });
      saveHandicap(cfg);
      rerender();
    } else if (e.target.closest("[data-reset]")) {
      resetHandicap();
      Object.assign(cfg, loadHandicap());
      rerender();
    }
  });
}


// =============================
// CÓMO USAR
// =============================

export function openHowTo({ onBack = null } = {}) {
  const box = openSheet({
    title: "Cómo usar",
    onBack,
    onClose: () => store.set(ONBOARDED_KEY, true),
    content: `
      <ol class="howto">
        <li><strong>Entreno</strong>Tocá la pantalla en cada remada y ves las remadas por minuto. Doble toque reinicia la medida.</li>
        <li><strong>Cronómetro</strong>VUELTA marca un parcial con su promedio de remadas. Al pausar y TERMINAR, el entreno queda guardado en Historial.</li>
        <li><strong>Pasadas</strong>Cargá los botes y la app sugiere la ventaja de cada uno. LARGAR hace la cuenta regresiva con pitidos. En la llegada tocá LLEGADA cada vez que cruza una proa, y después asignás qué bote era.</li>
        <li><strong>Sin señal</strong>Funciona sin conexión, en el agua. Todo queda guardado en este celular.</li>
      </ol>
      <button type="button" class="btn btn-primary" data-start>Empezar</button>`,
  });
  box.querySelector("[data-start]").addEventListener("click", closeSheet);
}

export function initAjustes() {
  applyTheme(currentTheme());
}

export function shouldShowOnboarding() {
  return !store.get(ONBOARDED_KEY, false);
}
