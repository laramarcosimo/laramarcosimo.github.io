import { describe, expect, it } from 'vitest';
import { autoLogPlanned, movePlannedToDiary, slotPassed } from '../lib/plan';
import type { PlannedMeal } from '../lib/types';
import { dayKey } from '../lib/utils';
import { mkState } from './fixtures';

const at = (h: number, m = 0, dayOffset = 0): number => new Date(2026, 9, 7 + dayOffset, h, m).getTime();
const meal = (name: string): PlannedMeal => ({ name, calorias: 300, proteinas: 20, carbs: 30, grasas: 10, detalle: ['2 huevos'] });
const withPlan = (slots: Record<string, PlannedMeal>, extra = {}) => mkState({ dayPlan: { day: dayKey(at(8)), slots }, ...extra } as never);

describe('plan → diario', () => {
  it('horas de corte por toma; la cena no caduca', () => {
    expect(slotPassed('desayuno', at(10, 59))).toBe(false);
    expect(slotPassed('desayuno', at(11))).toBe(true);
    expect(slotPassed('comida', at(16))).toBe(true);
    expect(slotPassed('merienda', at(19, 29))).toBe(false);
    expect(slotPassed('merienda', at(19, 30))).toBe(true);
    expect(slotPassed('cena', at(23, 59))).toBe(false);
  });
  it('pasa al diario lo previsto cuya hora ya pasó y lo quita del plan', () => {
    const s = withPlan({ desayuno: meal('Tostadas'), comida: meal('Arroz'), cena: meal('Tortilla') });
    const r = autoLogPlanned(s, at(12));
    expect(r.moved.map((m) => [m.slot, m.logged])).toEqual([['desayuno', true]]);
    expect(r.state.meals.map((m) => [m.plato, m.slot])).toEqual([['Tostadas', 'desayuno']]);
    expect(r.state.meals[0].detalle).toEqual(['2 huevos']);
    expect(Object.keys(r.state.dayPlan!.slots).sort()).toEqual(['cena', 'comida']);
  });
  it('si ya anotaste otra cosa en esa toma, solo quita lo previsto (no duplica)', () => {
    const s = withPlan({ desayuno: meal('Tostadas') }, { meals: [{ id: 'x', ts: at(9), slot: 'desayuno', plato: 'Café con leche', calorias: 80, proteinas: 4, carbs: 8, grasas: 3 }] });
    const r = autoLogPlanned(s, at(12));
    expect(r.moved).toEqual([{ slot: 'desayuno', name: 'Tostadas', logged: false }]);
    expect(r.state.meals).toHaveLength(1);
    expect(r.state.dayPlan!.slots.desayuno).toBeUndefined();
  });
  it('no toca un plan de otro día y «Añadir» puede pasar una toma al diario a mano', () => {
    const old = mkState({ dayPlan: { day: '2026-01-01', slots: { desayuno: meal('Viejo') } } } as never);
    expect(autoLogPlanned(old, at(12)).moved).toEqual([]);
    const r = movePlannedToDiary(withPlan({ cena: meal('Tortilla') }), 'cena');
    expect(r.meals.map((m) => m.plato)).toEqual(['Tortilla']);
    expect(r.dayPlan!.slots.cena).toBeUndefined();
  });
});

import { pendingSlots, splitBudget } from '../lib/plan';

describe('reparto real de calorías entre tomas pendientes', () => {
  const day = dayKey(at(8));
  const eat = (slot: string, kcal: number, id: string) => ({ id, ts: at(14), slot, plato: 'x', calorias: kcal, proteinas: 30, carbs: 0, grasas: 0 });

  it('las tomas ya anotadas no cuentan como pendientes (la comida de 724 y la merienda de 218 no muestran «te caben»)', () => {
    const s = mkState({ meals: [eat('comida', 724, 'a'), eat('merienda', 218, 'b')], dayPlan: { day, slots: {}, skipped: ['desayuno'] } } as never);
    expect(pendingSlots(s, day).map((f) => f.id)).toEqual(['cena']);
  });
  it('todo lo que queda va a la siguiente toma pendiente', () => {
    const only = [{ id: 'cena' as const, weight: 0.25 }];
    expect(splitBudget(808, 40, only)).toEqual({ cena: { kcal: 810, prot: 40 } });
  });
  it('con varias pendientes se reparte por peso y nunca sale negativo', () => {
    const two = [{ id: 'comida' as const, weight: 0.35 }, { id: 'cena' as const, weight: 0.25 }];
    const r = splitBudget(1200, 60, two);
    expect(r.comida.kcal + r.cena.kcal).toBeGreaterThanOrEqual(1190);
    expect(r.comida.kcal).toBeGreaterThan(r.cena.kcal);
    expect(splitBudget(-100, -5, two).comida).toEqual({ kcal: 0, prot: 0 });
  });
  it('un plan previsto o una toma saltada tampoco son pendientes', () => {
    const s = mkState({ dayPlan: { day, slots: { comida: meal('Arroz') }, skipped: ['merienda'] } } as never);
    expect(pendingSlots(s, day).map((f) => f.id)).toEqual(['desayuno', 'cena']);
  });
});

import { canPlanTomorrow, nextDayKey, rolloverPlan } from '../lib/plan';

describe('planificar mañana por la noche', () => {
  const today = dayKey(at(8));
  it('solo se puede pasada la hora de cenar: desde las 22:00, o desde las 20:00 con la cena resuelta', () => {
    const vacio = mkState({});
    expect(canPlanTomorrow(vacio, at(19, 59))).toBe(false);
    expect(canPlanTomorrow(vacio, at(21, 30))).toBe(false);
    expect(canPlanTomorrow(vacio, at(22))).toBe(true);
    expect(canPlanTomorrow(mkState({ meals: [{ id: 'c', ts: at(20, 30), slot: 'cena', plato: 'x', calorias: 400, proteinas: 20, carbs: 10, grasas: 10 }] }), at(20, 45))).toBe(true);
    expect(canPlanTomorrow(mkState({ dayPlan: { day: today, slots: {}, skipped: ['cena'] } } as never), at(20, 45))).toBe(true);
    expect(canPlanTomorrow(mkState({ dayPlan: { day: today, slots: {}, skipped: ['cena'] } } as never), at(19, 0))).toBe(false);
    expect(canPlanTomorrow(vacio, at(3))).toBe(false);
  });
  it('mañana es el día siguiente (también al cambiar de mes)', () => {
    expect(nextDayKey(new Date(2026, 9, 7, 23, 0).getTime())).toBe('2026-10-08');
    expect(nextDayKey(new Date(2026, 9, 31, 23, 0).getTime())).toBe('2026-11-01');
  });
  it('al llegar el día, el plan de mañana pasa a ser el de hoy; el viejo se descarta', () => {
    const tomorrow = dayKey(at(8, 0, 1));
    const s = mkState({ nextPlan: { day: tomorrow, slots: { desayuno: meal('Avena') }, skipped: ['merienda'] } } as never);
    expect(rolloverPlan(s, at(22)) ).toBe(s); // aún es hoy: no se toca
    const r = rolloverPlan(s, at(8, 0, 1));
    expect(r.nextPlan).toBeUndefined();
    expect(r.dayPlan?.day).toBe(tomorrow);
    expect(Object.keys(r.dayPlan!.slots)).toEqual(['desayuno']);
    expect(r.dayPlan!.skipped).toEqual(['merienda']);
    const stale = mkState({ nextPlan: { day: '2020-01-01', slots: {} } } as never);
    expect(rolloverPlan(stale, at(8)).nextPlan).toBeUndefined();
  });
  it('si ya había algo anotado como plan de hoy, se mezcla sin pisarlo', () => {
    const tomorrow = dayKey(at(8, 0, 1));
    const s = mkState({ dayPlan: { day: tomorrow, slots: { cena: meal('Pescado') }, skipped: [] }, nextPlan: { day: tomorrow, slots: { desayuno: meal('Avena'), cena: meal('Pizza') } } } as never);
    const r = rolloverPlan(s, at(9, 0, 1));
    expect(Object.keys(r.dayPlan!.slots).sort()).toEqual(['cena', 'desayuno']);
    expect(r.dayPlan!.slots.cena?.name).toBe('Pescado');
  });
});
