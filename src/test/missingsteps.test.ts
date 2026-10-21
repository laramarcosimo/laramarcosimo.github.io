import { describe, expect, it } from 'vitest';
import { missingStepsDay } from '../lib/missingSteps';
import { dayKey } from '../lib/utils';

const DAY = 86_400_000;
const now = new Date(2026, 9, 21, 12, 0).getTime();
const k = (back: number) => dayKey(now - back * DAY);

describe('pasos que faltan', () => {
  it('avisa de ayer si quedó a 0 y ya usas los pasos', () => {
    expect(missingStepsDay({ [k(2)]: { agua: 0, steps: 8000 }, [k(1)]: { agua: 0, steps: 0 } }, now)).toBe(k(1));
  });
  it('avisa si ayer no tiene pasos guardados', () => {
    expect(missingStepsDay({ [k(3)]: { agua: 0, steps: 5000 } }, now)).toBe(k(1));
  });
  it('no avisa si ayer tiene pasos', () => {
    expect(missingStepsDay({ [k(1)]: { agua: 0, steps: 6500 }, [k(2)]: { agua: 0, steps: 7000 }, [k(3)]: { agua: 0, steps: 7000 } }, now)).toBeNull();
  });
  it('no avisa a quien nunca ha registrado pasos', () => {
    expect(missingStepsDay({}, now)).toBeNull();
  });
  it('respeta los días descartados y pasa al anterior', () => {
    const h = { [k(5)]: { agua: 0, steps: 9000 } };
    expect(missingStepsDay(h, now, [k(1)])).toBe(k(2));
    expect(missingStepsDay(h, now, [k(1), k(2), k(3)])).toBeNull();
  });
  it('hoy nunca cuenta como pendiente', () => {
    expect(missingStepsDay({ [k(1)]: { agua: 0, steps: 4000 }, [k(2)]: { agua: 0, steps: 4000 }, [k(3)]: { agua: 0, steps: 4000 }, [k(0)]: { agua: 0, steps: 0 } }, now)).toBeNull();
  });
});
