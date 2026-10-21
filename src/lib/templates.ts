import { deductFromPantry } from './pantry';
import type { AppState, Meal, MealTemplate, PantryItem, Slot } from './types';
import { looseMatch, uid } from './utils';

export const SLOTS: { id: Slot; label: string; weight: number }[] = [
  { id: 'desayuno', label: 'Desayuno', weight: 0.25 },
  { id: 'comida', label: 'Comida', weight: 0.35 },
  { id: 'merienda', label: 'Merienda', weight: 0.15 },
  { id: 'cena', label: 'Cena', weight: 0.25 },
  // Opcional: no se reserva presupuesto para los snacks; lo que comas aquí cuenta para el total del día.
  { id: 'snack', label: 'Snacks', weight: 0 },
];

/** Toma por defecto según la hora (desayuno hasta las 11, comida hasta las 16, merienda hasta las 19:30). */
export const inferSlot = (ts: number): Slot => {
  const h = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
  return h < 11 ? 'desayuno' : h < 16 ? 'comida' : h < 19.5 ? 'merienda' : 'cena';
};

export const slotOf = (m: Meal): Slot => m.slot ?? inferSlot(m.ts);

/** Qué ingredientes de la plantilla tienes en la despensa. */
export const availability = (t: MealTemplate, pantry: PantryItem[]): { have: boolean; missing: string[] } => {
  const missing = t.ingredientes.filter((i) => !pantry.some((p) => p.qty > 0 && looseMatch(p.name, i)));
  return { have: missing.length === 0, missing };
};

/** Registra la plantilla como comida de hoy y, opcionalmente, descuenta sus ingredientes de la despensa. */
export const logTemplate = (s: AppState, t: Pick<MealTemplate, 'name' | 'calorias' | 'proteinas' | 'carbs' | 'grasas' | 'ingredientes'> & { detalle?: string[] }, deduct = true, slot?: Slot): AppState => ({
  ...s,
  pantry: deduct ? deductFromPantry(s.pantry, t.ingredientes) : s.pantry,
  meals: [...s.meals, { id: uid(), ts: Date.now(), slot: slot ?? inferSlot(Date.now()), plato: t.name, calorias: t.calorias, proteinas: t.proteinas, carbs: t.carbs, grasas: t.grasas, ...(t.detalle?.length ? { detalle: t.detalle } : {}) }],
});

/** Consume una ración de un tupper: la añade a las comidas de hoy y descuenta una ración. */
export const consumeTupper = (s: AppState, id: string, slot?: Slot): AppState => {
  const t = s.tuppers.find((x) => x.id === id);
  if (!t || t.servings <= 0) return s;
  return {
    ...s,
    tuppers: s.tuppers.map((x) => (x.id === id ? { ...x, servings: x.servings - 1 } : x)),
    meals: [...s.meals, { id: uid(), ts: Date.now(), slot: slot ?? inferSlot(Date.now()), plato: t.name, calorias: t.calorias, proteinas: t.proteinas, carbs: t.carbs, grasas: t.grasas }],
  };
};

/** Guarda una comida (hecha con IA, a mano o ya registrada) como plato frecuente; si ya existe uno con ese nombre, lo actualiza. */
export const saveMealTemplate = (s: AppState, m: { name: string; calorias: number; proteinas: number; carbs: number; grasas: number }, slot?: Slot): AppState => {
  const name = m.name.trim();
  const same = s.mealTemplates.find((t) => t.name.toLowerCase() === name.toLowerCase());
  const tpl = { name, calorias: m.calorias, proteinas: m.proteinas, carbs: m.carbs, grasas: m.grasas, ingredientes: same?.ingredientes ?? [], slots: slot ? [...new Set([...(same?.slots ?? []), slot])] : same?.slots };
  return { ...s, mealTemplates: same ? s.mealTemplates.map((t) => (t.id === same.id ? { ...t, ...tpl } : t)) : [...s.mealTemplates, { id: uid(), ...tpl }] };
};
