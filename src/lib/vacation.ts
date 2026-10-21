import type { Exercise, RoutineTemplate, Settings, TemplateSet } from './types';

export const VACATION_ID = 'vacation-routine';
export const VACATION_MINUTES = [5, 10, 12, 15] as const;
const DAY = 86_400_000;

interface Circuit {
  name: string;
  ids: string[];
}

/** Cuatro circuitos de mantenimiento sin material (rotan cada día): ninguno usa saltos ni ejercicios a una pierna. */
export const CIRCUITS: Circuit[] = [
  { name: 'Cuerpo entero', ids: ['Bodyweight_Squat', 'Pushups', 'Butt_Lift_Bridge', 'Superman', 'Plank', 'deadbug', 'Reverse_Crunch'] },
  { name: 'Glúteo y core', ids: ['Butt_Lift_Bridge', 'wall-sit', 'Push-Up_Wide', 'deadbug', 'Russian_Twist', 'Superman', 'Plank'] },
  { name: 'Empuje y espalda suave', ids: ['Pushups', 'Superman', 'Bodyweight_Squat', 'Reverse_Crunch', 'Plank', 'Butt_Lift_Bridge', 'Crunches'] },
  { name: 'Pierna y core', ids: ['Bodyweight_Squat', 'wall-sit', 'Butt_Lift_Bridge', 'Plank', 'Russian_Twist', 'Pushups', 'deadbug'] },
];

/** Con la rodilla delicada, la sentadilla se sustituye por el box squat a silla. */
const KNEE_SAFE_SWAP: Record<string, string> = { Bodyweight_Squat: 'chair-box-squat' };

/** Circuito que toca hoy: rota con el día del año, más el desplazamiento que haya elegido («Otro circuito»). */
export const circuitIndex = (shift = 0, now = Date.now()): number => {
  const d = new Date(now);
  const doy = Math.floor((now - new Date(d.getFullYear(), 0, 0).getTime()) / DAY);
  return (((doy + shift) % CIRCUITS.length) + CIRCUITS.length) % CIRCUITS.length;
};

/** Rondas y ejercicios para ocupar ≈ `minutes` minutos (cada serie ≈ 40 s de trabajo + 20 s de descanso). */
export const vacationPlan = (minutes: number): { exercises: number; rounds: number } => {
  if (minutes <= 6) return { rounds: 1, exercises: 5 };
  const rounds = minutes >= 14 ? 3 : 2;
  return { rounds, exercises: Math.min(7, Math.max(4, Math.round(minutes / rounds))) };
};

/** Rutina de mantenimiento de vacaciones: se rehace cada vez según los minutos que tengas ese día y el circuito de hoy. */
export function buildVacationTemplate(minutes: number, kneeSafe: boolean, library: Exercise[], circuit = 0): RoutineTemplate {
  const { rounds, exercises: n } = vacationPlan(minutes);
  const c = CIRCUITS[circuit % CIRCUITS.length];
  const byId = new Map(library.map((e) => [e.id, e]));
  const picked = c.ids
    .slice(0, n)
    .map((id) => (kneeSafe && KNEE_SAFE_SWAP[id] ? KNEE_SAFE_SWAP[id] : id))
    .map((id) => byId.get(id))
    .filter((e): e is Exercise => !!e);
  return {
    id: VACATION_ID,
    title: `Vacaciones · ${minutes} min`,
    notes: `Circuito: ${c.name}. Mantenimiento sin material, sin prisa y sin llegar al fallo.`,
    exercises: picked.map((e) => ({
      exerciseId: e.id,
      restSec: 20,
      sets: Array.from({ length: rounds }, (): TemplateSet => ({ type: 'normal', weight: 0, reps: e.timed ? 30 : 12 })),
    })),
  };
}

/** Activa o desactiva las vacaciones anotando el periodo (para que esas semanas no rompan la racha semanal). */
export const vacationPatch = (st: Settings, on: boolean, now = Date.now()): Partial<Settings> => {
  const log = [...(st.vacationLog ?? [])];
  const open = log.length > 0 && log[log.length - 1].to === undefined;
  if (on && !open) log.push({ from: now });
  if (!on && open) log[log.length - 1] = { ...log[log.length - 1], to: now };
  const patch: Partial<Settings> = { vacation: on, vacationLog: log };
  // Vacaciones de más de 2 semanas: al volver, una semana de readaptación (descarga: menos series y sin llegar al fallo).
  if (!on && open && now - log[log.length - 1].from >= 14 * DAY) patch.deloadUntil = now + 7 * DAY;
  return patch;
};

/** ¿La semana que empieza en `weekStartTs` toca algún periodo de vacaciones? */
export const isVacationWeek = (st: Settings, weekStartTs: number): boolean =>
  (st.vacationLog ?? []).some((p) => p.from < weekStartTs + 7 * DAY && (p.to ?? Infinity) >= weekStartTs) || (!!st.vacation && (st.vacationLog ?? []).length === 0);
