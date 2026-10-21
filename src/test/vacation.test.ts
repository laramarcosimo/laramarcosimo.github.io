import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES } from '../lib/exercises';
import { buildVacationTemplate, circuitIndex, CIRCUITS, isVacationWeek, vacationPatch, vacationPlan } from '../lib/vacation';
import { kcalRange } from '../lib/metabolic';
import { byDay, weekStart, weeklyStreak } from '../lib/streaks';
import { dueReminders } from '../lib/reminders';
import { mkState } from './fixtures';

describe('modo vacaciones', () => {
  it('rondas y ejercicios según los minutos', () => {
    expect(vacationPlan(5)).toEqual({ rounds: 1, exercises: 5 });
    expect(vacationPlan(10)).toEqual({ rounds: 2, exercises: 5 });
    expect(vacationPlan(12)).toEqual({ rounds: 2, exercises: 6 });
    expect(vacationPlan(15)).toEqual({ rounds: 3, exercises: 5 });
  });
  it('construye una rutina con ejercicios que existen y sin material', () => {
    for (const [ci, m] of [[0, 5], [1, 10], [2, 12], [3, 15]] as const) {
      const t = buildVacationTemplate(m, false, BUILTIN_EXERCISES, ci);
      expect(t.exercises.length).toBeGreaterThanOrEqual(4);
      for (const e of t.exercises) {
        const ex = BUILTIN_EXERCISES.find((x) => x.id === e.exerciseId);
        expect(ex?.equipment).toBe('Peso Corporal');
      }
      const series = t.exercises.reduce((a, e) => a + e.sets.length, 0);
      expect(series).toBeGreaterThanOrEqual(m - 2);
      expect(t.exercises.length).toBe(Math.min(CIRCUITS[ci].ids.length, vacationPlan(m).exercises));
      expect(series).toBeLessThanOrEqual(m + 2);
    }
  });
  it('con rodilla delicada cambia la sentadilla por box squat', () => {
    const t = buildVacationTemplate(12, true, BUILTIN_EXERCISES);
    expect(t.exercises[0].exerciseId).toBe('chair-box-squat');
  });
  it('en vacaciones se pausan los avisos de entreno', () => {
    expect(dueReminders(mkState({ settings: { vacation: true } })).some((r) => r.id === 'postworkout')).toBe(false);
  });
  it('rota el circuito por día y con el botón «Otro circuito»', () => {
    const a = circuitIndex(0, new Date('2026-10-07T10:00:00').getTime());
    const b = circuitIndex(0, new Date('2026-10-08T10:00:00').getTime());
    expect(b).toBe((a + 1) % CIRCUITS.length);
    expect(circuitIndex(1, new Date('2026-10-07T10:00:00').getTime())).toBe((a + 1) % CIRCUITS.length);
  });
  it('en vacaciones las kcal NO cambian y las semanas no rompen la racha', () => {
    expect(kcalRange({ kcalRest: { min: 1700, max: 1800 } } as never, false)).toEqual({ min: 1700, max: 1800 });
    expect(kcalRange({ kcalRest: { min: 1700, max: 1800 }, vacation: true } as never, false)).toEqual({ min: 1700, max: 1800 });
    const now = new Date('2026-10-07T12:00:00').getTime();
    const log = [{ from: now - 10 * 86_400_000 }];
    const st = { vacation: true, vacationLog: log } as never;
    expect(isVacationWeek(st, weekStart(now))).toBe(true);
    expect(isVacationWeek({ vacationLog: [{ from: now - 40 * 86_400_000, to: now - 30 * 86_400_000 }] } as never, weekStart(now))).toBe(false);
    expect(weeklyStreak(byDay([]), 3, now, (w) => isVacationWeek(st, w))).toBe(0);
  });
  it('activar y desactivar anota el periodo', () => {
    const on = vacationPatch({} as never, true, 1000);
    expect(on.vacationLog).toEqual([{ from: 1000 }]);
    const off = vacationPatch({ vacation: true, vacationLog: on.vacationLog } as never, false, 5000);
    expect(off.vacationLog).toEqual([{ from: 1000, to: 5000 }]);
    expect(off.deloadUntil).toBeUndefined(); // vacaciones cortas: sin readaptación
    const long = vacationPatch({ vacation: true, vacationLog: [{ from: 0 }] } as never, false, 15 * 86_400_000);
    expect(long.deloadUntil).toBe(22 * 86_400_000); // más de 2 semanas: 7 días de readaptación
  });
});
