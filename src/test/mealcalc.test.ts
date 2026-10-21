import { describe, expect, it } from 'vitest';
import { cleanParts, makePart, totalsOf, withGrams } from '../lib/mealCalc';
import { moveStretches, stretchSets } from '../lib/stretchFix';
import type { Exercise } from '../lib/types';

const ex = (over: Partial<Exercise>): Exercise => ({ id: 'x', name: 'x', muscleGroup: 'Abdominales', equipment: 'Peso Corporal', imageUrl: '', personalRecords: {} as Exercise['personalRecords'], ...over });

describe('cuenta de calorías unificada', () => {
  it('usa la tabla de la app cuando conoce el alimento', () => {
    const p = makePart('arroz', 200, { calorias: 999, proteinas: 99, carbs: 99, grasas: 99 });
    expect(p.tabla).toBe(true);
    expect(p.calorias).toBeLessThan(400);
  });

  it('si no está en la tabla, escala la estimación de la IA con los gramos', () => {
    const p = makePart('zzxq inventado', 100, { calorias: 200, proteinas: 10, carbs: 20, grasas: 8 });
    expect(p.tabla).toBe(false);
    const doble = withGrams(p, 200);
    expect(doble.calorias).toBe(400);
    expect(withGrams(doble, 50).calorias).toBe(100);
  });

  it('los totales salen de la suma del desglose y cuadran con los macros', () => {
    const parts = cleanParts([
      { nombre: 'zzxq uno', gramos: 100, calorias: 100, proteinas: 5, carbs: 10, grasas: 4 },
      { nombre: 'zzxq dos', gramos: 50, calorias: 50, proteinas: 5, carbs: 5, grasas: 1 },
    ]);
    const t = totalsOf(parts);
    expect(t.proteinas).toBe(10);
    expect(t.carbs).toBe(15);
    expect(t.grasas).toBe(5);
    expect(t.calorias).toBeGreaterThan(0);
  });

  it('descarta filas sin peso o sin nombre', () => {
    expect(cleanParts([{ nombre: '', gramos: 50 }, { nombre: 'a', gramos: 0 }, 'texto'])).toHaveLength(0);
  });
});

describe('estiramientos mal clasificados', () => {
  it('pasan de Abdominales a Estiramientos y se miden por tiempo', () => {
    const r = moveStretches([ex({ id: 'a', name: 'Postura de la cobra (abdominales)' }), ex({ id: 'b', name: 'Plancha' })]);
    expect(r.exercises[0]).toMatchObject({ muscleGroup: 'Estiramientos', timed: true });
    expect(r.exercises[1].muscleGroup).toBe('Abdominales');
    expect([...r.movedIds]).toEqual(['a']);
  });

  it('sin nada que mover devuelve la misma lista', () => {
    const list = [ex({ name: 'Crunch' })];
    expect(moveStretches(list).exercises).toBe(list);
  });

  it('las series de las rutinas pasan a 30 s sin peso', () => {
    const t = [{ id: 't', name: 'R', exercises: [{ exerciseId: 'a', sets: [{ type: 'normal', weight: 5, reps: 12 }] }] }] as never;
    const out = stretchSets(t, new Set(['a'])) as unknown as { exercises: { sets: { weight: number; reps: number }[] }[] }[];
    expect(out[0].exercises[0].sets[0]).toMatchObject({ weight: 0, reps: 30 });
  });
});
