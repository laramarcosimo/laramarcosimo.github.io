import { describe, expect, it } from 'vitest';
import { workoutsToCsv } from '../lib/exportWorkouts';
import type { WorkoutLog } from '../lib/types';

const w = { id: '1', title: 'Pierna, glúteo', startTime: '2026-03-02T10:00:00', endTime: '', durationSeconds: 3660, totalVolumeKg: 0, caloriesBurned: 0, exercises: [{ exerciseId: 'x', name: 'Sentadilla "búlgara"', muscleGroup: 'Cuádriceps', sets: [{ type: 'warmup', weight: 20, reps: 10 }, { type: 'normal', weight: 40, reps: 8, rpe: 8 }, { type: 'normal', weight: 40, reps: 7 }] }] } as unknown as WorkoutLog;

describe('exportar entrenos', () => {
  it('genera CSV tipo Strong con calentamiento W y campos escapados', () => {
    const lines = workoutsToCsv([w]).split('\n');
    expect(lines[0]).toBe('Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE');
    expect(lines[1]).toBe('2026-03-02 10:00:00,"Pierna, glúteo",1h 1m,"Sentadilla ""búlgara""",W,20,10,0,0,,,');
    expect(lines[2].endsWith(',1,40,8,0,0,,,8')).toBe(true);
    expect(lines[3]).toContain(',2,40,7,');
    expect(lines).toHaveLength(4);
  });
});

describe('informe anual', () => {
  it('liftProgress compara la primera y la mejor marca de cada ejercicio', async () => {
    const { liftProgress } = await import('../lib/report');
    const w = (day: number, weight: number, reps: number) => ({ startTime: new Date(2026, 0, day).toISOString(), exercises: [{ exerciseId: 'p', name: 'Press', sets: [{ type: 'normal', weight, reps }] }] }) as never;
    const r = liftProgress([w(20, 60, 8), w(1, 40, 8), w(10, 50, 8)]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: 'Press', from: 50.7, to: 76 });
    expect(r[0].pct).toBeGreaterThan(40);
    expect(liftProgress([w(1, 40, 8)])).toEqual([]);
  });
});
