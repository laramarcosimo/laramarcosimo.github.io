import { describe, expect, it } from 'vitest';
import { resolveLine, sumLines } from '../lib/foodDb';

describe('tabla de composición', () => {
  it('calcula medidas domésticas', () => {
    expect(resolveLine('3 lonchas de pavo')?.protein).toBeCloseTo(7.7, 0);
    expect(resolveLine('2 huevos')?.kcal).toBe(143); // 2 huevos M comestibles ≈ 100 g
    expect(resolveLine('150 g de arroz cocido')?.kcal).toBe(195);
    expect(resolveLine('1 cucharada de ketchup')?.kcal).toBe(17);
    expect(resolveLine('1 plátano')?.carbs).toBe(24);
    expect(resolveLine('½ aguacate')?.fat).toBeCloseTo(11.3, 0);
    expect(resolveLine('1,5 cucharadas de mayonesa')?.kcal).toBe(158);
  });
  it('lee el peso entre paréntesis como total y las medidas específicas de la IA', () => {
    expect(resolveLine('½ pepino mediano (≈ 100 g)')?.kcal).toBe(15);
    expect(resolveLine('2 puñados de lechuga (≈ 60 g)')?.kcal).toBe(9);
    expect(resolveLine('2 puñados de lechuga')?.grams).toBe(60);
    expect(resolveLine('½ pepino mediano')?.grams).toBe(100);
    expect(resolveLine('3 lonchas de pavo (≈ 45 g)')?.grams).toBe(45);
    expect(resolveLine('2 lonchas de queso curado')?.grams).toBe(40);
    expect(resolveLine('2 lonchas de salmón ahumado')?.protein).toBe(12.5);
    expect(resolveLine('2 huevos M (≈ 110 g)')?.kcal).toBe(157);
  });
  it('distingue crudo y cocinado y rechaza lo desconocido', () => {
    expect(resolveLine('100 g de arroz en crudo')?.kcal).toBe(360);
    expect(resolveLine('150 g de pechuga de pollo a la plancha')!.protein).toBeGreaterThan(40);
    expect(resolveLine('una pizca de sal')).toBeNull();
    expect(resolveLine('queso raro 2 trozos')).toBeNull();
  });
  it('suma un plato completo solo si todo se reconoce', () => {
    expect(sumLines(['2 huevos', '1 plátano', '3 lonchas de jamón york'])?.protein).toBe(22);
    expect(sumLines(['2 huevos', 'especias al gusto'])).toBeNull();
  });
});

import { lineToItem } from '../lib/foodItems';
describe('líneas → alimentos editables', () => {
  it('separa cantidad, unidad y nombre', () => {
    expect(lineToItem('3 lonchas de pavo (≈ 45 g)')).toEqual({ nombre: 'pavo', cantidad: 3, unidad: 'lonchas' });
    expect(lineToItem('½ pepino mediano (≈ 100 g)')).toEqual({ nombre: 'pepino mediano', cantidad: 0.5, unidad: 'unidades' });
    expect(lineToItem('2 puñados de lechuga')).toEqual({ nombre: 'lechuga', cantidad: 2, unidad: 'puñados' });
    expect(lineToItem('150 g de arroz cocido')).toEqual({ nombre: 'arroz cocido', cantidad: 150, unidad: 'g' });
    expect(lineToItem('1 cucharada sopera de aceite de oliva')).toEqual({ nombre: 'aceite de oliva', cantidad: 1, unidad: 'cucharadas' });
    expect(lineToItem('sal al gusto')).toEqual({ nombre: 'sal al gusto', cantidad: 1, unidad: 'unidades' });
  });
});

describe('tabla ampliada y productos propios', () => {
  it('reconoce alimentos nuevos y calcula sus macros', async () => {
    const { resolveLine } = await import('../lib/foodDb');
    const a = resolveLine('4 albóndigas (≈ 140 g)');
    expect(a?.kcal).toBe(280);
    expect(resolveLine('1 croissant')?.kcal).toBe(240);
    expect(resolveLine('200 g de arroz cocido')?.carbs).toBe(56);
  });
  it('un producto guardado manda sobre la tabla y se reconoce por su nombre', async () => {
    const { resolveLine, setExtraFoods } = await import('../lib/foodDb');
    setExtraFoods([{ name: 'Albóndigas (Mercadona)', kcal: 150, protein: 14, carbs: 5, fat: 8, fiber: 0, source: undefined }]);
    expect(resolveLine('100 g de albóndigas')?.kcal).toBe(150);
    setExtraFoods([{ name: 'Albóndigas', kcal: 999, protein: 1, carbs: 1, fat: 1, fiber: 0, source: 'auto' }]);
    expect(resolveLine('100 g de albóndigas')?.kcal).toBe(200); // lo aprendido de la IA (aprox.) no sustituye a la tabla
    setExtraFoods([]);
  });
});

describe('ajuste de macros de un plato', () => {
  it('reduce el ingrediente que arregla el exceso de grasa y baja los números', async () => {
    const { suggestMacroFix, scaleLine } = await import('../lib/macroFix');
    expect(scaleLine('2 cucharadas de aceite de oliva (≈ 20 g)', 0.5)).toBe('1 cucharada de aceite de oliva (≈ 10 g)');
    expect(scaleLine('120 g de pechuga de pollo', 0.75)).toBe('90 g de pechuga de pollo');
    const plato = ['150 g de pechuga de pollo', '2 cucharadas de aceite de oliva (≈ 20 g)', '60 g de arroz'];
    const fix = suggestMacroFix(plato, { grasaSlot: 12, restoGrasa: 20, carbsSlot: 60, restoCarbs: 120 });
    expect(fix?.index).toBe(1);
    expect(fix!.after.grasas).toBeLessThan(fix!.before.grasas);
    expect(fix!.after.proteinas).toBe(fix!.before.proteinas);
    expect(suggestMacroFix(plato, { grasaSlot: 40, restoGrasa: 60, carbsSlot: 80, restoCarbs: 200 })).toBeNull();
  });
});
