import { describe, expect, it } from 'vitest';
import { applyStepsEvents } from '../lib/stepsCloud';
import { defaultState } from '../lib/store';

describe('pasos con Atajo', () => {
  it('guarda los pasos en el día indicado', () => {
    const s = applyStepsEvents(defaultState(), [{ day: '2026-10-18', steps: 8123 }]);
    expect(s.habits['2026-10-18']?.steps).toBe(8123);
  });
  it('el último aviso del día manda y no toca otros hábitos', () => {
    const d = defaultState();
    const base = { ...d, habits: { '2026-10-18': { agua: 3, steps: 100 } } };
    const s = applyStepsEvents(base, [{ day: '2026-10-18', steps: 5000 }, { day: '2026-10-18', steps: 9000 }]);
    expect(s.habits['2026-10-18']).toEqual({ agua: 3, steps: 9000 });
  });
  it('sin cambios devuelve el mismo estado', () => {
    const d = { ...defaultState(), habits: { '2026-10-18': { agua: 0, steps: 4000 } } };
    expect(applyStepsEvents(d, [{ day: '2026-10-18', steps: 4000 }])).toBe(d);
  });
});
