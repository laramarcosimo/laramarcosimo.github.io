import { foodKey } from './mealCalc';
import type { Meal, MealTemplate } from './types';

export interface RepeatedMeal {
  key: string;
  name: string;
  veces: number;
  calorias: number;
  proteinas: number;
  carbs: number;
  grasas: number;
}

const DAY = 86_400_000;

/**
 * Platos que registras una y otra vez (3 o más veces en 60 días, con el mismo nombre aproximado) y que aún no tienes como plato frecuente.
 * Guardarlos con valores fijos es más exacto que volver a estimarlos con la IA cada vez.
 */
export function repeatedMeals(meals: Meal[], templates: MealTemplate[], now = Date.now(), minTimes = 3): RepeatedMeal[] {
  const saved = new Set(templates.map((t) => foodKey(t.name)));
  const groups = new Map<string, Meal[]>();
  for (const m of meals) {
    if (m.ts < now - 60 * DAY || !m.plato.trim() || m.calorias <= 0) continue;
    const k = foodKey(m.plato);
    if (!k || saved.has(k)) continue;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  return [...groups.entries()]
    .filter(([, g]) => g.length >= minTimes)
    .map(([key, g]) => ({
      key,
      name: g[g.length - 1].plato.trim(),
      veces: g.length,
      calorias: avg(g.map((m) => m.calorias)),
      proteinas: avg(g.map((m) => m.proteinas)),
      carbs: avg(g.map((m) => m.carbs)),
      grasas: avg(g.map((m) => m.grasas)),
    }))
    .sort((a, b) => b.veces - a.veces);
}
