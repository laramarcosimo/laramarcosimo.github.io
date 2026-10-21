import type { Location, WorkoutLog } from './types';
import { dayKey } from './utils';

const DAY = 86400000;

/** Lunes de la semana de la fecha (00:00 local). */
export const weekStart = (ts: number): number => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
};

export const locationOf = (w: WorkoutLog): Location => w.location ?? 'gym';

export const byDay = (workouts: WorkoutLog[]): Map<string, WorkoutLog[]> => {
  const m = new Map<string, WorkoutLog[]>();
  for (const w of workouts) {
    const k = dayKey(Date.parse(w.startTime));
    m.set(k, [...(m.get(k) ?? []), w]);
  }
  return m;
};

/** Días consecutivos entrenados. Si hoy aún no has entrenado, la racha sigue viva desde ayer. */
export const currentDayStreak = (days: Map<string, WorkoutLog[]>, today = Date.now()): number => {
  let t = new Date(today).setHours(12, 0, 0, 0);
  if (!days.has(dayKey(t))) t -= DAY;
  let n = 0;
  while (days.has(dayKey(t))) {
    n++;
    t -= DAY;
  }
  return n;
};

/** Semanas consecutivas con ≥ `goal` días entrenados. La semana en curso no rompe la racha si aún no llega. */
export const weeklyStreak = (days: Map<string, WorkoutLog[]>, goal: number, today = Date.now(), paused?: (weekStartTs: number) => boolean): number => {
  const count = (ws: number): number => {
    let c = 0;
    for (let i = 0; i < 7; i++) if (days.has(dayKey(ws + i * DAY + DAY / 2))) c++;
    return c;
  };
  let ws = weekStart(today);
  let n = 0;
  if (!paused?.(ws) && count(ws) >= goal) n++;
  ws -= 7 * DAY;
  // 7*DAY puede desajustar en cambios horarios: se recoloca en el lunes real.
  ws = weekStart(ws + DAY / 2);
  for (let guard = 0; guard < 520; guard++) {
    if (paused?.(ws)) { ws = weekStart(ws - DAY / 2); continue; } // semana de vacaciones: ni suma ni rompe la racha
    if (count(ws) < goal) break;
    n++;
    ws = weekStart(ws - DAY / 2);
  }
  return n;
};

/** Ubicación dominante de un día (si hubo ambas, gimnasio). */
export const dayLocation = (list: WorkoutLog[] | undefined): Location | null => (!list || list.length === 0 ? null : list.some((w) => locationOf(w) === 'gym') ? 'gym' : 'home');

/** Días seguidos con la rutina facial hecha. Si hoy aún no la has hecho, la racha sigue viva desde ayer. */
export const faceStreak = (habits: Record<string, { faceYoga?: boolean } | undefined>, today = Date.now()): number => {
  let t = new Date(today).setHours(12, 0, 0, 0);
  if (!habits[dayKey(t)]?.faceYoga) t -= DAY;
  let n = 0;
  while (habits[dayKey(t)]?.faceYoga) {
    n++;
    t -= DAY;
  }
  return n;
};

/** Hora del aviso de la rutina facial como {h, m}. */
export const faceTimeOf = (s: { faceTime?: string }): { h: number; m: number } => {
  const [h, m] = (s.faceTime ?? '22:30').split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 22, m: Number.isFinite(m) ? m : 30 };
};
