import { exerciseSessions, previousFor } from './workout';
import type { LogSet, WorkoutLog } from './types';

export interface Progression {
  kind: 'raise' | 'stall' | 'lower';
  /** Texto del aviso. */
  text: string;
  /** Peso sugerido (al subir o al bajar). */
  weight?: number;
  reps?: number;
  /** Resumen del histórico para el plan de desbloqueo. */
  history?: string;
}

/** Rango de repeticiones escrito en las notas del ejercicio («10-12 reps»); si no hay, 8-12. */
export const repRange = (notes?: string): [number, number] => {
  const m = notes?.match(/(\d{1,2})\s*[-–a]\s*(\d{1,2})/);
  return m ? [Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2])] : [8, 12];
};

const work = (sets: LogSet[]): LogSet[] => sets.filter((s) => s.type !== 'warmup' && s.weight > 0 && s.reps > 0);
const top = (sets: LogSet[]): { weight: number; reps: number } | null => {
  const w = work(sets);
  if (w.length === 0) return null;
  const weight = Math.max(...w.map((s) => s.weight));
  return { weight, reps: Math.max(...w.filter((s) => s.weight === weight).map((s) => s.reps)) };
};
const better = (a: { weight: number; reps: number }, b: { weight: number; reps: number }): boolean => a.weight > b.weight || (a.weight === b.weight && a.reps > b.reps);

/** Consejo protector cuando la carga fue excesiva. */
export const LOWER_TEXT = '🛡️ Consejo del Coach: Hoy la carga era excesiva para mantener la técnica limpia. Te sugiero bajar entre -1 kg y -2.5 kg en la siguiente serie/sesión para proteger tus articulaciones y asegurar el estímulo correcto.';

/** Series con carga que no se pudo sostener: por debajo del mínimo del rango de reps, o marcadas «Al límite» (RPE 10) / fallo. */
export const struggledSets = (sets: { type: LogSet['type']; weight: number; reps: number; rpe?: number }[], lo: number): typeof sets =>
  sets.filter((s) => s.type !== 'warmup' && s.weight > 0 && s.reps > 0 && (s.reps < lo || s.rpe === 10 || s.type === 'failure'));

/** Cuánto bajar: entre 1 y 2,5 kg (en máquina, un escalón); nunca por debajo de 0. */
export const lowerTo = (weight: number, step: number, machine: boolean): number => {
  const dec = machine ? Math.max(1, step) : Math.min(2.5, Math.max(1, step));
  return Math.max(0, Math.round((weight - dec) * 100) / 100);
};

/**
 * Sobrecarga progresiva (doble progresión):
 *  - «lower»: la sesión actual o la anterior se quedó por debajo del mínimo del rango, o hubo series al límite (RPE 10 / fallo) → bajar 1-2,5 kg.
 *  - «raise»: en la última sesión de este ejercicio todas las series con la carga máxima llegaron al tope del rango → subir peso (+1 a +2,5 kg).
 *  - «stall»: las dos últimas sesiones no mejoraron a la anterior (mismo peso y mismas reps, o menos) y pasaron ≥ 10 días → aviso de estancamiento.
 */
export function analyzeProgression(workouts: WorkoutLog[], exerciseId: string, name: string, notes: string | undefined, step: number, templateId?: string, deload = false, machine = false): Progression | null {
  if (deload) return null;
  const [lo, hi] = repRange(notes);
  const prev = work(previousFor(workouts, exerciseId, false, templateId).sets);
  // Prioridad: proteger. Si la última sesión no se pudo sostener, se baja antes que subir.
  const bad = struggledSets(prev, lo);
  if (bad.length > 0) {
    const w = Math.max(...bad.map((s) => s.weight));
    return { kind: 'lower', weight: lowerTo(w, step, machine), reps: lo, text: LOWER_TEXT, history: `${name}: ${bad.map((s) => `${s.weight} kg × ${s.reps}${s.rpe === 10 ? ' (al límite)' : ''}`).join(', ')} (rango objetivo ${lo}-${hi}).` };
  }
  if (prev.length >= 3) {
    const w = Math.max(...prev.map((s) => s.weight));
    const atMax = prev.filter((s) => s.weight === w);
    if (atMax.length >= 3 && atMax.every((s) => s.reps >= hi) && !prev.some((s) => s.rpe === 10)) {
      const inc = machine ? step : Math.min(2.5, Math.max(1, step));
      const next = Math.round((w + inc) * 100) / 100;
      const lowA = Math.max(lo, hi - 4);
      const lowB = Math.max(lowA, hi - 2);
      const got = Math.min(...atMax.map((s) => s.reps));
      return {
        kind: 'raise',
        weight: next,
        reps: lowA,
        text: `🚀 ¡Hora de subir peso! En la última sesión dominaste ${got >= hi ? `${hi}+` : got} reps en las ${atMax.length} series con ${w} kg. ${machine ? `Hoy sube un solo escalón de la máquina: ${next} kg (+${inc} kg)` : `Hoy aumenta entre +1 kg y +2.5 kg (sugerido ${next} kg)`} y busca el rango bajo (${lowA === lowB ? lowA : `${lowA}-${lowB}`} reps).`,
      };
    }
  }
  const sessions = exerciseSessions(workouts, exerciseId).slice(0, 3);
  if (sessions.length === 3) {
    const t = sessions.map((s) => top(s.exercises.find((e) => e.exerciseId === exerciseId)?.sets ?? []));
    if (t[0] && t[1] && t[2] && !better(t[0], t[1]) && !better(t[1], t[2]) && (Date.parse(sessions[0].startTime) - Date.parse(sessions[2].startTime)) / 86400000 >= 10) {
      return {
        kind: 'stall',
        text: '⚠️ Estancamiento detectado (mismo peso/reps las últimas semanas).',
        history: `${name}: ${t.map((x) => `${x!.weight} kg × ${x!.reps}`).reverse().join(' → ')} (de la más antigua a la última sesión).`,
      };
    }
  }
  return null;
}
