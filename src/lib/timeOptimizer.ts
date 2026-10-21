import { rankOf } from './audit';
import { isCardio } from './exercises';
import type { Exercise, WorkoutExercise } from './types';
import { autoRest } from './workout';

export type TimeMode = 'q45' | 'm50' | 'std' | 'x75' | 'free';

export const TIME_MODES: { id: TimeMode; label: string; target: number | null }[] = [
  { id: 'q45', label: '45 min (Rápido)', target: 45 },
  { id: 'm50', label: '50 min', target: 50 },
  { id: 'std', label: '60-70 min (Estándar habitual)', target: 65 },
  { id: 'x75', label: '+75 min', target: 75 },
  { id: 'free', label: 'Tiempo libre', target: null },
];

export const targetOf = (mode: TimeMode | undefined): number | null => TIME_MODES.find((m) => m.id === (mode ?? 'std'))?.target ?? null;

export const MODE_NOTE: Partial<Record<TimeMode, string>> = {
  m50: 'Rutina ajustada a 50 min: 3 series en ejercicios clave; último accesorio pospuesto.',
  q45: 'Sesión exprés de 45 min: solo los 3 ejercicios clave, a 3 series de máxima calidad. Los accesorios quedan opcionales.',
  x75: 'Sesión completa con descansos holgados. Al terminar te propongo cerrar con Face Yoga nocturno.',
};

const WORK_SEC = 45; // ~40-45 s de ejecución por serie
const WARMUP_MIN = 3;

/** Un ejercicio es «clave» si es un compuesto (orden 1-3); el resto son accesorios / aislamiento. */
const isKey = (ex: Exercise | undefined): boolean => !!ex && rankOf(ex.name, ex.muscleGroup) <= 3;
/** Prioridad entre claves: prensa y hip thrust primero. */
const prio = (ex: Exercise): number => (/prensa|press de piernas|hip thrust|empuje de caderas/i.test(ex.name) ? 0 : 1);

/** Descanso (s) de un ejercicio: el configurado, o con «descansos óptimos» 2,5 min en compuestos y 90 s en accesorios. */
export function restFor(w: WorkoutExercise, ex: Exercise | undefined, restDefault: number, restAuto: boolean, optimal: boolean): number {
  if (ex?.timed) return w.restSec ?? 20;
  if (optimal) return isKey(ex) ? 150 : 90;
  return w.restSec ?? (restAuto ? autoRest(ex, 'normal', restDefault) : restDefault);
}

/** Marca como omitidos los ejercicios que no caben según el modo. NUNCA reduce las series de los que se mantienen. */
export function applyTimeMode(list: WorkoutExercise[], mode: TimeMode, exOf: (id: string) => Exercise | undefined): WorkoutExercise[] {
  const done = (w: WorkoutExercise) => w.sets.some((s) => s.completed); // lo ya hecho nunca se omite
  const skip = new Set<string>();
  if (mode === 'q45') {
    const keys = list.map((w, i) => ({ w, i, ex: exOf(w.exerciseId) })).filter((x) => isKey(x.ex)).sort((a, b) => prio(a.ex!) - prio(b.ex!) || a.i - b.i);
    const keep = new Set(keys.slice(0, 3).map((x) => x.w.id));
    list.forEach((w) => !keep.has(w.id) && skip.add(w.id));
  } else if (mode === 'm50') {
    const acc = list.map((w, i) => ({ w, i, ex: exOf(w.exerciseId) })).filter((x) => !isKey(x.ex));
    const last = acc.sort((a, b) => b.i - a.i)[0];
    if (last) skip.add(last.w.id);
  }
  return list.map((w) => ({ ...w, skipped: skip.has(w.id) && !done(w) ? true : undefined }));
}

/**
 * Duración estimada (min): Σ series × 45 s de ejecución + el descanso de cada ejercicio tras cada serie (una vez por pareja en los de un lado,
 * una vez por ronda en las superseries) + cardio planificado + calentamiento de 3 min. Las series de calentamiento no cuentan.
 */
export function estimateMinutes(list: WorkoutExercise[], exOf: (id: string) => Exercise | undefined, restDefault: number, restAuto: boolean, optimal = false): number {
  let sec = WARMUP_MIN * 60;
  const seen = new Set<string>();
  const workSets = (w: WorkoutExercise): number => w.sets.filter((x) => x.type !== 'warmup').length;
  for (const w of list) {
    if (w.skipped) continue;
    const ex = exOf(w.exerciseId);
    // Cardio: sus minutos planificados (10 min por defecto), sin descansos entre series.
    if (isCardio(ex)) {
      sec += w.sets.reduce((a, x) => a + ((x.min ?? 0) > 0 ? (x.min as number) : 10) * 60, 0);
      continue;
    }
    // Superserie: los ejercicios se alternan y el descanso llega UNA vez al final de cada ronda.
    if (w.superset) {
      if (seen.has(w.superset)) continue;
      seen.add(w.superset);
      const group = list.filter((x) => x.superset === w.superset && !x.skipped);
      const rounds = Math.max(...group.map(workSets));
      const rest = Math.max(...group.map((x) => restFor(x, exOf(x.exerciseId), restDefault, restAuto, optimal)));
      sec += group.reduce((a, x) => a + workSets(x) * (exOf(x.exerciseId)?.timed ? 30 : WORK_SEC), 0) + rounds * rest;
      continue;
    }
    const rest = restFor(w, ex, restDefault, restAuto, optimal);
    const work = workSets(w);
    // Una pierna/brazo cada vez: el descanso llega tras la pareja (derecha + izquierda), no tras cada lado.
    const rests = w.unilateral ? Math.ceil(work / 2) : work;
    sec += work * (ex?.timed ? 30 : WORK_SEC) + rests * rest;
  }
  return Math.round(sec / 60);
}
