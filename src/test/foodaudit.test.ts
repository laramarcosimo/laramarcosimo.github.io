import { describe, expect, it } from 'vitest';
import { FOODS, lookupFood, resolveLine } from '../lib/foodDb';

describe('auditoría de la tabla de alimentos', () => {
  it('las kcal de cada fila cuadran con sus macros (4P + 4C + 9G, ±20 % o ±25 kcal)', () => {
    const ALCOHOL = new Set(['cerveza', 'vino tinto']); // el alcohol aporta 7 kcal/g y no sale en los macros
    const bad = FOODS.filter((f) => {
      if (ALCOHOL.has(f.keys[0])) return false;
      const est = 4 * f.protein + 4 * f.carbs + 9 * f.fat;
      const tol = Math.max(25, f.kcal * 0.2);
      // Algunas filas dan los hidratos sin la fibra (que aporta ~2 kcal/g): vale cualquiera de las dos cuentas.
      return Math.abs(f.kcal - est) > tol && Math.abs(f.kcal - (est + 2 * f.fiber)) > tol;
    }).map((f) => `${f.keys[0]}: ${f.kcal} kcal vs ${Math.round(4 * f.protein + 4 * f.carbs + 9 * f.fat)} por macros`);
    expect(bad).toEqual([]);
  });

  it('no hay dos filas con la misma clave', () => {
    const seen = new Set<string>();
    const dup = FOODS.map((f) => f.keys[0]).filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
    expect(dup).toEqual([]);
  });

  it('los alimentos habituales están en rangos razonables por 100 g (BEDCA / USDA)', () => {
    const ranges: [string, [number, number], [number, number]][] = [
      // [alimento, kcal, proteína]
      ['pechuga de pollo cocida', [150, 180], [28, 33]],
      ['arroz', [120, 140], [2.2, 3.2]],
      ['pasta', [135, 165], [4.5, 6.5]],
      ['pasta integral', [115, 155], [4.5, 6.5]],
      ['macarrones', [135, 165], [4.5, 6.5]],
      ['arroz basmati', [115, 140], [2.5, 4]],
      ['alubias pintas', [105, 145], [6, 9]],
      ['lentejas', [100, 135], [7, 10]],
      ['garbanzos', [115, 165], [7, 10]],
      ['aceite de oliva', [880, 900], [0, 0.1]],
      ['avena', [360, 390], [11, 14]],
      ['skyr', [55, 70], [9, 12]],
      ['huevo', [135, 150], [12, 14]],
    ];
    const out = ranges.flatMap(([name, k, p]) => {
      const f = lookupFood(name);
      if (!f) return [`${name}: no está en la tabla`];
      return f.kcal >= k[0] && f.kcal <= k[1] && f.protein >= p[0] && f.protein <= p[1] ? [] : [`${name}: ${f.kcal} kcal / ${f.protein} g P fuera de rango`];
    });
    expect(out).toEqual([]);
  });

  it('crudo y cocinado dan valores distintos en arroz, pasta y legumbres', () => {
    for (const n of ['arroz', 'arroz basmati', 'pasta', 'macarrones', 'pasta integral', 'lentejas', 'garbanzos', 'alubias pintas', 'quinoa']) {
      const cocido = resolveLine(`100 g de ${n} cocinado`);
      const crudo = resolveLine(`100 g de ${n} crudo`);
      expect(cocido, n).not.toBeNull();
      expect(crudo, n).not.toBeNull();
      expect(crudo!.kcal, n).toBeGreaterThan(cocido!.kcal * 1.8);
    }
  });

  it('una cucharada de aceite pesa unos 13 g y una cucharadita unos 4,5 g', () => {
    const cda = resolveLine('1 cucharada de aceite de oliva');
    const cdta = resolveLine('1 cucharadita de aceite de oliva');
    expect(cda!.grams).toBeGreaterThanOrEqual(13);
    expect(cdta!.grams).toBeGreaterThanOrEqual(4.5);
  });

  it('un huevo mediano comestible ronda 50 g', () => {
    expect(resolveLine('1 huevo')!.grams).toBe(50);
  });
});
