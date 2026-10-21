import type { AppState, SavedProduct } from './types';
import { looseMatch, uid } from './utils';

/** Guarda (o actualiza) un producto escaneado / leído con foto: mismo código de barras, o mismo nombre y marca. */
export const saveProduct = (s: AppState, p: Omit<SavedProduct, 'id' | 'usedAt'> & { id?: string }): AppState => {
  const list = s.products ?? [];
  const same = list.find((x) => (p.code && x.code === p.code) || (x.name.toLowerCase() === p.name.toLowerCase() && (x.brand ?? '') === (p.brand ?? '')));
  const next: SavedProduct = { ...same, ...p, id: same?.id ?? uid(), usedAt: Date.now() };
  return { ...s, products: same ? list.map((x) => (x.id === same.id ? next : x)) : [...list, next] };
};

/** Productos guardados que coinciden con lo que escribes («mayonesa» → «Mayonesa Hacendado»), el usado más recientemente primero. */
export const findProducts = (products: SavedProduct[] | undefined, text: string): SavedProduct[] => {
  if (!text.trim() || !products?.length) return [];
  return products.filter((p) => looseMatch(p.name, text) || looseMatch(`${p.name} ${p.brand ?? ''}`, text)).sort((a, b) => b.usedAt - a.usedAt);
};

export interface Macros {
  calorias: number;
  proteinas: number;
  carbs: number;
  grasas: number;
}

/** Gramos que representa una cantidad con su unidad para este producto, o null si no se puede saber (entonces calcula la IA). */
export const gramsOf = (p: SavedProduct, qty: number, unit: string): number | null => {
  if (unit === 'g' || unit === 'ml') return qty;
  if (unit === 'raciones') return qty * (p.serving || 100);
  if (unit === 'unidades' && p.pack) return qty * p.pack; // una unidad = un envase
  if (unit === 'cucharadas') return qty * 15;
  return null;
};

/** Macros de una cantidad de un producto guardado (valores por 100 g × cantidad). */
export const macrosFor = (p: SavedProduct, grams: number): Macros => ({
  calorias: Math.round((p.kcal * grams) / 100),
  proteinas: Math.round((p.protein * grams) / 100),
  carbs: Math.round((p.carbs * grams) / 100),
  grasas: Math.round((p.fat * grams) / 100),
});
