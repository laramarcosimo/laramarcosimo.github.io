import { describe, expect, it } from 'vitest';
import { stepsPerKm, treadmillKm, treadmillSteps } from '../lib/treadmillSteps';
import { dayKey } from '../lib/utils';

const st = (km: number, off = false) => ({
  workouts: [{ startTime: new Date(2026, 10, 19, 10).toISOString(), exercises: [{ exerciseId: 'Walking_Treadmill', name: 'Cinta', sets: [{ km }, { km: 1 }] }, { exerciseId: 'x', name: 'Press', sets: [{ km: 9 }] }] }],
  profile: { height: 159 },
  settings: { noTreadmillSteps: off },
}) as never;

describe('pasos de la cinta', () => {
  it('pasos por km según altura', () => expect(stepsPerKm(159)).toBeGreaterThan(1450));
  it('suma km solo de cardio', () => expect(treadmillKm(st(2), dayKey(new Date(2026, 10, 19, 12).getTime()))).toBe(3));
  it('se puede desactivar', () => expect(treadmillSteps(st(2, true), dayKey(new Date(2026, 10, 19, 12).getTime()))).toBe(0));
});
