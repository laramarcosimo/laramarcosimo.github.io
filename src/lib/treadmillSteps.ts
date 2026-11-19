import { isCardio } from './exercises';
import type { AppState } from './types';
import { dayKey } from './utils';

/** Pasos por km caminando: zancada ≈ 0,413 × altura. */
export const stepsPerKm = (heightCm: number): number => {
  const h = heightCm > 100 && heightCm < 230 ? heightCm : 165;
  return Math.round(100000 / (h * 0.413));
};

/** Km de cinta (cardio con distancia) de un día. */
export const treadmillKm = (s: Pick<AppState, 'workouts'>, key: string): number => {
  let km = 0;
  for (const w of s.workouts) {
    if (dayKey(Date.parse(w.startTime)) !== key) continue;
    for (const e of w.exercises) {
      if (!isCardio({ id: e.exerciseId, name: e.name })) continue;
      for (const st of e.sets) km += st.km && st.km > 0 ? st.km : 0;
    }
  }
  return Math.round(km * 100) / 100;
};

/** Pasos estimados por la cinta ese día (0 si está desactivado). */
export const treadmillSteps = (s: Pick<AppState, 'workouts' | 'profile' | 'settings'>, key: string): number => {
  if (s.settings.noTreadmillSteps) return 0;
  return Math.round(treadmillKm(s, key) * stepsPerKm(s.profile.height));
};
