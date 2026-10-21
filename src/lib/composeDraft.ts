import type { FoodItemInput } from './gemini';

/**
 * Borrador de «lo que estoy añadiendo»: los alimentos elegidos (de la despensa o escritos a mano) viven aquí, no dentro de una
 * pestaña, así que no se pierden al moverte entre Tuppers, Platos, Despensa y A mano, ni al cerrar la ventana por error.
 */
export interface Draft {
  items: FoodItemInput[];
  /** Productos de la despensa elegidos (para descontarlos al confirmar). */
  used: string[];
  ts: number;
}

const KEY = 'apex-compose-drafts';
const MAX_AGE = 2 * 86_400_000;
const subs = new Map<string, Set<() => void>>();

const readAll = (): Record<string, Draft> => {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Draft>;
    const now = Date.now();
    return Object.fromEntries(Object.entries(all).filter(([, d]) => now - d.ts < MAX_AGE));
  } catch {
    return {};
  }
};
const writeAll = (all: Record<string, Draft>): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* sin almacenamiento */
  }
};
const notify = (key: string): void => subs.get(key)?.forEach((f) => f());

const filled = (items: FoodItemInput[]): FoodItemInput[] => items.filter((i) => i.nombre.trim());

export const getDraft = (key: string): Draft => readAll()[key] ?? { items: [], used: [], ts: 0 };
export const draftCount = (key: string): number => filled(getDraft(key).items).length;

export function setDraft(key: string, items: FoodItemInput[], used?: string[]): void {
  const all = readAll();
  const keep = filled(items);
  if (keep.length === 0) delete all[key];
  else all[key] = { items, used: used ?? all[key]?.used ?? [], ts: Date.now() };
  writeAll(all);
  notify(key);
}

/** Añade alimentos al borrador (si ya está el mismo alimento con la misma unidad, suma la cantidad). */
export function addToDraft(key: string, items: FoodItemInput[], used: string[] = []): void {
  const cur = getDraft(key);
  const merged = filled(cur.items).map((i) => ({ ...i }));
  for (const n of items) {
    const same = merged.find((m) => m.nombre.trim().toLowerCase() === n.nombre.trim().toLowerCase() && m.unidad === n.unidad);
    if (same) same.cantidad += n.cantidad;
    else merged.push({ ...n });
  }
  setDraft(key, merged, [...new Set([...cur.used, ...used])]);
}

export const clearDraft = (key: string): void => setDraft(key, []);

export function subscribeDraft(key: string, fn: () => void): () => void {
  if (!subs.has(key)) subs.set(key, new Set());
  subs.get(key)!.add(fn);
  return () => void subs.get(key)?.delete(fn);
}
