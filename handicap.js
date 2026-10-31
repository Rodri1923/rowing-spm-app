// =============================
// HANDICAP DE PASADAS
// =============================
// Mismo criterio que World Rowing / Rowing Canada: cada tripulación tiene
// un tiempo esperado (tiempo de referencia del tipo de bote × factor de su
// categoría), y la ventaja de salida es la diferencia con el bote más
// lento, que sale primero.
//
// Los valores por defecto son APROXIMADOS (récords mundiales en 2000 m
// llevados a 1000 m, +10% por nivel de club) y las categorías son las que
// usa la Federación Uruguaya de Remo. Son solo una sugerencia inicial:
// se editan en Ajustes y cada bote se puede ajustar a mano.

import { store } from "./core.js";

export const BOAT_CLASSES = ["1x", "2x", "2-", "4x", "4-", "4+", "8+"];

const HANDICAP_KEY = "ccr_handicap";

// Segundos en 1000 m, categoría Senior masculina
const DEFAULT_CLASS_TIMES = {
  "1x": 215,
  "2x": 198,
  "2-": 202,
  "4x": 183,
  "4-": 186,
  "4+": 197,
  "8+": 175,
};

// Factor en % sobre el tiempo Senior (110 = tarda 10% más)
const DEFAULT_CATEGORIES = [
  { name: "Senior", factor: 100 },
  { name: "Senior Fem", factor: 111 },
  { name: "Sub 23", factor: 101 },
  { name: "Liviano", factor: 103 },
  { name: "Liviano Fem", factor: 114 },
  { name: "Sub 19", factor: 104 },
  { name: "Sub 19 Fem", factor: 115 },
  { name: "Sub 17", factor: 108 },
  { name: "Sub 17 Fem", factor: 119 },
  { name: "Infantil", factor: 116 },
  { name: "Infantil Fem", factor: 125 },
  { name: "Máster", factor: 106 },
  { name: "Máster Fem", factor: 118 },
];

export function defaultHandicap() {
  return {
    classTimes: { ...DEFAULT_CLASS_TIMES },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  };
}

export function loadHandicap() {
  const cfg = store.get(HANDICAP_KEY, null);
  if (!cfg || !cfg.classTimes || !Array.isArray(cfg.categories)) return defaultHandicap();
  return {
    classTimes: { ...DEFAULT_CLASS_TIMES, ...cfg.classTimes },
    categories: cfg.categories,
  };
}

export function saveHandicap(cfg) {
  store.set(HANDICAP_KEY, cfg);
}

export function resetHandicap() {
  store.remove(HANDICAP_KEY);
}

function expectedSeconds(boat, distance, cfg) {
  const base = cfg.classTimes[boat.boatClass] ?? cfg.classTimes["1x"];
  const cat = cfg.categories.find((c) => c.name === boat.category);
  const factor = (cat ? cat.factor : 100) / 100;
  return base * factor * (distance / 1000);
}

// { boatId: segundos de ventaja } — el más lento sale en 0
export function suggestOffsets(boats, distance) {
  if (!boats.length) return {};
  const cfg = loadHandicap();
  const expected = boats.map((b) => [b.id, expectedSeconds(b, distance, cfg)]);
  const slowest = Math.max(...expected.map(([, s]) => s));
  return Object.fromEntries(expected.map(([id, s]) => [id, Math.round(slowest - s)]));
}
