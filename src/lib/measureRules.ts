export type MeasureTone = 'good' | 'warn' | 'neutral';

/** Medidas que NO deben subir: cintura y barriga baja (grasa abdominal). */
export const SHRINK_GOOD: readonly string[] = ['waist', 'belly'];

/** Medidas donde subir es buena señal (más glúteo y músculo); lo malo es que bajen mucho. */
export const GROW_GOOD: readonly string[] = ['hip', 'thigh', 'arm', 'chest'];

/** Bajada (en cm) a partir de la cual se avisa en cadera, muslo, brazo y pecho. */
export const BIG_DROP_CM = 2;

/** Cambio mínimo (cm) que se considera real y no ruido de la cinta. */
export const MIN_CHANGE_CM = 0.5;

/**
 * Valora un cambio de medida (delta = ahora − antes).
 * - Cintura y barriga baja: bajar es bueno, subir es malo.
 * - Cadera, muslo, brazo y pecho: subir es bueno; solo es malo que bajen mucho.
 * - Peso y cualquier otra: sin valoración.
 */
export function measureTone(kind: string, delta: number): MeasureTone {
  if (SHRINK_GOOD.includes(kind)) {
    if (delta <= -MIN_CHANGE_CM) return 'good';
    if (delta >= MIN_CHANGE_CM) return 'warn';
    return 'neutral';
  }
  if (GROW_GOOD.includes(kind)) {
    if (delta >= MIN_CHANGE_CM) return 'good';
    if (delta <= -BIG_DROP_CM) return 'warn';
    return 'neutral';
  }
  return 'neutral';
}

/** Clase de color (Tailwind) para un cambio de medida. */
export const toneClass = (tone: MeasureTone): string =>
  tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-slate-400';
