import { goalContext } from './coach';
import { analyzeMeal, type KnownDish } from './gemini';
import { applyCalibration, mergeReadings, spread, totalsOf } from './mealCalc';
import { dayBalance } from './metabolic';
import { storeList } from './stores';
import type { AppState, MealAnalysis } from './types';

/** Platos y tuppers guardados (por ración) con los que la IA puede reconocer la foto y usar tus valores exactos. */
export const knownDishes = (s: Pick<AppState, 'tuppers' | 'mealTemplates'>): KnownDish[] => [
  ...s.tuppers.filter((t) => t.name.trim() && t.calorias > 0).map((t) => ({ nombre: t.name.trim(), calorias: t.calorias, proteinas: t.proteinas, carbs: t.carbs, grasas: t.grasas })),
  ...(s.mealTemplates ?? []).filter((t) => t.name.trim() && t.calorias > 0).map((t) => ({ nombre: t.name.trim(), calorias: t.calorias, proteinas: t.proteinas, carbs: t.carbs, grasas: t.grasas })),
];

/** Aplica tus correcciones aprendidas a un resultado y recalcula los totales. */
export function calibrate(a: MealAnalysis, calib: AppState['calib']): MealAnalysis {
  if (!a.desglose || !calib) return a;
  const desglose = applyCalibration(a.desglose, calib);
  return desglose === a.desglose ? a : { ...a, desglose, ...totalsOf(desglose) };
}

/** Une dos lecturas del mismo plato: media de gramos por ingrediente y aviso si las kcal difieren más de un 15 %. */
export function combineReadings(a: MealAnalysis, b: MealAnalysis): MealAnalysis {
  const lecturas = [a.calorias, b.calorias];
  const dif = spread(a.calorias, b.calorias);
  const aviso = dif > 0.15 ? `Las dos lecturas de la IA no coinciden (${a.calorias} y ${b.calorias} kcal): revisa los gramos.` : undefined;
  if (a.desglose && b.desglose) {
    const desglose = mergeReadings(a.desglose, b.desglose);
    return { ...a, desglose, ...totalsOf(desglose), lecturas, aviso, guardado: a.guardado ?? b.guardado };
  }
  const avg = (x: number, y: number) => Math.round((x + y) / 2);
  return { ...a, calorias: avg(a.calorias, b.calorias), proteinas: avg(a.proteinas, b.proteinas), carbs: avg(a.carbs, b.carbs), grasas: avg(a.grasas, b.grasas), lecturas, aviso, guardado: a.guardado ?? b.guardado };
}

/** Analiza la foto de un plato con todo lo que sabe la app de ti: platos guardados, tus correcciones anteriores y, si lo activas, doble lectura. */
export async function analyzePlate(s: AppState, b64: string, note = ''): Promise<MealAnalysis> {
  const args = [s.pantry.map((p) => p.name), storeList(s.defaultSupermarket, s.supermarkets), s.defaultSupermarket, goalContext(s, dayBalance(s)), note, knownDishes(s)] as const;
  const first = await analyzeMeal(s.settings, b64, ...args, false);
  if (!s.settings.doubleRead || first.calorias <= 0) return calibrate(first, s.calib);
  let second: MealAnalysis | null = null;
  try {
    second = await analyzeMeal(s.settings, b64, ...args, true);
  } catch {
    second = null; // si la segunda falla (cupo), se queda con la primera
  }
  return calibrate(second ? combineReadings(first, second) : first, s.calib);
}
