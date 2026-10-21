import { describe, expect, it } from 'vitest';
import { nightSteps, NIGHT_TOTAL_SECONDS } from '../lib/faceYoga';
import { dueReminders, postWorkoutInfo } from '../lib/reminders';
import { faceStreak } from '../lib/streaks';
import { at, keyOf, mkState, set, workout } from './fixtures';

describe('rutina facial nocturna', () => {
  it('el minuto 1 depende del día: pares, bloqueo ocular; impares, bloqueo frontal', () => {
    expect(nightSteps(new Date(2026, 9, 8))[0].title).toBe('Bloqueo ocular');
    expect(nightSteps(new Date(2026, 9, 7))[0].title).toBe('Bloqueo frontal');
  });
  it('son 7 ejercicios y la duración total incluye las 6 pausas de 5 s', () => {
    expect(nightSteps()).toHaveLength(7);
    expect(NIGHT_TOTAL_SECONDS).toBe(7 * 60 + 6 * 5);
  });
  it('cada ejercicio tiene posición, enfoque y técnica', () => {
    for (const s of nightSteps()) {
      expect(s.title && s.focus && s.how && s.image).toBeTruthy();
      expect(['Sentada', 'Boca arriba', 'Boca abajo']).toContain(s.position);
    }
  });
});

describe('racha de la rutina facial', () => {
  const now = at(12);
  it('cuenta los días seguidos hasta hoy', () => {
    const habits = { [keyOf(now)]: { faceYoga: true }, [keyOf(now - 86400000)]: { faceYoga: true }, [keyOf(now - 2 * 86400000)]: { faceYoga: true } };
    expect(faceStreak(habits, now)).toBe(3);
  });
  it('si hoy aún no la has hecho, sigue viva desde ayer', () => {
    expect(faceStreak({ [keyOf(now - 86400000)]: { faceYoga: true } }, now)).toBe(1);
  });
  it('se rompe si falta un día entero', () => {
    expect(faceStreak({ [keyOf(now - 2 * 86400000)]: { faceYoga: true } }, now)).toBe(0);
  });
});

describe('avisos de la app', () => {
  const base = { settings: { faceRemind: true, faceTime: '22:30' } };
  it('Face Yoga: no sale antes de la hora, sale después si no está hecha y no sale si ya está hecha', () => {
    const s = mkState(base);
    expect(dueReminders(s, at(21)).some((r) => r.id === 'face')).toBe(false);
    expect(dueReminders(s, at(22, 45)).some((r) => r.id === 'face')).toBe(true);
    const done = mkState({ ...base, habits: { [keyOf(at(12))]: { faceYoga: true } } });
    expect(dueReminders(done, at(22, 45)).some((r) => r.id === 'face')).toBe(false);
  });
  it('post-entreno: hoy entrenaste y faltan ≥ 15 g de proteína → aviso a las 21:00 por defecto', () => {
    const s = mkState({ workouts: [workout(at(19), 0, [{ id: 'x', sets: [set(50, 10)] }])] });
    const info = postWorkoutInfo(s, at(19, 30));
    expect(info).not.toBeNull();
    expect(info?.dueAt).toBe(at(21));
  });
  it('post-entreno: respeta la hora elegida en Ajustes', () => {
    const s = mkState({ settings: { postHour: 22 }, workouts: [workout(at(19), 0, [{ id: 'x', sets: [set(50, 10)] }])] });
    expect(postWorkoutInfo(s, at(19, 30))?.dueAt).toBe(at(22));
  });
  it('post-entreno: sin entreno hoy no hay aviso', () => {
    expect(postWorkoutInfo(mkState(), at(21, 30))).toBeNull();
  });
  it('post-entreno: no avisa antes de la hora y sí después', () => {
    const s = mkState({ workouts: [workout(at(17), 0, [{ id: 'x', sets: [set(50, 10)] }])] });
    expect(dueReminders(s, at(18)).some((r) => r.id === 'postworkout')).toBe(false);
    expect(dueReminders(s, at(21, 10)).some((r) => r.id === 'postworkout')).toBe(true);
  });
  it('post-entreno: si ya comiste la proteína, no avisa', () => {
    const meals = [{ id: 'm', ts: at(14), slot: 'comida', plato: 'x', calorias: 800, proteinas: 95, carbs: 50, grasas: 20 }] as never;
    const s = mkState({ meals, workouts: [workout(at(17), 0, [{ id: 'x', sets: [set(50, 10)] }])] });
    expect(postWorkoutInfo(s, at(21, 10))).toBeNull();
  });
  it('de madrugada sigue contando el día anterior', () => {
    const s = mkState({ workouts: [workout(at(19), 0, [{ id: 'x', sets: [set(50, 10)] }])] });
    expect(postWorkoutInfo(s, at(0, 30, 1))).not.toBeNull();
  });
});

describe('rutina de Face Yoga personalizada', () => {
  it('sin personalizar es la de siempre; por lados reparte a mitades', async () => {
    const { resolveNight, sideSeconds, nightTotal } = await import('../lib/faceYoga');
    const base = resolveNight(undefined);
    expect(base.steps).toHaveLength(7);
    expect(nightTotal(base.steps, base.restSec)).toBe(7 * 60 + 6 * 5);
    expect(sideSeconds(30)).toEqual([15, 15]);
    expect(sideSeconds(45)).toEqual([23, 22]);
    const r = resolveNight({ restSec: 10, steps: [{ id: 'mi-1', custom: true, title: 'Mío', seconds: 30, sides: true }, { id: 'lapiz', seconds: 20 }] });
    expect(r.steps[0].halves).toEqual(['Lado derecho', 'Lado izquierdo']);
    expect(r.steps[0].seconds).toBe(30);
    expect(r.steps[1].title).toBe('Lápiz dinámico');
    expect(nightTotal(r.steps, r.restSec)).toBe(60);
  });
});
