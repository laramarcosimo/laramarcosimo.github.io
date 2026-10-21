import type { MuscleGroup } from './types';

const LEGS: MuscleGroup[] = ['Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos'];
const ARMS: MuscleGroup[] = ['Bíceps', 'Tríceps'];

/** Duración estimada: cada serie ≈ 45 s de trabajo + su descanso, más 5 min de calentamiento (las unilaterales cuentan doble). */
export const estimateMinutes = (items: { series: number; descanso: number; unilateral?: boolean }[]): number =>
  Math.round(5 + items.reduce((t, e) => t + (e.series * (e.unilateral ? 2 : 1) * (45 + e.descanso)) / 60, 0));

/** Tiempo máximo de la sesión: 60 min si es de pierna, 45 min si es de brazo; null en el resto. */
export const timeLimit = (title: string, muscles: string[]): number | null => {
  const t = title.toLowerCase();
  const share = (g: MuscleGroup[]) => (muscles.length ? muscles.filter((m) => (g as string[]).includes(m)).length / muscles.length : 0);
  if (/brazo|bíceps|biceps|tríceps|triceps/.test(t) || share(ARMS) >= 0.4) return 45;
  if (/pierna|glúteo|gluteo|cuádriceps|cuadriceps/.test(t) || share(LEGS) >= 0.5) return 60;
  return null;
};
