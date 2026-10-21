import { isKneeUnsafe } from './knee';
import type { Exercise, HomeSpecs, Location, LogSet } from './types';

export const LOWER_BODY = ['Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos'];

/** Carga máxima disponible en casa para un ejercicio: kg, o null si no admite subir peso (bandas / peso corporal). undefined = gimnasio (sin límite). */
export const homeCap = (ex: Exercise | undefined, location: Location, sp: HomeSpecs): number | null | undefined => {
  if (location !== 'home') return undefined;
  if (ex?.equipment === 'Mancuernas') return sp.dumbbellKg;
  if (ex?.equipment === 'Kettlebell') return sp.kettlebellKg;
  if (ex?.equipment === 'Barra') return undefined; // con barra y discos el usuario decide la carga
  return null;
};

export interface TipInput {
  ex: Exercise | undefined;
  set: { type: string; weight: number; reps: number; rpe?: number };
  prev: LogSet[];
  location: Location;
  period: boolean;
  cap: number | null | undefined;
  /** Rango de repeticiones objetivo (alto). */
  topReps?: number;
  /** Descanso actual del ejercicio (s), para poder proponer reducirlo. */
  restNow?: number;
  /** Incremento de peso propuesto (kg). */
  step?: number;
  /** Ejercicio de máquina: los pesos suben por escalones fijos. */
  machine?: boolean;
}

export interface Tip {
  text: string;
  /** Descanso propuesto (s): permite un botón «Aplicar». */
  restTo?: number;
}

/** Consejo breve tras completar una serie, o null si no hace falta decir nada. */
export function liveTip({ ex, set, prev, location, period, cap, topReps = 12, restNow = 90, step = 2.5, machine = false }: TipInput): Tip | null {
  const t = (text: string, restTo?: number): Tip => ({ text, restTo });
  if (set.type === 'warmup' || set.reps <= 0) return null;
  // Máquinas: un salto mayor de 1,5 escalones respecto a tu última carga es brusco; se propone el siguiente escalón.
  const lastMax = Math.max(0, ...prev.filter((p) => p.type !== 'warmup').map((p) => p.weight));
  if (machine && set.type !== 'warmup' && lastMax > 0 && set.weight - lastMax > step * 1.5) {
    const nextStep = Math.round((lastMax + step) * 100) / 100;
    return t(`Salto brusco: de ${lastMax} a ${set.weight} kg (+${Math.round((set.weight - lastMax) * 100) / 100} kg). Mejor sube un solo escalón (${nextStep} kg) y asegura las reps antes de seguir.`);
  }
  const lower = LOWER_BODY.includes(ex?.muscleGroup ?? '');
  const sameWeight = prev.filter((p) => p.weight === set.weight && p.type !== 'warmup');
  const prevReps = sameWeight.length ? Math.max(...sameWeight.map((p) => p.reps)) : 0;
  const short = set.type === 'failure' || set.reps < 8 || (prevReps > 0 && set.reps < prevReps - 1);

  if (short) return t('Mantén la carga actual y consolida la técnica antes de buscar sobrecarga.');
  if (period) return t('Modo periodo: no busques récords hoy. Mantén el volumen, céntrate en la conexión mente-músculo y evita la fatiga articular.');

  // Con RPE: 10 = al límite (mantén); ≤6 = te sobra mucho margen.
  if (set.rpe !== undefined && set.rpe >= 10) return t('Serie al límite: mantén la carga y busca la misma calidad en las siguientes. No subas hasta que te cueste menos.');
  if (set.rpe !== undefined && set.rpe <= 6 && set.reps < topReps && !LOWER_BODY.includes(ex?.muscleGroup ?? '')) return t('Te sobra margen: añade 2 reps en la próxima serie o sube un poco la carga.');
  const margin = set.rpe === undefined || set.rpe <= 8;
  if (set.reps < topReps || !margin) return null;

  if (lower) return t('Tren inferior: antes de subir peso, baja en 3 s con una pausa de 1 s abajo (tiempo bajo tensión). Protege rodillas y tendones; sube carga la próxima sesión solo si mantienes el control.');

  if (location === 'home') {
    if (cap === undefined || (typeof cap === 'number' && set.weight < cap)) {
      const next = typeof cap === 'number' ? Math.min(cap, set.weight + step) : set.weight + step;
      return t(`¡Gran serie! Si tienes mancuerna más pesada, sube a ${next} kg; si no, haz la bajada en 3 s o suma 2 reps.`);
    }
    const to = Math.max(45, Math.round((restNow - 30) / 15) * 15);
    return t(`¡Gran serie! Ya usas tu carga máxima en casa: haz la bajada en 3 s (tempo excéntrico), aguanta 2 s en la máxima contracción, suma 2-4 reps o baja el descanso a ${to} s.`, to < restNow ? to : undefined);
  }
  const next = Math.round((set.weight + step) * 100) / 100;
  return t(set.weight > 0 ? `¡Vas con margen! Sube a ${next} kg o añade 1-2 reps para estimular la tonificación.` : '¡Vas con margen! Añade 2 reps o ralentiza la bajada a 3 s.');
}

/** Candidatos locales para sustituir un ejercicio: mismo músculo, sin impacto de rodilla y viables en casa. */
export const localAlternatives = (cur: Exercise, library: Exercise[], opts: { kneeSafe: boolean; feasible?: (e: Exercise) => boolean; allowed?: (name: string) => boolean }): Exercise[] =>
  library
    .filter((e) => e.id !== cur.id && e.muscleGroup === cur.muscleGroup && !(opts.kneeSafe && isKneeUnsafe(e.name)) && (!opts.feasible || opts.feasible(e)) && (!opts.allowed || opts.allowed(e.name)))
    .sort((a, b) => Number(b.equipment === cur.equipment) - Number(a.equipment === cur.equipment) || a.name.localeCompare(b.name));
