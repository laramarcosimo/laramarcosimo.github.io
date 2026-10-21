import type { PackInfo, PantryItem, PantryMemo } from './types';
import { productKey } from './openfood';
import { estimateExpiry } from './shelfLife';
import { looseMatch, norm, uid } from './utils';

export type Place = 'nevera' | 'despensa' | 'congelador';
export const PLACES: { id: Place; label: string }[] = [{ id: 'nevera', label: 'Nevera' }, { id: 'despensa', label: 'Despensa' }, { id: 'congelador', label: 'Congelador' }];

// 1) Congelador: lo que dice «congelado» o lo es por naturaleza.
const FREEZER = /congelad|ultracongelad|helado|hielo|sorbete|\bpolo\b|croqueta|nugget|empanadilla|empanada|pizza|san jacobo|varitas|rebozad|hojaldre|menestra|frutos del bosque|cubitos/;
// 2) Despensa: envasados, conservas, secos y cosas que no necesitan frío (antes que la nevera: «tomate frito» no es «tomate»).
const PANTRY = /\blata\b|conserva|\bbote\b|tarro|\buht\b|brick|tomate frito|tomate triturado|pure de tomate|atun|sardina|mejillon|berberecho|caballa|anchoa|garbanzo|lenteja|alubia|judias? (blanca|pinta)|\bmaiz\b|aceituna|encurtido|pepinillo|\barroz\b|pasta\b|macarron|espagueti|fideo|cuscus|quinoa|harina|azucar|\bsal\b|aceite|vinagre|salsa|ketchup|mayonesa|mostaza|\bmiel\b|mermelada|crema de (cacahuete|avellana)|mantequilla de cacahuete|cacao|\bcafe\b|\bte\b|infusion|cereal|muesli|avena|galleta|tostada|pan de molde|\bpan\b|pan rallado|frutos secos|almendra|\bnuez|anacardo|cacahuete|pistacho|pasas|datil|chocolate|snack|patata|boniato|cebolla|\bajos?\b|calabaza|platano|banana|naranja|mandarina|limon|\bpina\b|aguacate|kiwi|proteina|whey|barrita|caldo|especia|pimenton|oregano|levadura|leche (de )?(avena|soja|almendra|arroz)|^leche$|^leche /;
// 3) Nevera: frescos y lácteos.
const FRIDGE = /leche fresca|yogur|skyr|kefir|natillas|flan|queso|mantequilla|\bnata\b|requeson|mozzarella|burrata|huevo|jamon|embutido|lonchas|fiambre|chorizo|salchichon|fuet|lomo|bacon|panceta|salchicha|pavo|pollo|ternera|cerdo|cordero|carne|picada|hamburguesa|pescado|salmon|merluza|bacalao|dorada|lubina|gamba|langostino|calamar|sepia|pulpo|tofu|tempeh|seitan|hummus|guacamole|lechuga|espinaca|rucula|canonigo|acelga|\bcol\b|repollo|brocoli|coliflor|calabacin|berenjena|pepino|tomate|pimiento|zanahoria|puerro|champinon|seta|esparrago|judias verdes|apio|remolacha|ensalada|verdura|fresa|frambuesa|arandano|\bmora|\buva|cereza|ciruela|melocoton|nectarina|albaricoque|\bhigo|\bpera\b|manzana|melon|sandia|zumo|masa fresca|pasta fresca|tortilla de patata/;

/** Ubicación de un producto: la que elegiste o, si no, la deducida del nombre (congelador → despensa → nevera; por defecto, despensa). */
export const placeOf = (p: { name: string; place?: Place }): Place => {
  if (p.place) return p.place;
  const n = norm(p.name);
  if (FREEZER.test(n)) return 'congelador';
  if (PANTRY.test(n)) return 'despensa';
  return FRIDGE.test(n) ? 'nevera' : 'despensa';
};

/** Criterio antiguo (solo para limpiar una vez las ubicaciones que se guardaron con él sin que las eligieras tú). */
export const legacyPlaceOf = (name: string): Place => {
  const n = norm(name);
  if (/congelad|helado|hielo|ultracongelad|croqueta|nugget|empanadill|pizza|sorbete/.test(n)) return 'congelador';
  return /leche|yogur|skyr|kefir|queso|mantequilla|nata\b|huevo|jamon|embutido|lonchas|fiambre|salchicha|pollo|pavo|ternera|cerdo|carne|picada|pescado|salmon|merluza|gamba|tofu|lechuga|espinaca|rucula|tomate|pepino|calabacin|zanahoria|pimiento|brocoli|coliflor|fruta|fresa|uva|manzana|pera|naranja|aguacate|verdura|hummus|zumo|requeson|mozzarella/.test(n) ? 'nevera' : 'despensa';
};

/** Frutas (para el objetivo de al menos 2 piezas al día). */
export const isFruit = (name: string): boolean => /manzana|\bpera\b|platano|banana|naranja|mandarina|clementina|limon|kiwi|\buva|fresa|frambuesa|arandano|\bmora\b|cereza|ciruela|melocoton|nectarina|albaricoque|\bhigo|melon|sandia|\bpina\b|mango|papaya|granada|pomelo|fruta/.test(norm(name));

export interface PantryEntry {
  place?: Place;
  name: string;
  store?: string;
  qty?: number;
  /** Caducidad AAAA-MM-DD. */
  expires?: string;
  unitGrams?: number;
  portionG?: number;
  /** Unidades sueltas leídas del envase (si no vienen, se estiman por el nombre). */
  unitLabel?: string;
  unitsPerPack?: number;
  innerPack?: number;
}

// ---------- Unidades sueltas dentro del envase (rebanadas, pechugas, salchichas…) ----------

export interface UnitSuggestion {
  label: string;
  /** Unidades por envase. */
  per: number;
  /** Unidades por pack interior (envases con varios packs). */
  inner?: number;
}

/** Valores típicos para reconocer el producto por su nombre. Son orientativos: el número real de tu envase se ajusta en los detalles. */
const UNIT_GUESS: [RegExp, UnitSuggestion][] = [
  [/salchicha/, { label: 'salchichas', per: 24, inner: 6 }],
  [/pan (de )?molde|bimbo|rebanada|pan (de )?sandwich/, { label: 'rebanadas', per: 16 }],
  [/tortita|torta de (arroz|maiz)/, { label: 'tortitas', per: 14 }],
  [/pechuga/, { label: 'pechugas', per: 3 }],
  [/muslo|contramuslo/, { label: 'muslos', per: 4 }],
  [/hamburguesa/, { label: 'hamburguesas', per: 4 }],
  [/huevo/, { label: 'huevos', per: 12 }],
  [/tortilla (de )?(trigo|maiz)|wrap|\bfajita/, { label: 'tortillas', per: 8 }],
  [/lonchas|jamon cocido|jamon york|pavo (en )?lonchas|queso (en )?lonchas|queso (de )?sandwich/, { label: 'lonchas', per: 10 }],
];

export const suggestUnits = (name: string): UnitSuggestion | undefined => {
  const n = norm(name);
  return UNIT_GUESS.find(([re]) => re.test(n))?.[1];
};

/** Campos de unidades para un producto nuevo reconocido por su nombre (con valores orientativos que se pueden corregir). */
const newUnitFields = (name: string, packs: number): Partial<PantryItem> => {
  const s = suggestUnits(name);
  return s ? { unitLabel: s.label, unitsPerPack: s.per, innerPack: s.inner, units: s.per * packs } : {};
};

/** Unidades sueltas que quedan (undefined si el producto no se cuenta por unidades). */
export const unitsLeft = (p: PantryItem): number | undefined => (p.unitsPerPack ? Math.max(0, p.units ?? p.qty * p.unitsPerPack) : undefined);

/** Guarda unidades restantes: recalcula los envases (los que están a medias cuentan) y devuelve null si se agota. */
const withUnits = (p: PantryItem, units: number): PantryItem | null => {
  const per = p.unitsPerPack;
  if (!per) return p.qty > 0 ? p : null;
  const left = Math.max(0, Math.round(units));
  return left > 0 ? { ...p, units: left, qty: Math.ceil(left / per) } : null;
};

/** Cambia la cantidad en envases. En productos por unidades, sube/baja de envase entero en envase entero. */
export const setPackQty = (p: PantryItem, qty: number): PantryItem | null => {
  const n = Math.max(0, Math.round(qty));
  return p.unitsPerPack ? withUnits(p, n * p.unitsPerPack) : n > 0 ? { ...p, qty: n } : null;
};

/** Gasta `n` unidades sueltas (rebanadas, pechugas…) de un producto; sin conteo por unidades, gasta `n` envases. */
export const spendUnits = (pantry: PantryItem[], id: string, n = 1): PantryItem[] =>
  pantry.flatMap((p) => {
    if (p.id !== id) return [p];
    const left = unitsLeft(p);
    const next = left === undefined ? (p.qty - n > 0 ? { ...p, qty: p.qty - n } : null) : withUnits(p, left - n);
    return next ? [next] : [];
  });

/** Configura (o quita, con unitsPerPack = 0) el conteo por unidades de un producto manteniendo lo que ya has gastado. */
export const configureUnits = (p: PantryItem, label: string, unitsPerPack: number, innerPack?: number): PantryItem => {
  const per = Math.round(unitsPerPack);
  if (!(per > 0)) {
    const rest: PantryItem = { ...p, unitsOff: true };
    delete rest.unitLabel;
    delete rest.unitsPerPack;
    delete rest.innerPack;
    delete rest.units;
    return rest;
  }
  const inner = innerPack && innerPack > 0 && innerPack < per ? Math.round(innerPack) : undefined;
  const left = p.unitsPerPack && p.units !== undefined ? Math.min(p.units, p.qty * per) : p.qty * per;
  return { ...p, unitsOff: undefined, unitLabel: label.trim() || 'unidades', unitsPerPack: per, innerPack: inner, units: left, qty: Math.max(1, Math.ceil(left / per)) };
};

/** Productos de varias unidades por envase que se activan solos en lo que ya tenías (huevos o pechugas pueden estar contados ya por pieza: esos se activan a mano). */
const AUTO_MIGRATE = new Set(['rebanadas', 'tortitas', 'salchichas', 'tortillas', 'lonchas']);

/** Productos que podrían contarse por unidades (huevos, pechugas…) pero que no se activan solos porque quizá ya los cuentas por pieza: se le pregunta a la usuaria. */
export const askUnits = (pantry: PantryItem[]): { item: PantryItem; guess: UnitSuggestion }[] =>
  pantry.flatMap((item) => {
    if (item.unitsPerPack || item.unitsOff) return [];
    const guess = suggestUnits(item.name);
    return guess && !AUTO_MIGRATE.has(guess.label) ? [{ item, guess }] : [];
  });

const sameInfo = (a: PackInfo | undefined, b: PackInfo | undefined): boolean => !!a && !!b && a.unitsPerPack === b.unitsPerPack && (a.innerPack ?? 0) === (b.innerPack ?? 0) && a.unitLabel === b.unitLabel;

/**
 * Aplica y aprende las unidades por envase de la despensa:
 * - un producto sin conteo por unidades recibe el que ya conocemos de ese mismo producto (foto, edición a mano) o, si es de los habituales, el estimado por nombre;
 * - lo que tú corriges o lee la IA del envase se recuerda para la próxima vez que aparezca ese producto.
 * Devuelve las mismas referencias si no cambia nada.
 */
export const syncPackUnits = (pantry: PantryItem[], known: Record<string, PackInfo> | undefined): { pantry: PantryItem[]; packInfo: Record<string, PackInfo> | undefined } => {
  let catalog = known;
  let changed = false;
  const next = pantry.map((p) => {
    const key = productKey(p.name);
    if (!key) return p;
    if (p.unitsPerPack) {
      const info: PackInfo = { unitLabel: p.unitLabel || 'unidades', unitsPerPack: p.unitsPerPack, innerPack: p.innerPack };
      const g = suggestUnits(p.name);
      const guess: PackInfo | undefined = g ? { unitLabel: g.label, unitsPerPack: g.per, innerPack: g.inner } : undefined;
      if (!sameInfo(info, guess) && !sameInfo(info, catalog?.[key])) catalog = { ...(catalog ?? {}), [key]: info };
      return p;
    }
    if (p.unitsOff) return p;
    const g = suggestUnits(p.name);
    const info = catalog?.[key] ?? (g && AUTO_MIGRATE.has(g.label) ? { unitLabel: g.label, unitsPerPack: g.per, innerPack: g.inner } : undefined);
    if (!info) return p;
    changed = true;
    return { ...p, unitLabel: info.unitLabel, unitsPerPack: info.unitsPerPack, innerPack: info.innerPack, units: info.unitsPerPack * Math.max(0, p.qty) };
  });
  return { pantry: changed ? next : pantry, packInfo: catalog };
};

/** Texto breve de lo que queda: «14 rebanadas», «3 packs de 6 · 18 salchichas». */
export const unitsSummary = (p: PantryItem): string | null => {
  const left = unitsLeft(p);
  if (left === undefined) return null;
  const label = p.unitLabel || 'unidades';
  if (p.innerPack && p.innerPack > 1 && left >= p.innerPack) {
    const packs = Math.floor(left / p.innerPack);
    const rest = left % p.innerPack;
    return `${packs} pack${packs === 1 ? '' : 's'} de ${p.innerPack}${rest ? ` + ${rest}` : ''} · ${left} ${label}`;
  }
  return `${left} ${label}`;
};

/** Descuenta 1 unidad de cada ingrediente indicado (1 rebanada, 1 pechuga… si el producto se cuenta por unidades); elimina los agotados. */
export const deductFromPantry = (pantry: PantryItem[], names: string[]): PantryItem[] => {
  let items = pantry;
  for (const n of names) {
    const hit = items.find((p) => looseMatch(p.name, n));
    if (!hit) continue;
    items = spendUnits(items, hit.id, 1);
  }
  return items;
};

export const addToPantry = (pantry: PantryItem[], entries: (string | PantryEntry)[]): PantryItem[] => {
  let items = pantry;
  for (const raw of entries) {
    const e: PantryEntry = typeof raw === 'string' ? { name: raw } : raw;
    const name = e.name.trim();
    if (!name) continue;
    const hit = items.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const q = Math.max(1, Math.round(e.qty ?? 1));
    items = hit ? items.map((p) => (p.id === hit.id ? { ...p, qty: p.qty + q, units: p.unitsPerPack ? (unitsLeft(p) ?? 0) + q * p.unitsPerPack : p.units, store: p.store ?? e.store, expires: e.expires ?? p.expires, expiresApprox: e.expires ? false : p.expiresApprox, unitGrams: e.unitGrams ?? p.unitGrams, portionG: e.portionG ?? p.portionG } : p)) : [...items, { id: uid(), name, qty: q, place: e.place, store: e.store || undefined, expires: e.expires || estimateExpiry(name), expiresApprox: e.expires ? false : estimateExpiry(name) ? true : undefined, unitGrams: e.unitGrams, portionG: e.portionG, ...(e.unitsPerPack ? { unitLabel: e.unitLabel, unitsPerPack: e.unitsPerPack, innerPack: e.innerPack, units: e.unitsPerPack * q } : newUnitFields(name, q)) }];
  }
  return items;
};

const MEMO_MAX = 400;

/**
 * Recuerda cada producto que pasa por la despensa. Así, cuando se agota y desaparece de la lista, sigue apareciendo al buscarlo para añadirlo de nuevo.
 * Devuelve la misma lista (misma referencia) si no hay nada nuevo que recordar.
 */
export const rememberPantry = (history: PantryMemo[] | undefined, pantry: PantryItem[]): PantryMemo[] | undefined => {
  let next = history;
  for (const p of pantry) {
    const key = productKey(p.name);
    if (!key) continue;
    const i = (next ?? []).findIndex((m) => productKey(m.name) === key);
    const memo: PantryMemo = { name: p.name, ...(p.store ? { store: p.store } : {}), ...(p.place ? { place: p.place } : {}), ...(p.category ? { category: p.category } : {}) };
    if (i < 0) next = [...(next ?? []), memo].slice(-MEMO_MAX);
    else {
      const cur = (next as PantryMemo[])[i];
      if (cur.name !== memo.name || cur.store !== memo.store || cur.place !== memo.place || cur.category !== memo.category) next = (next as PantryMemo[]).map((m, j) => (j === i ? memo : m));
    }
  }
  return next;
};

/** Productos recordados que coinciden con la búsqueda y que ahora mismo NO están en la despensa (agotados o gastados). */
export const goneProducts = (history: PantryMemo[] | undefined, pantry: PantryItem[], query: string, max = 6): PantryMemo[] => {
  const q = norm(query);
  if (!q) return [];
  const here = new Set(pantry.map((p) => productKey(p.name)));
  return (history ?? []).filter((m) => norm(m.name).includes(q) && !here.has(productKey(m.name))).slice(-max).reverse();
};