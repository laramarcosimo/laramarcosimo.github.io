import type { HabitDay } from './types';
import { dayKey } from './utils';

const DAY = 86_400_000;

/**
 * Último día (de los 3 anteriores a hoy) cuyos pasos quedaron vacíos o a 0, para avisar y dejar escribirlos a mano.
 * Solo avisa si ya usas los pasos (algún día de los últimos 30 tiene pasos) y si ese día no se descartó.
 */
export function missingStepsDay(habits: Record<string, HabitDay>, now: number, dismissed: string[] = []): string | null {
  const usesSteps = Array.from({ length: 30 }, (_, i) => dayKey(now - (i + 1) * DAY)).some((k) => (habits[k]?.steps ?? 0) > 0);
  if (!usesSteps) return null;
  for (let i = 1; i <= 3; i++) {
    const k = dayKey(now - i * DAY);
    if (!((habits[k]?.steps ?? 0) > 0) && !dismissed.includes(k)) return k;
  }
  return null;
}
