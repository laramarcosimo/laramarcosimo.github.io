import { describe, expect, it } from 'vitest';
import { trainingCheck } from '../lib/adaptiveTdee';
import { reliabilityReport } from '../lib/mealCalc';
import { repeatedMeals } from '../lib/repeats';
import type { Meal, MealTemplate } from '../lib/types';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 19, 12);
const meal = (plato: string, daysAgo: number, calorias = 500): Meal => ({ id: `${plato}${daysAgo}`, ts: now - daysAgo * DAY, slot: 'comida', plato, calorias, proteinas: 40, carbs: 50, grasas: 15 }) as Meal;

describe('informe de fiabilidad', () => {
  it('lista solo lo que corriges de verdad, de mayor a menor', () => {
    const rows = reliabilityReport({ 'arroz blanco': { ratio: 1.4, n: 4 }, 'pechuga pollo': { ratio: 0.8, n: 3 }, huevo: { ratio: 1.02, n: 5 }, pan: { ratio: 1.5, n: 1 } });
    expect(rows.map((r) => r.key)).toEqual(['arroz blanco', 'pechuga pollo']);
    expect(rows[0].texto).toMatch(/se queda corta un 40 %/);
    expect(rows[1].texto).toMatch(/se pasa un 20 %/);
  });
  it('sin datos no hay informe', () => {
    expect(reliabilityReport(undefined)).toEqual([]);
  });
});

describe('platos repetidos', () => {
  it('propone guardar lo que registras 3 o más veces con la media de sus valores', () => {
    const meals = [meal('Pollo con arroz', 1, 480), meal('Pollo con arroz', 5, 520), meal('pollo con arroz', 9, 500), meal('Ensalada', 2)];
    const r = repeatedMeals(meals, [], now);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ veces: 3, calorias: 500 });
  });
  it('no insiste si ya lo tienes guardado ni cuenta lo antiguo', () => {
    const meals = [meal('Pollo con arroz', 1), meal('Pollo con arroz', 5), meal('Pollo con arroz', 9)];
    const tpl = [{ id: 't', name: 'Pollo con arroz', calorias: 500, proteinas: 40, carbs: 50, grasas: 15, ingredientes: [] }] as MealTemplate[];
    expect(repeatedMeals(meals, tpl, now)).toEqual([]);
    expect(repeatedMeals([meal('Pasta', 70), meal('Pasta', 80), meal('Pasta', 90)], [], now)).toEqual([]);
  });
});

describe('contraste del gasto de entreno', () => {
  it('detecta cuando la app cuenta de más o de menos', () => {
    // 12 sesiones/mes; sin entrenar gastas 1800; gasto real 1900 → los entrenos añaden ~100 kcal/día ≈ 233 por sesión
    const c = trainingCheck(1900, 1800, 12, 500);
    expect(c?.impliedPerSession).toBe(233);
    expect(c?.verdict).toBe('menos');
    expect(trainingCheck(2100, 1800, 12, 700)?.verdict).toBe('ok');
    expect(trainingCheck(2400, 1800, 12, 300)?.verdict).toBe('mas');
  });
  it('con pocas sesiones no opina', () => {
    expect(trainingCheck(2000, 1800, 3, 400)).toBeNull();
  });
});
