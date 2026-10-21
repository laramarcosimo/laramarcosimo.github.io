import { describe, expect, it } from 'vitest';
import { autoSkipDue } from '../lib/nutriWeek';
import { estimateMinutes, timeLimit } from '../lib/routineTime';
import { verifyOption } from '../lib/gemini';

const none = { planned: [], skipped: [], restored: [], logged: [] };

describe('tachado automático de tomas', () => {
  it('desayuno tras las 12 y merienda tras las 20', () => {
    expect(autoSkipDue(11, none)).toEqual([]);
    expect(autoSkipDue(12, none)).toEqual(['desayuno']);
    expect(autoSkipDue(20, none)).toEqual(['desayuno', 'merienda']);
  });
  it('respeta lo registrado, previsto, tachado o vuelto a poner', () => {
    expect(autoSkipDue(21, { planned: ['merienda'], skipped: [], restored: [], logged: ['desayuno'] })).toEqual([]);
    expect(autoSkipDue(21, { planned: [], skipped: ['desayuno'], restored: ['merienda'], logged: [] })).toEqual([]);
  });
});

describe('tiempo de la rutina', () => {
  it('estima minutos y límite por tipo de sesión', () => {
    expect(estimateMinutes([{ series: 3, descanso: 90 }, { series: 3, descanso: 90 }])).toBe(19);
    expect(estimateMinutes([{ series: 3, descanso: 60, unilateral: true }])).toBe(16);
    expect(timeLimit('Pierna y glúteo', [])).toBe(60);
    expect(timeLimit('Día 2', ['Bíceps', 'Tríceps', 'Hombros'])).toBe(45);
    expect(timeLimit('Torso', ['Pecho', 'Espalda'])).toBeNull();
  });
});

describe('verificación de platos con la tabla', () => {
  const base = { nombre: 'Revuelto', calorias: 999, proteinas: 1, carbs: 1, grasas: 1, usa: [] };
  it('sustituye la cuenta de la IA si reconoce todos los ingredientes', () => {
    const o = verifyOption({ ...base, detalle: ['2 huevos', '1 plátano'] });
    expect(o.calorias).toBeLessThan(400);
    expect(o.proteinas).toBeGreaterThan(10);
  });
  it('conserva la cuenta de la IA si algo no se reconoce', () => {
    expect(verifyOption({ ...base, detalle: ['2 huevos', 'un chorrito de algo raro'] }).calorias).toBe(999);
  });
});
