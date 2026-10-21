import type { AppState, Exercise } from './types';

/** Nombres de ejercicios que en realidad son estiramientos o yoga y no deberían contarse por repeticiones y peso. */
export const STRETCH_NAME = /estir|stretch|cobra|paloma|mariposa|postura|gato.?vaca|figura 4|yoga|movilidad|child.?s pose|pigeon/i;

export const isMisfiledStretch = (e: Pick<Exercise, 'name' | 'muscleGroup' | 'timed'>): boolean => e.muscleGroup === 'Abdominales' && STRETCH_NAME.test(e.name);

/** Pasa los estiramientos guardados en Abdominales al grupo «Estiramientos», medidos por segundos. Devuelve las mismas referencias si no hay nada que mover. */
export function moveStretches(list: Exercise[]): { exercises: Exercise[]; movedIds: Set<string> } {
  const movedIds = new Set<string>();
  const exercises = list.map((e) => {
    if (!isMisfiledStretch(e)) return e;
    movedIds.add(e.id);
    return { ...e, muscleGroup: 'Estiramientos' as const, timed: true };
  });
  return { exercises: movedIds.size ? exercises : list, movedIds };
}

/** En rutinas ya guardadas, las series de esos ejercicios pasan a segundos (30 s, sin peso) en vez de repeticiones. */
export function stretchSets(templates: AppState['templates'], ids: Set<string>): AppState['templates'] {
  if (ids.size === 0) return templates;
  let changed = false;
  const out = templates.map((t) => ({
    ...t,
    exercises: t.exercises.map((e) => {
      if (!ids.has(e.exerciseId)) return e;
      if (e.sets.every((s) => s.weight === 0 && s.reps >= 15)) return e; // ya está en segundos
      changed = true;
      return { ...e, sets: e.sets.map((s) => ({ ...s, weight: 0, reps: 30 })) };
    }),
  }));
  return changed ? out : templates;
}
