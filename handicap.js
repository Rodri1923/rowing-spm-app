// =============================
// HANDICAP DE PASADAS
// =============================
// Mismo criterio que World Rowing / Rowing Canada: cada tripulación tiene
// un tiempo esperado (tiempo de referencia del tipo de bote × factor de su
// categoría), y la ventaja de salida es la diferencia con el bote más
// lento, que sale primero.
//
// tiempo esperado = tiempo del bote × factor de categoría × factor de rama
//
// Categorías y ramas: las del Circuito Nacional de la Federación Uruguaya
// de Remo (pruebas tipo "[1x]-SUB19-M"). Los tiempos y factores por
// defecto son APROXIMADOS (récords mundiales en 2000 m llevados a 1000 m,
// +10% por nivel de club). Son solo una sugerencia inicial: se editan en
// Ajustes y cada bote se puede ajustar a mano.

import { store } from "./core.js";

export const BOAT_CLASSES = ["1x", "2x", "2-", "4x", "4-", "4+", "8+"];

// Para elegir el bote por pasos: primero remo corto (pares) o largo
// (punta), y después solo los botes de ese tipo.
export const ROWING_TYPES = [
  { id: "corto", label: "Remo corto", boats: [
    { id: "1x", label: "Single" },
    { id: "2x", label: "Doble" },
    { id: "4x", label: "Cuádruple" },
  ] },
  { id: "largo", label: "Remo largo", boats: [
    { id: "2-", label: "Dos sin" },
    { id: "4-", label: "Cuatro sin" },
    { id: "4+", label: "Cuatro con" },
    { id: "8+", label: "Ocho" },
  ] },
];

export function rowingTypeOf(boatClass) {
  return boatClass.includes("x") ? "corto" : "largo";
}

// Al cambiar de remo corto a largo (o al revés) se mantiene el tamaño
// del bote cuando existe en el otro tipo.
export const SWITCH_ROWING_TYPE = {
  "1x": "2-", "2x": "2-", "4x": "4-",
  "2-": "2x", "4-": "4x", "4+": "4x", "8+": "4x",
};

export const GENDERS = [
  { id: "M", label: "Masculino" },
  { id: "F", label: "Femenino" },
  { id: "MX", label: "Mixto" },
];

const HANDICAP_KEY = "ccr_handicap";
// Sube cuando cambia la estructura de la tabla: una tabla guardada con
// otra versión se reemplaza por los valores por defecto.
const HANDICAP_VERSION = 2;

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
  { name: "Sub 11", factor: 135 },
  { name: "Sub 13", factor: 125 },
  { name: "Sub 15", factor: 115 },
  { name: "Sub 17", factor: 108 },
  { name: "Sub 19", factor: 104 },
  { name: "Sub 23", factor: 101 },
  { name: "Senior", factor: 100 },
  { name: "Peso Ligero", factor: 103 },
  { name: "Novicios", factor: 112 },
  { name: "Master", factor: 106 },
];

// Factor en % sobre el tiempo masculino
const DEFAULT_GENDER_FACTORS = { M: 100, F: 111, MX: 105 };

export function defaultHandicap() {
  return {
    version: HANDICAP_VERSION,
    classTimes: { ...DEFAULT_CLASS_TIMES },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    genderFactors: { ...DEFAULT_GENDER_FACTORS },
  };
}

export function loadHandicap() {
  const cfg = store.get(HANDICAP_KEY, null);
  if (!cfg || cfg.version !== HANDICAP_VERSION || !Array.isArray(cfg.categories)) return defaultHandicap();
  return {
    version: HANDICAP_VERSION,
    classTimes: { ...DEFAULT_CLASS_TIMES, ...cfg.classTimes },
    categories: cfg.categories,
    genderFactors: { ...DEFAULT_GENDER_FACTORS, ...cfg.genderFactors },
  };
}

// "1x · Sub 19 F" — mismo formato corto que el programa de regata
export function boatLabel(b) {
  const gender = b.gender ? ` ${b.gender}` : "";
  return `${b.boatClass} · ${b.category}${gender}`;
}

// "[1x]-SUB19-M" — el código de prueba tal como figura en el programa
export function programCode(b) {
  const cat = b.category === "Peso Ligero" ? "PL" : b.category.toUpperCase().replace(/\s+/g, "");
  return `[${b.boatClass}]-${cat}-${b.gender || "M"}`;
}

// Botes cargados con la tabla anterior (ej. "Sub 19 Fem", "Máster"):
// se pasan a categoría + rama.
const OLD_CATEGORY_NAMES = { "Liviano": "Peso Ligero", "Máster": "Master", "Infantil": "Sub 13" };

export function migrateBoat(b) {
  if (b.gender) return b;
  let category = b.category || "Senior";
  let gender = "M";
  if (category.endsWith(" Fem")) {
    category = category.slice(0, -4);
    gender = "F";
  }
  return { ...b, category: OLD_CATEGORY_NAMES[category] || category, gender };
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
  const genderFactor = (cfg.genderFactors[boat.gender] ?? 100) / 100;
  return base * factor * genderFactor * (distance / 1000);
}

// { boatId: segundos de ventaja } — el más lento sale en 0
export function suggestOffsets(boats, distance) {
  if (!boats.length) return {};
  const cfg = loadHandicap();
  const expected = boats.map((b) => [b.id, expectedSeconds(b, distance, cfg)]);
  const slowest = Math.max(...expected.map(([, s]) => s));
  return Object.fromEntries(expected.map(([id, s]) => [id, Math.round(slowest - s)]));
}
