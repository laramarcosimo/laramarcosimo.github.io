import { describe, expect, it } from 'vitest';
import { periText, weekContext, weekStats } from '../lib/nutriWeek';
import { mkState } from './fixtures';

describe('nutriWeek', () => {
  it('sin comidas no genera contexto', () => {
    expect(weekContext(mkState({}))).toBe('');
  });
  it('periText solo en día de entreno', () => {
    expect(periText(mkState({}), false)).toBe('');
    expect(periText(mkState({}), true)).toContain('ANTES del entreno');
  });
  it('cuenta pescado azul y fuentes de proteína', () => {
    const now = Date.now();
    const s = mkState({ meals: [
      { id: '1', ts: now - 3600_000, plato: 'Salmón a la plancha con verdura', calorias: 400, proteinas: 35, carbs: 5, grasas: 20 },
      { id: '2', ts: now - 7200_000, plato: 'Tortilla de huevo', calorias: 300, proteinas: 20, carbs: 2, grasas: 20 },
    ] });
    const w = weekStats(s, now);
    expect(w.oilyFish).toBe(1);
    expect(w.sources['huevo']).toBe(1);
    expect(w.vegDays).toBe(1);
  });
});

import { meriendaText } from '../lib/nutriWeek';
describe('merienda fuera de casa', () => {
  it('lunes a miércoles por defecto y configurable', () => {
    const lunes = new Date('2026-10-05T12:00:00'); // lunes
    const jueves = new Date('2026-10-08T12:00:00');
    expect(meriendaText({} as never, lunes)).toContain('FUERA DE CASA');
    expect(meriendaText({} as never, jueves)).toContain('EN CASA');
    expect(meriendaText({ meriendaFuera: [4] } as never, jueves)).toContain('FUERA DE CASA');
  });
});

describe('comidas fuera de casa', () => {
  it('cuenta y compara fuera y en casa', () => {
    const now = Date.now();
    const s = mkState({ meals: [
      { id: '1', ts: now - 1000, plato: 'Menú del día', calorias: 900, proteinas: 30, carbs: 90, grasas: 40, out: true },
      { id: '2', ts: now - 2000, plato: 'Ensalada', calorias: 300, proteinas: 20, carbs: 10, grasas: 15 },
      { id: '3', ts: now - 3000, plato: 'Pollo', calorias: 500, proteinas: 40, carbs: 5, grasas: 20 },
    ] });
    const w = weekStats(s, now);
    expect(w.outMeals).toBe(1);
    expect(w.totalMeals).toBe(3);
    expect(w.outAvg.kcal).toBe(900);
    expect(w.homeAvg.kcal).toBe(400);
    expect(weekContext(s)).toContain('fuera de casa: 1 de 3');
  });
});
