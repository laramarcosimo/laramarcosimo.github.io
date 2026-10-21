import type { AppState, RoutineTemplate } from './types';
import { norm } from './utils';

const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/** Rutina que toca hoy: si el nombre de alguna incluye el día de la semana actual (p. ej. «Martes»), esa; si no, la que lleva más tiempo sin hacerse (o nunca hecha), para ir rotando. */
export const nextRoutine = (s: AppState): RoutineTemplate | undefined => {
  if (s.templates.length === 0) return undefined;
  const day = DAYS[new Date().getDay()];
  const byDay = s.templates.find((t) => new RegExp(`\\b${day}\\b`).test(norm(t.title)));
  if (byDay) return byDay;
  const last = (t: RoutineTemplate): number => Math.max(0, ...s.workouts.filter((w) => w.title === t.title || w.title.startsWith(t.title)).map((w) => Date.parse(w.startTime)));
  return [...s.templates].sort((a, b) => last(a) - last(b))[0];
};
