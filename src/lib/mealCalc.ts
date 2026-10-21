import { resolveLine } from './foodDb';
import type { Calibration, MealPart } from './types';
import { norm } from './utils';

type Macros = { calorias: number; proteinas: number; carbs: number; grasas: number };

const r1 = (n: number) => Math.round(n * 10) / 10;
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'al', 'a', 'en', 'y', 'un', 'una']);

/** Clave de un alimento para recordar cuánto sueles corregir a la IA («pechuga pollo», «arroz blanco»). */
export const foodKey = (name: string): string =>
  norm(name)
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .slice(0, 2)
    .join(' ');

/** Un ingrediente con su peso: si está en la tabla de la app manda la tabla; si no, se usa la estimación de la IA (proporcional al peso). */
export function makePart(nombre: string, gramos: number, ai: Macros, crudo = false, aiGramos?: number): MealPart {
  const g = Math.max(0, r1(gramos)); // con un decimal: un chuf de aceite pesa menos de 1 g
  const t = g > 0 ? resolveLine(`${g} g de ${nombre} ${crudo ? 'crudo' : 'cocinado'}`) : null;
  const extra = { crudo: crudo || undefined, aiGramos: aiGramos ?? g };
  if (t) return { nombre, gramos: g, calorias: t.kcal, proteinas: r1(t.protein), carbs: r1(t.carbs), grasas: r1(t.fat), tabla: true, ...extra };
  return { nombre, gramos: g, calorias: Math.round(ai.calorias), proteinas: r1(ai.proteinas), carbs: r1(ai.carbs), grasas: r1(ai.grasas), tabla: false, base: { gramos: g, ...ai }, ...extra };
}

/** Cambia los gramos de un ingrediente y recalcula (tabla o proporción sobre lo que estimó la IA). */
export function withGrams(p: MealPart, gramos: number): MealPart {
  const g = Math.max(0, r1(gramos));
  if (p.tabla) return { ...makePart(p.nombre, g, p, p.crudo, p.aiGramos), ajuste: p.ajuste };
  const b = p.base ?? { gramos: p.gramos, calorias: p.calorias, proteinas: p.proteinas, carbs: p.carbs, grasas: p.grasas };
  const k = b.gramos > 0 ? g / b.gramos : 0;
  return { ...p, gramos: g, calorias: Math.round(b.calorias * k), proteinas: r1(b.proteinas * k), carbs: r1(b.carbs * k), grasas: r1(b.grasas * k), base: b };
}

/** Pasa un ingrediente de crudo a cocinado (o al revés) con el mismo peso en la báscula: cambian las calorías y la proteína. */
export function toggleRaw(p: MealPart): MealPart {
  if (!p.tabla) return p;
  return { ...makePart(p.nombre, p.gramos, p, !p.crudo, p.aiGramos), ajuste: p.ajuste };
}

/** Suma del desglose. Si las kcal no cuadran con los macros (4·P + 4·C + 9·G) más de un 12 %, manda la cuenta de los macros. */
export function totalsOf(parts: MealPart[]): Macros {
  const s = parts.reduce((a, p) => ({ calorias: a.calorias + p.calorias, proteinas: a.proteinas + p.proteinas, carbs: a.carbs + p.carbs, grasas: a.grasas + p.grasas }), { calorias: 0, proteinas: 0, carbs: 0, grasas: 0 });
  const fromMacros = 4 * s.proteinas + 4 * s.carbs + 9 * s.grasas;
  const kcal = fromMacros > 0 && Math.abs(s.calorias - fromMacros) / fromMacros > 0.12 ? fromMacros : s.calorias;
  return { calorias: Math.round(kcal), proteinas: Math.round(s.proteinas), carbs: Math.round(s.carbs), grasas: Math.round(s.grasas) };
}

/** Lee el desglose que devuelve la IA (descarta filas sin nombre o sin peso). */
export function cleanParts(raw: unknown): MealPart[] {
  if (!Array.isArray(raw)) return [];
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const out: MealPart[] = [];
  for (const x of raw.slice(0, 30)) {
    const o = (x ?? {}) as Record<string, unknown>;
    const nombre = String(o.nombre ?? '').trim();
    const gramos = n(o.gramos);
    if (!nombre || !(gramos > 0 && gramos < 2000)) continue;
    const crudo = /crud/i.test(String(o.estado ?? ''));
    out.push(makePart(nombre, gramos, { calorias: n(o.calorias), proteinas: n(o.proteinas), carbs: n(o.carbs), grasas: n(o.grasas) }, crudo));
  }
  return out;
}

// ---------- Aprender de tus correcciones ----------

const MIN_SAMPLES = 2;
const MAX_SAMPLES = 10;

/** Aplica a los gramos de la IA el factor que ya has ido corrigiendo en ese alimento (solo si hay al menos 2 muestras y el cambio es de más del 5 %). */
export function applyCalibration(parts: MealPart[], calib: Calibration | undefined): MealPart[] {
  if (!calib) return parts;
  return parts.map((p) => {
    const c = calib[foodKey(p.nombre)];
    if (!c || c.n < MIN_SAMPLES || Math.abs(c.ratio - 1) < 0.05) return p;
    const raw = p.aiGramos ?? p.gramos;
    return { ...withGrams(p, raw * c.ratio), aiGramos: raw, ajuste: Math.round(c.ratio * 100) / 100 };
  });
}

/** Al aceptar un plato, apunta cuánto has cambiado los gramos de la IA (o que los dejaste igual) para acertar mejor la próxima vez. */
export function learnFromMeal(calib: Calibration | undefined, parts: MealPart[] | undefined): Calibration | undefined {
  if (!parts || parts.length === 0) return calib;
  const next: Calibration = { ...(calib ?? {}) };
  for (const p of parts) {
    if (!(p.aiGramos && p.aiGramos > 0 && p.gramos > 0)) continue;
    if (/aceite/i.test(p.nombre)) continue; // el aceite se elige con los botones, no se corrige a la IA
    const sample = Math.min(2.5, Math.max(0.4, p.gramos / p.aiGramos));
    const key = foodKey(p.nombre);
    if (!key) continue;
    const cur = next[key];
    const n = cur ? Math.min(cur.n, MAX_SAMPLES - 1) : 0;
    next[key] = { ratio: Math.round(((cur ? cur.ratio * n + sample : sample) / (n + 1)) * 1000) / 1000, n: n + 1 };
  }
  return next;
}

export interface ReliabilityRow {
  key: string;
  n: number;
  /** Tus gramos / gramos de la IA. */
  ratio: number;
  texto: string;
}

/** Resume en qué alimentos corriges más a la IA (solo con 2 o más muestras y una diferencia de más del 5 %). */
export function reliabilityReport(calib: Calibration | undefined): ReliabilityRow[] {
  return Object.entries(calib ?? {})
    .filter(([, c]) => c.n >= MIN_SAMPLES && Math.abs(c.ratio - 1) >= 0.05)
    .map(([key, c]) => {
      const pct = Math.round(Math.abs(c.ratio - 1) * 100);
      return { key, n: c.n, ratio: c.ratio, texto: c.ratio > 1 ? `La IA se queda corta un ${pct} % en los gramos` : `La IA se pasa un ${pct} % en los gramos` };
    })
    .sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1));
}

// ---------- Doble lectura ----------

/** Mezcla dos lecturas de la IA del mismo plato: promedia los gramos de los ingredientes que coinciden y conserva los que solo vio una. */
export function mergeReadings(a: MealPart[], b: MealPart[]): MealPart[] {
  const used = new Set<number>();
  const out: MealPart[] = a.map((p) => {
    const j = b.findIndex((q, i) => !used.has(i) && foodKey(q.nombre) === foodKey(p.nombre));
    if (j < 0) return p;
    used.add(j);
    const q = b[j];
    const g = (p.gramos + q.gramos) / 2;
    const avg = (x: number, y: number) => (x + y) / 2;
    return makePart(p.nombre, g, { calorias: avg(p.calorias, q.calorias), proteinas: avg(p.proteinas, q.proteinas), carbs: avg(p.carbs, q.carbs), grasas: avg(p.grasas, q.grasas) }, p.crudo, g);
  });
  b.forEach((q, i) => { if (!used.has(i)) out.push(q); });
  return out;
}

/** Diferencia relativa entre dos cifras (0 = iguales). */
export const spread = (x: number, y: number): number => Math.abs(x - y) / Math.max(1, (x + y) / 2);

// ---------- Aceite (cucharadas y «chuf» del dispensador) ----------

export const DEFAULT_PUFF_G = 0.5;
/** 1 cucharada sopera de aceite = 15 ml ≈ 13 g (≈ 115 kcal); 1 cucharadita = 5 ml ≈ 4,5 g. */
export const SPOON_G = { cucharadita: 4.5, cucharada: 13 } as const;

const isOil = (p: MealPart) => /aceite/i.test(p.nombre);

/** Gramos de aceite que lleva ahora el plato. */
export const oilGrams = (parts: MealPart[]): number => parts.filter(isOil).reduce((a, p) => a + p.gramos, 0);

/** Fija el aceite del plato (sustituye cualquier aceite que hubiera puesto la IA; 0 = sin aceite). */
export function setOil(parts: MealPart[], grams: number): MealPart[] {
  const rest = parts.filter((p) => !isOil(p));
  if (!(grams > 0)) return rest;
  return [...rest, { ...makePart('aceite de oliva', grams, { calorias: grams * 9, proteinas: 0, carbs: 0, grasas: grams }), aiGramos: undefined }];
}

/** Cuántos ingredientes salen de la tabla de la app y cuántos son estimación de la IA. */
export const sourceCount = (parts: MealPart[]): { tabla: number; ia: number } => ({ tabla: parts.filter((p) => p.tabla).length, ia: parts.filter((p) => !p.tabla).length });
