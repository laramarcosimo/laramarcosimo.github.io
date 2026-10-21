import type { AppState, Settings, Exercise, Goal, LogExercise, Meal, Profile, WorkoutLog } from './types';
import { dayKey } from './utils';

/** Mifflin-St Jeor (kcal/día). */
export const bmr = (p: Profile): number => 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'M' ? 5 : -161);

/** Ajuste fijo (kcal) por objetivo; la recomposición usa un porcentaje del gasto total (ver `goalAdjust`). */
export const GOAL_ADJUST: Record<Goal, number> = { recomp: 0, deficit: -450, maintain: 0, surplus: 300 };
export const RECOMP_DEFICIT = 0.175; // -15 % a -20 % del gasto energético total
/** Rango de proteína: 1,8-2,2 g por kg de peso (igual para todos los objetivos). */
export const PROTEIN_MIN_PER_KG = 1.8;
export const PROTEIN_MAX_PER_KG = 2.2;

export const goalAdjust = (p: Profile): number => (p.goal === 'recomp' ? -Math.round(bmr(p) * p.activity * RECOMP_DEFICIT) : GOAL_ADJUST[p.goal]);

export const ACTIVITY_LEVELS: { value: number; label: string }[] = [
  { value: 1.2, label: 'Sedentario (oficina, sin pasos)' },
  { value: 1.3, label: 'Ligero (algo de movimiento)' },
  { value: 1.4, label: 'Activo (de pie / muchos pasos)' },
  { value: 1.55, label: 'Muy activo (trabajo físico)' },
];

export const baseTarget = (p: Profile): number => Math.round(bmr(p) * p.activity + goalAdjust(p));
export const proteinRange = (p: Profile): { min: number; max: number; mid: number } => ({
  min: Math.round(p.weight * PROTEIN_MIN_PER_KG),
  max: Math.round(p.weight * PROTEIN_MAX_PER_KG),
  mid: Math.round(p.weight * ((PROTEIN_MIN_PER_KG + PROTEIN_MAX_PER_KG) / 2)),
});
/** Meta mínima de proteína (peso × 1,8): al llegar a ella se da por cumplida. */
export const proteinTarget = (p: Profile): number => proteinRange(p).min;

/**
 * Estimación de calorías de una sesión de fuerza (método MET):
 *  kcal = MET × peso(kg) × horas × 1.06 (EPOC)
 *  MET = 3.5 (esfuerzo ligero) … 6.5 (muy denso), según la densidad de volumen (kg levantados / min).
 */
export const estimateKcal = (weightKg: number, durationSec: number, volumeKg: number): number => {
  const minutes = Math.max(durationSec / 60, 1);
  const density = volumeKg / minutes;
  const met = Math.min(6.5, Math.max(3.5, 3.5 + density / 80));
  return Math.round(met * weightKg * (minutes / 60) * 1.06);
};

/** Gasto típico de una sesión: media de tus últimos 5 entrenos de al menos 20 min o, sin historial válido, una sesión estándar de 60 min. */
export const typicalSessionKcal = (s: AppState): number => {
  const last = s.workouts.filter((w) => w.durationSeconds >= 1200).sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime)).slice(0, 5);
  return last.length ? Math.round(last.reduce((a, w) => a + w.caloriesBurned, 0) / last.length) : estimateKcal(s.profile.weight, 3600, 5000);
};

/** Pauta fija de recomposición: 1.600-1.800 kcal/día con 100 g de proteína, 60 g de grasa y 220 g de carbohidratos. */
export const FIXED_PLAN = { kcalMin: 1600, kcalMax: 1800, kcal: 1700, protein: 100, fat: 60, carbs: 220 } as const;
/** Día de descanso: 1.700-1.800 kcal y 195-220 g de carbohidratos (proteína y grasa iguales). */
export const REST_PLAN = { kcalMin: 1700, kcalMax: 1800, kcal: 1750, protein: 100, fat: 60, carbsMin: 195, carbs: 220 } as const;
/** Rango de proteína (g) según Ajustes; por defecto mínimo 100 y techo 120. */
export const proteinGoal = (st: Settings): { min: number; max: number; mid: number } => {
  const r = st.proteinRange ?? { min: FIXED_PLAN.protein, max: FIXED_PLAN.protein + 20 };
  const lo = Math.max(30, Math.round(Math.min(r.min, r.max)));
  const hi = Math.max(lo, Math.round(Math.max(r.min, r.max)));
  return { min: lo, max: hi, mid: Math.round((lo + hi) / 2) };
};
export interface GRange {
  min: number;
  max: number;
}
const fixR = (r: GRange): GRange => {
  const lo = Math.max(0, Math.round(Math.min(r.min, r.max)));
  return { min: lo, max: Math.max(lo, Math.round(Math.max(r.min, r.max))) };
};
/**
 * Baremo de grasas y de carbohidratos (g/día): mínimo y máximo escritos en Ajustes; los carbohidratos tienen uno para días de
 * entreno y otro para días sin entreno. Sin escribir, los de la pauta (grasa 50-60, carbohidratos 200-220 y 195-220 en descanso).
 * Los valores sueltos de la versión anterior (fatTarget / carbsTarget) se leen como máximo.
 */
export const macroGoal = (st: Settings, training = true): { fat: GRange; carbs: GRange } => {
  const oldFat = st.fatTarget && st.fatTarget > 0 ? Math.round(st.fatTarget) : 0;
  const oldCarbs = st.carbsTarget && st.carbsTarget > 0 ? Math.round(st.carbsTarget) : 0;
  const fat = st.fatRange ? fixR(st.fatRange) : oldFat ? { min: Math.max(0, oldFat - 10), max: oldFat } : { min: 50, max: FIXED_PLAN.fat };
  const own = training ? st.carbsRange : st.carbsRestRange;
  const carbs = own ? fixR(own) : oldCarbs ? { min: Math.max(0, oldCarbs - 20), max: oldCarbs } : training ? { min: 200, max: FIXED_PLAN.carbs } : { min: REST_PLAN.carbsMin, max: REST_PLAN.carbs };
  return { fat, carbs };
};
const rg = (r: GRange): string => (r.min === r.max ? `${r.max}` : `${r.min}-${r.max}`);

/** Rango de kcal del día según el tipo de día y lo que hayas puesto en Ajustes. */
export const kcalRange = (st: Settings, training: boolean): { min: number; max: number } => {
  const r = training ? (st.kcalTrain ?? { min: FIXED_PLAN.kcalMin, max: FIXED_PLAN.kcalMax }) : (st.kcalRest ?? { min: REST_PLAN.kcalMin, max: REST_PLAN.kcalMax });
  const lo = Math.max(800, Math.min(r.min, r.max));
  return { min: lo, max: Math.max(lo, r.min, r.max) };
};

/** Texto de objetivo para los prompts de Gemini, con los rangos actuales de entreno y descanso. */
export const planText = (st: Settings): string => {
  const t = kcalRange(st, true);
  const r = kcalRange(st, false);
  const p = proteinGoal(st);
  const mt = macroGoal(st, true);
  const mr = macroGoal(st, false);
  return `BAREMO NUTRICIONAL DEL USUARIO (es la única fuente de cifras). Día de ENTRENO: ${t.min}-${t.max} kcal, ${p.min}-${p.max} g de proteína, ${rg(mt.fat)} g de grasa y ${rg(mt.carbs)} g de carbohidratos. Día de DESCANSO (sin entreno): ${r.min}-${r.max} kcal, ${p.min}-${p.max} g de proteína, ${rg(mr.fat)} g de grasa y ${rg(mr.carbs)} g de carbohidratos. Toda recomendación de comidas, menús o recetas debe ajustarse estrictamente a los rangos del día que toca. REGLA DEL RANGO: llegar al MÍNIMO de kcal y de proteína es OBLIGATORIO (un déficit agresivo frena el glúteo y el metabolismo) y es la prioridad de cada propuesta; el MÁXIMO es un techo seguro pero NO obligatorio: cualquier total entre el mínimo y el máximo es óptimo. REGLA DE MACROS (precisión): los gramos de carbohidratos y de grasa del día deben acabar DENTRO de su baremo (entre mínimo y máximo); el máximo de grasa y de carbohidratos NO se supera. Calcula siempre gramo a gramo con las tablas de composición y suma los macros de cada plato antes de responder; no redondees a ojo.`;
};

export type KcalState = 'below' | 'ok' | 'over';

export interface KcalStatus {
  state: KcalState;
  /** below: kcal que faltan para el mínimo · over: kcal por encima del máximo · ok: 0. */
  delta: number;
  /** Cuánto cabe aún hasta el máximo (opcional). */
  headroom: number;
}

/**
 * Rango flexible: llegar al MÍNIMO es obligatorio (evita déficits agresivos); el MÁXIMO es un techo seguro pero opcional.
 * Entre el mínimo y el máximo (ambos incluidos) el día está ÓPTIMO.
 */
export const kcalStatus = (eaten: number, kcalMin: number, kcalMax: number): KcalStatus => {
  if (eaten < kcalMin) return { state: 'below', delta: kcalMin - eaten, headroom: kcalMax - eaten };
  if (eaten > kcalMax) return { state: 'over', delta: eaten - kcalMax, headroom: 0 };
  return { state: 'ok', delta: 0, headroom: kcalMax - eaten };
};

export interface DayBalance {
  base: number;
  burned: number;
  target: number;
  eaten: number;
  remaining: number;
  /** Mínimo del rango (peso × 1,8): meta que da por cumplida la proteína. */
  proteinTarget: number;
  /** Máximo del rango (peso × 2,2). */
  proteinMax: number;
  /** Punto medio (peso × 2,0), usado para repartir carbohidratos y grasas. */
  proteinMid: number;
  proteinEaten: number;
  proteinRemaining: number;
  carbs: number;
  fat: number;
  /** Hoy es día de entreno (marcado en Ajustes o ya has entrenado). */
  trainingDay: boolean;
  kcalMin: number;
  kcalMax: number;
  carbsTarget: number;
  carbsMin: number;
  fatTarget: number;
  /** Mínimo del baremo de grasas (fatTarget es el máximo). */
  fatMin: number;
  /** Ya hay un entreno registrado hoy. */
  trained: boolean;
}

export const dayBalance = (s: AppState, key: string = dayKey()): DayBalance => {
  const todays: WorkoutLog[] = s.workouts.filter((w) => dayKey(Date.parse(w.startTime)) === key);
  const burned = todays.reduce((a, w) => a + w.caloriesBurned, 0);
  const planned = s.settings.trainDays ? s.settings.trainDays.includes(new Date(`${key}T12:00:00`).getDay()) : false;
  const meals: Meal[] = s.meals.filter((m) => dayKey(m.ts) === key);
  const eaten = meals.reduce((a, m) => a + m.calorias, 0);
  const proteinEaten = meals.reduce((a, m) => a + m.proteinas, 0);
  const pg = proteinGoal(s.settings);
  const pt = pg.min;
  // El tipo de día lo marcas en Ajustes (aunque entrenes un día de descanso, cuenta como descanso); sin configurar, se deduce de los entrenos.
  const trainingDay = s.settings.trainDays ? planned : todays.length > 0;
  const kr = kcalRange(s.settings, trainingDay);
  const plan = { kcalMin: kr.min, kcalMax: kr.max, kcal: Math.round((kr.min + kr.max) / 2), carbsMin: macroGoal(s.settings, trainingDay).carbs.min };
  const base = plan.kcal;
  return {
    base,
    burned,
    target: base,
    eaten,
    remaining: base - eaten,
    proteinTarget: pt,
    proteinMax: pg.max,
    proteinMid: pg.mid,
    proteinEaten,
    proteinRemaining: pt - proteinEaten,
    carbs: meals.reduce((a, m) => a + m.carbs, 0),
    fat: meals.reduce((a, m) => a + m.grasas, 0),
    trainingDay,
    kcalMin: plan.kcalMin,
    kcalMax: plan.kcalMax,
    carbsTarget: macroGoal(s.settings, trainingDay).carbs.max,
    carbsMin: plan.carbsMin,
    fatTarget: macroGoal(s.settings, trainingDay).fat.max,
    fatMin: macroGoal(s.settings, trainingDay).fat.min,
    trained: todays.length > 0,
  };
};

/** Objetivos de grasa y carbohidratos para una meta calórica dada (grasa ≈ 25 % de las kcal). */

/* ---------- Gasto calórico por trabajo real (volumen, masa corporal y grupo muscular) ---------- */

const MET_SESSION = 3.3; // fuerza con descansos entre series (MET bruto)
const MET_REST = 1; // ya incluido en tu gasto base: se resta para sumar solo el extra del entreno
const EFFICIENCY = 0.22; // eficiencia muscular: 22 % del gasto metabólico se convierte en trabajo mecánico
const G = 9.81;
const J_PER_KCAL = 4184;
const EPOC = 1.05; // consumo extra de oxígeno posterior al esfuerzo

/** Multiplicador de demanda metabólica: piernas y movimientos grandes > torso > aislamiento. */
export const muscleFactor = (name: string, muscle: string): number => {
  const n = name.toLowerCase();
  if (/peso muerto|deadlift|sentadilla|squat|prensa|hack|zancada|hip thrust|buenos d/.test(n)) return 1.4;
  if (muscle === 'Cuádriceps' || muscle === 'Isquios' || muscle === 'Glúteos') return 1.3;
  if (muscle === 'Pecho' || muscle === 'Espalda') return 1.15;
  if (muscle === 'Hombros' && /press|militar|arnold/.test(n)) return 1.15;
  return 1.0;
};

/** Recorrido medio (m) por repetición. */
const rom = (muscle: string): number => (muscle === 'Cuádriceps' || muscle === 'Isquios' || muscle === 'Glúteos' ? 0.6 : muscle === 'Abdominales' ? 0.3 : 0.5);

export interface KcalBreakdown {
  total: number;
  /** Extra por el tiempo de sesión (descansos y activación). */
  base: number;
  /** Trabajo mecánico de las series completadas. */
  work: number;
  volume: number;
}

/**
 * kcal = [ (MET − 1) · masa · horas  +  Σ series ( carga efectiva · g · recorrido · reps · 2 / eficiencia / 4184 · factor muscular ) ] · EPOC.
 * Carga efectiva = peso añadido + parte de tu masa que movilizas en ejercicios de peso corporal (60 %).
 * Las series de calentamiento cuentan con la mitad; solo las completadas.
 */
export const workoutKcal = (weightKg: number, durationSec: number, exercises: LogExercise[], lookup: (id: string) => Exercise | undefined): KcalBreakdown => {
  const hours = Math.max(durationSec, 0) / 3600;
  const base = (MET_SESSION - MET_REST) * weightKg * hours;
  let work = 0;
  let volume = 0;
  for (const e of exercises) {
    if (e.muscleGroup === 'Rostro y Cuello' || e.muscleGroup === 'Estiramientos') continue; // por tiempo, sin carga: no suma trabajo mecánico
    const ex = lookup(e.exerciseId);
    const bodyShare = ex?.equipment === 'Peso Corporal' ? 0.6 * weightKg : 0;
    const f = muscleFactor(e.name, e.muscleGroup);
    for (const s of e.sets) {
      const load = s.weight * (e.perHand ? 2 : 1) + bodyShare;
      if (load <= 0 || s.reps <= 0) continue;
      const joules = load * G * rom(e.muscleGroup) * s.reps * 2; // fase concéntrica + excéntrica
      work += (joules / EFFICIENCY / J_PER_KCAL) * f * (s.type === 'warmup' ? 0.5 : 1);
      if (s.type !== 'warmup') volume += s.weight * (e.perHand ? 2 : 1) * s.reps;
    }
  }
  const round1 = (n: number) => Math.round(n);
  return { total: round1((base + work) * EPOC), base: round1(base * EPOC), work: round1(work * EPOC), volume: Math.round(volume) };
};
