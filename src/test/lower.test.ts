import { describe, expect, it } from 'vitest';
import { analyzeProgression, lowerTo, struggledSets } from '../lib/progression';
import { at, set, workout } from './fixtures';

const now = at(12);

describe('bajar peso (autorregulación)', () => {
  it('detecta series por debajo del mínimo, al límite (RPE 10) o fallo; ignora calentamiento', () => {
    const lo = 8;
    expect(struggledSets([set(40, 5), set(40, 9)], lo)).toHaveLength(1);
    expect(struggledSets([set(40, 9, { rpe: 10 })], lo)).toHaveLength(1);
    expect(struggledSets([set(40, 9, { type: 'failure' })], lo)).toHaveLength(1);
    expect(struggledSets([set(20, 3, { type: 'warmup' }), set(40, 8), set(40, 10)], lo)).toHaveLength(0);
  });
  it('baja entre 1 y 2,5 kg (en máquina, un escalón) y nunca por debajo de 0', () => {
    expect(lowerTo(40, 2.5, false)).toBe(37.5);
    expect(lowerTo(40, 1, false)).toBe(39);
    expect(lowerTo(40, 5, false)).toBe(37.5);
    expect(lowerTo(50, 5, true)).toBe(45);
    expect(lowerTo(1, 2.5, false)).toBe(0);
  });
  it('si la última sesión no se sostuvo (5-6 reps en rango 8-10), aconseja bajar antes que subir', () => {
    const ws = [workout(now, 3, [{ id: 'sq', sets: [set(60, 6), set(60, 5), set(60, 5)] }])];
    const p = analyzeProgression(ws, 'sq', 'Sentadilla', '8-10 reps', 2.5);
    expect(p?.kind).toBe('lower');
    expect(p?.weight).toBe(57.5);
    expect(p?.text).toContain('Consejo del Coach');
    expect(p?.text).toContain('-1 kg y -2.5 kg');
  });
  it('si llegó al tope del rango sin ir al límite, sigue proponiendo subir', () => {
    const ws = [workout(now, 3, [{ id: 'sq', sets: [set(60, 10), set(60, 10), set(60, 10)] }])];
    expect(analyzeProgression(ws, 'sq', 'Sentadilla', '8-10 reps', 2.5)?.kind).toBe('raise');
  });
  it('en semana de descarga no aconseja nada', () => {
    const ws = [workout(now, 3, [{ id: 'sq', sets: [set(60, 5), set(60, 5), set(60, 5)] }])];
    expect(analyzeProgression(ws, 'sq', 'Sentadilla', '8-10 reps', 2.5, undefined, true)).toBeNull();
  });
});
