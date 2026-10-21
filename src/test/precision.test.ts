import { describe, expect, it } from 'vitest';
import { adaptiveTdee } from '../lib/adaptiveTdee';
import { applyCalibration, learnFromMeal, makePart, mergeReadings, oilGrams, setOil, toggleRaw, totalsOf, withGrams } from '../lib/mealCalc';
import { combineReadings } from '../lib/plateAnalysis';
import type { Meal, MealAnalysis, Measurement } from '../lib/types';

const DAY = 86_400_000;
const unk = (n: string, g: number) => makePart(n, g, { calorias: g * 2, proteinas: g * 0.1, carbs: g * 0.2, grasas: g * 0.05 });

describe('crudo o cocinado', () => {
  it('el mismo peso en crudo y en cocinado da distinta proteína (pollo)', () => {
    const cocinado = makePart('pechuga de pollo', 150, { calorias: 0, proteinas: 0, carbs: 0, grasas: 0 }, false);
    const crudo = toggleRaw(cocinado);
    expect(cocinado.tabla).toBe(true);
    expect(crudo.crudo).toBe(true);
    expect(cocinado.proteinas).toBeGreaterThan(crudo.proteinas);
  });
});

describe('aprender de tus correcciones', () => {
  it('con dos correcciones parecidas empieza a ajustar los gramos de la IA', () => {
    const ia = unk('zzxq arroz', 100);
    let calib = learnFromMeal(undefined, [withGrams(ia, 150)]);
    expect(applyCalibration([ia], calib)[0].gramos).toBe(100); // una sola muestra no basta
    calib = learnFromMeal(calib, [withGrams(ia, 150)]);
    const ajustado = applyCalibration([ia], calib)[0];
    expect(ajustado.gramos).toBe(150);
    expect(ajustado.aiGramos).toBe(100);
    expect(ajustado.ajuste).toBe(1.5);
  });

  it('si no corriges nada, no cambia nada', () => {
    const ia = unk('zzxq pan', 80);
    const calib = learnFromMeal(learnFromMeal(undefined, [ia]), [ia]);
    expect(applyCalibration([ia], calib)[0]).toBe(ia);
  });

  it('el aceite no se aprende', () => {
    expect(learnFromMeal(undefined, [setOil([], 10)[0]])).toEqual({});
  });
});

describe('aceite y chuf', () => {
  it('sustituye el aceite de la IA por el que eliges y 0 lo quita', () => {
    const base = [unk('zzxq pollo', 100), unk('aceite de oliva', 15)];
    expect(oilGrams(base)).toBe(15);
    const tres = setOil(base, 1.5);
    expect(oilGrams(tres)).toBeCloseTo(1.5, 1);
    expect(tres.filter((p) => /aceite/.test(p.nombre))).toHaveLength(1);
    expect(oilGrams(setOil(tres, 0))).toBe(0);
    const kcal = totalsOf(setOil([], 10)).calorias;
    expect(kcal).toBeGreaterThan(80);
    expect(kcal).toBeLessThan(100);
  });
});

describe('doble lectura', () => {
  it('promedia los gramos y avisa si las kcal difieren mucho', () => {
    const a = [unk('zzxq uno', 100), unk('zzxq dos', 40)];
    const b = [unk('zzxq uno', 140)];
    const m = mergeReadings(a, b);
    expect(m.find((p) => p.nombre === 'zzxq uno')?.gramos).toBe(120);
    expect(m.find((p) => p.nombre === 'zzxq dos')?.gramos).toBe(40);

    const mk = (kcal: number): MealAnalysis => ({ plato: 'x', calorias: kcal, proteinas: 10, carbs: 10, grasas: 10, ingredientesDetectados: [], coincidenciasDespensa: [] });
    expect(combineReadings(mk(500), mk(520)).aviso).toBeUndefined();
    expect(combineReadings(mk(400), mk(700)).aviso).toMatch(/no coinciden/);
    expect(combineReadings(mk(400), mk(700)).lecturas).toEqual([400, 700]);
  });
});

describe('gasto real adaptativo', () => {
  const now = Date.UTC(2026, 9, 19, 12);
  const meals = (kcal: number, days: number): Meal[] => Array.from({ length: days }, (_, i) => ({ id: `m${i}`, ts: now - i * DAY, slot: 'comida', plato: 'x', calorias: kcal, proteinas: 0, carbs: 0, grasas: 0 }) as Meal);
  const weights = (start: number, perDay: number): Measurement[] => [0, 7, 14, 21, 27].map((d) => ({ id: `w${d}`, ts: now - (27 - d) * DAY, weight: start + perDay * d }) as Measurement);

  it('si no cambia el peso, el gasto es lo que comes', () => {
    const r = adaptiveTdee({ meals: meals(2000, 28), measurements: weights(60, 0) }, now);
    expect(r?.tdee).toBe(2000);
  });

  it('si bajas peso, gastas más de lo que comes', () => {
    const r = adaptiveTdee({ meals: meals(1800, 28), measurements: weights(60, -0.05) }, now);
    expect(r && r.tdee).toBeGreaterThan(1800);
    expect(r?.kgPerWeek).toBeLessThan(0);
  });

  it('con pocos datos no se inventa nada', () => {
    expect(adaptiveTdee({ meals: meals(2000, 5), measurements: weights(60, 0) }, now)).toBeNull();
    expect(adaptiveTdee({ meals: meals(2000, 28), measurements: weights(60, 0).slice(0, 2) }, now)).toBeNull();
  });
});
