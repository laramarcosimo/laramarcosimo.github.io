import { describe, expect, it } from 'vitest';
import { applySleepEvents } from '../lib/sleepCloud';
import { defaultState } from '../lib/store';

const H = 3600000;
const t0 = new Date(2026, 5, 10, 23, 30).getTime();

describe('sueño con Atajo', () => {
  it('start + stop guarda las horas en el día del despertar', () => {
    const s = applySleepEvents(defaultState(), [{ kind: 'start', at: t0 }, { kind: 'stop', at: t0 + 7.5 * H }]);
    expect(s.sleepStart).toBeNull();
    expect(Object.values(s.habits)[0]?.sleepHours).toBe(7.5);
  });
  it('solo start deja la sesión abierta', () => {
    const s = applySleepEvents(defaultState(), [{ kind: 'start', at: t0 }]);
    expect(s.sleepStart).toBe(t0);
  });
  it('un tramo corto se ignora', () => {
    const s = applySleepEvents(defaultState(), [{ kind: 'start', at: t0 }, { kind: 'stop', at: t0 + 0.5 * H }]);
    expect(s.sleepStart).toBeNull();
    expect(Object.keys(s.habits)).toHaveLength(0);
  });
  it('un stop suelto no hace nada', () => {
    const d = defaultState();
    expect(applySleepEvents(d, [{ kind: 'stop', at: t0 }])).toBe(d);
  });
});
