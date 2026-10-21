import { epley, noRecords } from './exercises';
import type { Exercise, Location, LogExercise, LogSet, PersonalRecords, Set as SetLog, SetType, TemplateSet, WorkoutLog } from './types';
import { rankOf } from './audit';
import { fmtKg, uid } from './utils';

export const SET_BADGE: Record<SetType, string> = { normal: '', warmup: 'W', dropset: 'D', failure: 'F' };
export const SET_TYPES: SetType[] = ['normal', 'warmup', 'dropset', 'failure'];
export const SET_LABEL: Record<SetType, string> = { normal: 'Normal', warmup: 'Calentamiento', dropset: 'Drop set', failure: 'Fallo' };

export const fmtPrev = (weight: number, reps: number, timed = false): string => (timed ? `${reps} s` : `${fmtKg(weight)} kg x ${reps}`);

export type PrevMark = '' | 'regla' | 'normal';

// El historial se ordena una sola vez por cada versión del array (el logger llama a esto muchas veces por render).
const sortedCache = new WeakMap<WorkoutLog[], WorkoutLog[]>();
const newestFirst = (workouts: WorkoutLog[]): WorkoutLog[] => {
  let r = sortedCache.get(workouts);
  if (!r) { r = [...workouts].sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime)); sortedCache.set(workouts, r); }
  return r;
};
export const exerciseSessions = (workouts: WorkoutLog[], exerciseId: string): WorkoutLog[] => logsWith(workouts, exerciseId);
const logsWith = (workouts: WorkoutLog[], exerciseId: string): WorkoutLog[] =>
  newestFirst(workouts).filter((w) => w.exercises.some((e) => e.exerciseId === exerciseId));

const workSets = (w: WorkoutLog | undefined, exerciseId: string): LogSet[] => w?.exercises.find((e) => e.exerciseId === exerciseId)?.sets.filter((s) => s.type !== 'warmup') ?? [];

/**
 * Referencia «Anterior» según el modo:
 *  - Con periodo: la última sesión que TAMBIÉN fue con periodo ("[Regla]"); si no hay, la última normal con un asterisco.
 *  - Sin periodo: la última sesión normal; si solo hay sesiones con periodo, esa, marcada.
 */
export const previousFor = (workouts: WorkoutLog[], exerciseId: string, period: boolean, templateId?: string): { sets: LogSet[]; mark: PrevMark } => {
  // Prefiere la última vez que hiciste ESTA rutina (p. ej. el martes pasado); si no hay, la última vez que hiciste el ejercicio.
  const all = logsWith(workouts, exerciseId);
  const mine = templateId ? all.filter((l) => l.templateId === templateId) : [];
  const logs = mine.length ? mine : all;
  const same = logs.find((l) => !!l.isPeriodSession === period);
  if (same) return { sets: workSets(same, exerciseId), mark: period ? 'regla' : '' };
  const other = logs[0];
  return { sets: workSets(other, exerciseId), mark: other ? (period ? 'normal' : 'regla') : '' };
};

/** Series de la última sesión normal registrada de un ejercicio (sin calentamiento). */
export const lastSession = (workouts: WorkoutLog[], exerciseId: string): LogSet[] => previousFor(workouts, exerciseId, false).sets;

/** Asigna a cada serie su referencia "anterior" según su posición entre las series de trabajo. */
export const withPrevious = (sets: SetLog[], prev: LogSet[], mark: PrevMark = '', timed = false): SetLog[] => {
  const n: Record<string, number> = {};
  const suffix = mark === 'regla' ? ' · Regla' : mark === 'normal' ? ' *' : '';
  return sets.map((s) => {
    if (s.type === 'warmup' || prev.length === 0) return { ...s, previous: undefined };
    // En ejercicios a una pierna, cada lado se compara con su mismo lado de la última vez.
    const key = s.side ?? '-';
    const pool = s.side && prev.some((x) => x.side === s.side) ? prev.filter((x) => x.side === s.side) : prev;
    const p = pool[Math.min(n[key] ?? 0, pool.length - 1)];
    n[key] = (n[key] ?? 0) + 1;
    const cardio = p.min !== undefined || p.km !== undefined;
    return { ...s, previous: (cardio ? `${p.min ?? 0} min · ${p.km ?? 0} km` : p.secs && !p.reps ? `${p.weight > 0 ? `${fmtKg(p.weight)} kg · ` : ''}${p.secs} s` : fmtPrev(p.weight, p.reps, timed)) + suffix };
  });
};

export const newSet = (type: SetType = 'normal', weight = 0, reps = 0): SetLog => ({ id: uid(), type, weight, reps, completed: false });

export const setsFromTemplate = (tpl: TemplateSet[], prev: LogSet[], mark: PrevMark = ''): SetLog[] => withPrevious(tpl.map((t) => ({ ...newSet(t.type, t.weight, t.reps), side: t.side, secs: t.secs, partials: t.partials })), prev, mark);

export const volumeOf = (sets: LogSet[], perHand = false): number => sets.filter((s) => s.type !== 'warmup').reduce((a, s) => a + s.weight * (perHand ? 2 : 1) * s.reps, 0);

export const logVolume = (exs: LogExercise[]): number => Math.round(exs.reduce((a, e) => a + volumeOf(e.sets, e.perHand), 0));

/** Mancuernas: ¿el kg escrito es el de cada mancuerna? Por defecto sí si el ejercicio es «con mancuernas» (plural); «con mancuerna» (una sola) se cuenta como peso total. */
export const perHandOf = (v: { perHand?: boolean }, ex?: Exercise): boolean => ex?.equipment === 'Mancuernas' && (v.perHand ?? /mancuernas/i.test(ex.name));

/** ¿La serie bate algún récord (peso máx., volumen de serie o 1RM estimado)? */
export const isPR = (ex: Exercise | undefined, s: { type: SetType; weight: number; reps: number }, others: LogSet[], location: Location = 'gym'): boolean => {
  if (location === 'home' || !ex || s.type === 'warmup' || s.weight <= 0 || s.reps <= 0) return false;
  const rec = ex.personalRecords;
  if (rec.maxWeight <= 0 && rec.maxVolume <= 0) return false; // primera vez: se registra sin trofeo
  const base = updateRecords(rec, others);
  return s.weight > base.maxWeight || s.weight * s.reps > base.maxVolume || epley(s.weight, s.reps) > base.best1RM;
};

export const updateRecords = (rec: PersonalRecords, sets: LogSet[]): PersonalRecords => {
  const r = { ...(rec ?? noRecords()) };
  for (const s of sets) {
    if (s.type === 'warmup' || s.weight <= 0 || s.reps <= 0) continue;
    r.maxWeight = Math.max(r.maxWeight, s.weight);
    r.maxVolume = Math.max(r.maxVolume, s.weight * s.reps);
    r.best1RM = Math.max(r.best1RM, epley(s.weight, s.reps));
  }
  return r;
};

export const hasPR = (e: Exercise): boolean => e.personalRecords.maxWeight > 0;

export const formatSetsLine = (sets: LogSet[]): string =>
  sets.map((s) => (s.min !== undefined || s.km !== undefined ? `${fmtKg(s.min ?? 0)} min · ${fmtKg(s.km ?? 0)} km${s.kcal ? ` · ${s.kcal} kcal` : ''}` : `${s.type === 'normal' ? '' : SET_BADGE[s.type] + ' '}${fmtKg(s.weight)}×${s.reps}`)).join(' · ');

export interface Suggestion { weight: number; reps: number; text: string }

/** Doble progresión (8–12 reps): si todas las series llegan a 12 sube carga y vuelve a 8; si no, mismo peso y +1 rep. Con periodo mantiene la carga. */
export const suggestNext = (workouts: WorkoutLog[], exerciseId: string, period: boolean, lower: boolean, deload = false, cap?: number | null, step = 2.5, templateId?: string): Suggestion | null => {
  const prev = previousFor(workouts, exerciseId, period, templateId).sets.filter((s) => s.weight > 0 && s.reps > 0);
  if (prev.length === 0) return null;
  const weight = Math.max(...prev.map((s) => s.weight));
  const top = prev.filter((s) => s.weight === weight);
  const minReps = Math.min(...top.map((s) => s.reps));
  if (deload) { const w2 = Math.round(weight * 0.9 * 2) / 2; return { weight: w2, reps: minReps, text: `Descarga: ${w2} kg × ${minReps} (−10 % de carga)` }; }
  if (period) return { weight, reps: minReps, text: `Sugerido: ${weight} kg × ${minReps} (mantén carga)` };
  if (minReps >= 12) {
    const w2 = Math.round((weight + step) * 100) / 100;
    // Casa: sin mancuerna más pesada (o con bandas / peso corporal) la progresión es por repeticiones, tempo o descanso.
    if (cap === null || (typeof cap === 'number' && w2 > cap)) return { weight, reps: Math.min(minReps + 2, 20), text: `Sugerido: ${weight} kg × ${Math.min(minReps + 2, 20)} (o bajada en 3 s)` };
    if (lower) return { weight, reps: minReps, text: `Sugerido: ${weight} kg × ${minReps} con bajada en 3 s (tempo)` };
    return { weight: w2, reps: 8, text: `Sugerido: ${w2} kg × 8` }; }
  const r = Math.max(minReps + 1, 8);
  return { weight, reps: r, text: `Sugerido: ${weight} kg × ${r}` };
};

/** Descanso recomendado: compuestos pesados largo, aislamiento corto, calentamiento mínimo. */
export const COMPOUND = /sentadilla|peso muerto|press|remo|dominada|zancada|hip thrust|empuje de caderas|prensa|fondos|dips|clean|swing|búlgara|bulgara|jalón al pecho/i;
export const autoRest = (ex: Exercise | undefined, setType: SetType, base: number): number => {
  if (setType === 'warmup') return 45;
  if (ex?.muscleGroup === 'Estiramientos') return 10; // transición entre posturas
  if (ex?.muscleGroup === 'Rostro y Cuello') return 20; // series cortas por tiempo
  if (!ex) return base;
  const compound = ex.equipment === 'Barra' || COMPOUND.test(ex.name);
  if (compound) return Math.round(base * 1.25 / 15) * 15;
  return Math.max(45, Math.round(base * 0.6 / 15) * 15);
};

/** Series de trabajo de una «ronda» (índice k): una serie, o la pareja D/I en unilaterales. */
export const roundSets = (we: { sets: SetLog[]; unilateral?: boolean }, k: number): SetLog[] => {
  const work = we.sets.filter((s) => s.type !== 'warmup');
  return we.unilateral ? work.slice(k * 2, k * 2 + 2) : work.slice(k, k + 1);
};
export const roundOf = (we: { sets: SetLog[]; unilateral?: boolean }, setId: string): number => {
  const i = we.sets.filter((s) => s.type !== 'warmup').findIndex((s) => s.id === setId);
  return i < 0 ? -1 : we.unilateral ? Math.floor(i / 2) : i;
};

/** ¿Las series de trabajo van estrictamente en parejas I, D, I, D…? */
export const isPaired = (sets: { type: SetType; side?: 'D' | 'I' }[]): boolean => {
  const w = sets.filter((s) => s.type !== 'warmup');
  return w.length % 2 === 0 && w.every((s, i) => s.side === (i % 2 === 0 ? 'I' : 'D'));
};

/**
 * Fuerza la estructura de un ejercicio unilateral: cada serie k son exactamente 2 filas, `kI` y `kD` (izquierda primero).
 * Si hay series sueltas, desparejadas o con un lado repetido, se reconstruyen las parejas conservando lo ya registrado.
 */
export const normalizePairs = <T extends { type: SetType; side?: 'D' | 'I' }>(sets: T[]): T[] => {
  if (isPaired(sets)) return sets;
  const warm = sets.filter((s) => s.type === 'warmup');
  const work = sets.filter((s) => s.type !== 'warmup');
  const L = work.filter((s) => s.side === 'I');
  const R = work.filter((s) => s.side !== 'I');
  const n = Math.max(L.length, R.length);
  const clone = (src: T, side: 'D' | 'I'): T => ({ ...src, ...('id' in src ? { id: uid() } : {}), side, ...('completed' in src ? { completed: false, pr: false } : {}) });
  const out: T[] = [];
  for (let k = 0; k < n; k++) {
    const l = L[k] ?? clone(R[k], 'I');
    const r = R[k] ?? clone(L[k], 'D');
    out.push({ ...l, side: 'I' }, { ...r, side: 'D' });
  }
  return [...warm, ...out];
};

/** Reordena cada pareja D+I a I+D: la pierna izquierda va siempre primero. */
export const leftFirst = <T extends { side?: 'D' | 'I' }>(sets: T[]): T[] => {
  const out = [...sets];
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i].side === 'D' && out[i + 1].side === 'I') {
      [out[i], out[i + 1]] = [out[i + 1], out[i]];
      i++;
    }
  }
  return out;
};

/** Convierte un ejercicio a/desde unilateral: cada serie pasa a pareja I+D (izquierda primero), o se queda con la D. */
export const toggleUnilateral = <T extends { sets: SetLog[]; unilateral?: boolean }>(we: T): T => {
  if (we.unilateral) return { ...we, unilateral: false, sets: we.sets.filter((s) => s.side !== 'I').map((s) => ({ ...s, side: undefined })) };
  const sets: SetLog[] = [];
  for (const s of we.sets) {
    if (s.type === 'warmup') sets.push(s);
    else {
      // Siempre empieza la pierna izquierda (lado débil): marca las reps objetivo y la derecha iguala.
      sets.push({ ...s, side: 'I' });
      sets.push({ ...s, id: uid(), side: 'D', completed: false, pr: false });
    }
  }
  return { ...we, unilateral: true, sets };
};

/** Semana de descarga: ~60 % de las series de trabajo (por parejas en unilaterales). */
export const reduceForDeload = <T extends { type: SetType; side?: 'D' | 'I' }>(sets: T[]): T[] => {
  const work = sets.filter((s) => s.type !== 'warmup');
  const paired = work.some((s) => s.side);
  const keep = paired ? Math.max(1, Math.ceil((work.length / 2) * 0.6)) * 2 : Math.max(1, Math.ceil(work.length * 0.6));
  let n = 0;
  return sets.filter((s) => s.type === 'warmup' || ++n <= keep);
};
export const deloadActive = (until?: number, now = Date.now()): boolean => !!until && until > now;

/** Estado de una superserie: ronda actual y a quién le toca. */
export const supersetStatus = (group: { id: string; sets: SetLog[]; unilateral?: boolean }[], id: string): { round: number; rounds: number; next: boolean; done: boolean } => {
  const rounds = Math.max(0, ...group.map((m) => Math.ceil(m.sets.filter((s) => s.type !== 'warmup').length / (m.unilateral ? 2 : 1))));
  const pending = (m: { sets: SetLog[]; unilateral?: boolean }, k: number) => { const r = roundSets(m, k); return r.length > 0 && r.some((x) => !x.completed); };
  let k = 0;
  while (k < rounds && !group.some((m) => pending(m, k))) k++;
  if (k >= rounds) return { round: rounds, rounds, next: false, done: true };
  const nextId = group.find((m) => pending(m, k))?.id;
  return { round: k + 1, rounds, next: nextId === id, done: false };
};

/** Incremento de peso razonable: 2,5 kg en compuestos; 1,25 kg en accesorios y 1 kg en mancuernas/kettlebell de aislamiento. */
export const weightStep = (ex: Exercise | undefined): number => {
  if (!ex) return 2.5;
  if (ex.stackStep) return ex.stackStep;
  if (rankOf(ex.name, ex.muscleGroup) <= 3) return 2.5;
  return ex.equipment === 'Mancuernas' || ex.equipment === 'Kettlebell' ? 1 : 1.25;
};

/** Clave de la semana (lunes a domingo) de una fecha. */
const weekKey = (iso: string): string => {
  const d = new Date(iso);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
/**
 * Si un entreno sin marcar queda entre dos sesiones con el periodo DE LA MISMA SEMANA (lunes a domingo), por lógica
 * también lo tenía: se marca solo, como si hubieras pulsado «modo periodo». Si entre medias cambia la semana, no se aplica.
 */
export const fillPeriodGaps = (workouts: WorkoutLog[]): WorkoutLog[] => {
  const asc = [...workouts].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  const marked = new Set<string>();
  asc.forEach((w, i) => {
    if (w.isPeriodSession) return;
    let before: WorkoutLog | undefined;
    let after: WorkoutLog | undefined;
    for (let j = i - 1; j >= 0 && !before; j--) if (asc[j].isPeriodSession) before = asc[j];
    for (let j = i + 1; j < asc.length && !after; j++) if (asc[j].isPeriodSession) after = asc[j];
    if (before && after) {
      const k = weekKey(w.startTime);
      if (weekKey(before.startTime) === k && weekKey(after.startTime) === k) marked.add(w.id);
    }
  });
  return marked.size ? workouts.map((w) => (marked.has(w.id) ? { ...w, isPeriodSession: true, periodAuto: true } : w)) : workouts;
};
