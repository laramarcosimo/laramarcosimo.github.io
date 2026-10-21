import type { AppState, LogSet, WorkoutLog } from '../lib/types';

/** Estado mínimo para las pruebas (solo lo que usan las funciones que se comprueban). */
type Overrides = Omit<Partial<AppState>, 'settings' | 'habits'> & { settings?: Partial<AppState['settings']>; habits?: Record<string, { faceYoga?: boolean; agua?: number }> };

export const mkState = (p: Overrides = {}): AppState =>
  ({
    profile: { weight: 75, height: 165, age: 30, sex: 'F', activity: 1.4, goal: 'recomp' },
    workouts: [],
    meals: [],
    pantry: [],
    habits: {},
    templates: [],
    exercises: [],
    measurements: [],
    layoutHidden: {},
    tuppers: [],
    demoLinks: {},
    discomfort: [],
    ...p,
    settings: { measureDay: 1, measureHour: 8, ...p.settings },
  }) as unknown as AppState;

export const set = (weight: number, reps: number, extra: Partial<LogSet> = {}): LogSet => ({ type: 'normal', weight, reps, ...extra });

/** Entreno que empieza `daysAgo` días antes de `now` y dura 1 h. */
export const workout = (now: number, daysAgo: number, exercises: { id: string; sets: LogSet[] }[], over: Partial<WorkoutLog> = {}): WorkoutLog => {
  const start = now - daysAgo * 86400000 - 3600000;
  return {
    id: `w${daysAgo}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Test',
    startTime: new Date(start).toISOString(),
    endTime: new Date(start + 3600000).toISOString(),
    durationSeconds: 3600,
    totalVolumeKg: 1000,
    caloriesBurned: 200,
    totalSets: exercises.reduce((a, e) => a + e.sets.length, 0),
    prsAchieved: 0,
    exercises: exercises.map((e) => ({ exerciseId: e.id, name: e.id, muscleGroup: 'Glúteos', sets: e.sets })),
    ...over,
  } as WorkoutLog;
};

export const at = (h: number, m = 0, dayOffset = 0): number => {
  const d = new Date(2026, 9, 7 + dayOffset, h, m, 0, 0); // miércoles 7 de octubre de 2026
  return d.getTime();
};
export const keyOf = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
