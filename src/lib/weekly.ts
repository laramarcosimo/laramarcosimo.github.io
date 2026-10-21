import { epley } from './exercises';
import { dayBalance } from './metabolic';
import { analyze } from './progress';
import { byDay, currentDayStreak, weekStart, weeklyStreak } from './streaks';
import type { AppState } from './types';
import { isVacationWeek } from './vacation';
import { dayKey } from './utils';

const DAY = 86400000;

/** Lunes (00:00) de la semana que está `offset` semanas antes de la de `now`. */
export const weekMonday = (now: number, offset = 0): number => {
  const d = new Date(weekStart(now));
  d.setDate(d.getDate() - 7 * offset);
  return d.getTime();
};
/** «5–11 oct» o «29 sep – 5 oct» para la semana que empieza en `monday`. */
export const weekLabel = (monday: number): string => {
  const a = new Date(monday);
  const b = new Date(monday);
  b.setDate(b.getDate() + 6);
  const mon = (d: Date) => d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${mon(b)}` : `${a.getDate()} ${mon(a)} – ${b.getDate()} ${mon(b)}`;
};

export interface NutriRow {
  label: string;
  unit: string;
  /** Media de los días con comidas anotadas y baremo medio (mínimo–máximo). */
  avg: number;
  lo: number;
  hi: number;
  /** Días en que llegaste a tu baremo (entre mínimo y máximo; en proteína, al menos el mínimo) y días con comidas. */
  ok: number;
  days: number;
}

export interface WeekSummary {
  /** Cómo fue la alimentación de la semana frente a tu baremo (vacío si no anotaste comidas). */
  nutri: NutriRow[];
  /** Lunes y domingo (00:00) de la semana resumida. */
  start: number;
  end: number;
  cardioMin: number;
  cardioKm: number;
  daysLogged: number;
  avgKcal: number;
  avgTarget: number;
  avgProtein: number;
  proteinTarget: number;
  /** Días registrados de la semana en que llegaste al mínimo de proteína. */
  proteinDays: number;
  workouts: number;
  volume: number;
  volumePrev: number;
  prs: number;
  /** Volumen por día (de hace 6 días a hoy). */
  dayVolume: { label: string; kg: number }[];
  burned: number;
  waistDelta: number | null;
  weightDelta: number | null;
  dayStreak: number;
  weekStreak: number;
  notes: { tone: 'good' | 'warn' | 'neutral'; text: string }[];
}

/** Resumen de una semana natural (lunes a domingo; `offset` semanas atrás) calculado en el dispositivo (no usa Gemini). */
export function weekSummary(s: AppState, realNow = Date.now(), offset = 0): WeekSummary {
  const start = weekMonday(realNow, offset);
  const startDate = new Date(start);
  const dayAt = (i: number): Date => { const d = new Date(startDate); d.setDate(d.getDate() + i); return d; };
  const until = dayAt(7).getTime();
  // Para rachas y medidas, «ahora» es hoy en la semana actual y el final de la semana en las pasadas.
  const now = offset === 0 ? realNow : until - 1;
  const keys = Array.from({ length: 7 }, (_, i) => dayKey(dayAt(i).getTime() + 12 * 3600000));
  const logged = keys.filter((k) => s.meals.some((m) => dayKey(m.ts) === k));
  const bal = logged.map((k) => dayBalance(s, k));
  const avg = (f: (b: ReturnType<typeof dayBalance>) => number) => (bal.length ? Math.round(bal.reduce((a, b) => a + f(b), 0) / bal.length) : 0);
  const avgKcal = avg((b) => b.eaten);
  const avgTarget = avg((b) => b.target);
  const avgProtein = avg((b) => b.proteinEaten);
  const proteinTarget = dayBalance(s).proteinTarget;
  const proteinDays = bal.filter((b) => b.proteinEaten >= b.proteinTarget).length;

  const since = start;
  const ws = s.workouts.filter((w) => { const t = Date.parse(w.startTime); return t >= since && t < until; });
  const volume = ws.reduce((a, w) => a + w.totalVolumeKg, 0);
  const prevStart = weekMonday(realNow, offset + 1);
  const prevVolume = s.workouts.filter((w) => { const t = Date.parse(w.startTime); return t >= prevStart && t < since; }).reduce((a, w) => a + w.totalVolumeKg, 0);
  const best = new Map<string, number>();
  const sorted = [...s.workouts].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  let prs = 0;
  let cardioMin = 0;
  let cardioKm = 0;
  for (const w of sorted) {
    const wt = Date.parse(w.startTime);
    const inWeek = wt >= since && wt < until;
    for (const e of w.exercises) {
      for (const st of e.sets) {
        if (inWeek && (st.min !== undefined || st.km !== undefined)) { cardioMin += st.min ?? 0; cardioKm += st.km ?? 0; }
        if (st.type === 'warmup') continue;
        const v = epley(st.weight, st.reps);
        const b = best.get(e.exerciseId) ?? 0;
        if (v > b) {
          if (inWeek && b > 0) prs++;
          best.set(e.exerciseId, v);
        }
      }
    }
  }
  const dayVolume = Array.from({ length: 7 }, (_, i) => {
    const t = dayAt(i).getTime() + 12 * 3600000;
    const k = dayKey(t);
    return { label: ['L', 'M', 'X', 'J', 'V', 'S', 'D'][i], kg: Math.round(s.workouts.filter((w) => dayKey(Date.parse(w.startTime)) === k).reduce((a, w) => a + w.totalVolumeKg, 0)) };
  });
  const burned = ws.reduce((a, w) => a + w.caloriesBurned, 0);

  const ms = s.measurements.filter((m) => m.ts >= since - 7 * DAY && m.ts < until);
  const p = analyze(ms, s.profile.height);

  const days = byDay(s.workouts);
  const dayStreak = currentDayStreak(days, now);
  const weekStreak = weeklyStreak(days, s.settings.weeklyGoal, now, (w) => isVacationWeek(s.settings, w));

  const notes: WeekSummary['notes'] = [];
  if (logged.length < 3) notes.push({ tone: 'neutral', text: 'Registra tus comidas al menos 3-4 días para que el resumen sea fiable.' });
  else {
    if (avgProtein >= proteinTarget) notes.push({ tone: 'good', text: `Proteína media ${avgProtein} g: cubres tu meta, clave para conservar y tonificar el músculo.` });
    else notes.push({ tone: 'warn', text: `Proteína media ${avgProtein} g (mínimo ${proteinTarget} g): añade una fuente de proteína en cada comida.` });
    const diff = avgKcal - avgTarget;
    if (Math.abs(diff) <= avgTarget * 0.08) notes.push({ tone: 'good', text: 'Tus calorías van en línea con tu meta.' });
    else if (diff > 0) notes.push({ tone: 'warn', text: `Comes de media ${diff} kcal por encima de tu meta: ajusta raciones o cenas.` });
    else notes.push({ tone: 'neutral', text: `Comes de media ${Math.abs(diff)} kcal por debajo de tu meta: sin pasar hambre, no te quedes demasiado corta/o.` });
  }
  const goal = s.settings.weeklyGoal;
  if (s.settings.vacation) notes.push({ tone: 'neutral', text: `Modo vacaciones: el objetivo semanal está en pausa y no rompe tu racha. ${ws.length ? `Llevas ${ws.length} sesión${ws.length === 1 ? '' : 'es'} de mantenimiento.` : 'Con 5-15 min al día de mantenimiento es suficiente.'}` });
  else if (ws.length >= goal) notes.push({ tone: 'good', text: `${ws.length} entrenos ${offset === 0 ? 'esta semana' : 'esa semana'}: objetivo de ${goal} cumplido.` });
  else notes.push({ tone: 'warn', text: `${ws.length} de ${goal} entrenos ${offset === 0 ? 'esta semana' : 'esa semana'}.` });

  const mean = (f: (b: ReturnType<typeof dayBalance>) => number) => (bal.length ? Math.round(bal.reduce((a, b) => a + f(b), 0) / bal.length) : 0);
  const row = (label: string, unit: string, val: (b: ReturnType<typeof dayBalance>) => number, lo: (b: ReturnType<typeof dayBalance>) => number, hi: (b: ReturnType<typeof dayBalance>) => number, minOnly = false): NutriRow => ({ label, unit, avg: mean(val), lo: mean(lo), hi: mean(hi), ok: bal.filter((b) => val(b) >= lo(b) && (minOnly || val(b) <= hi(b))).length, days: bal.length });
  const nutri: NutriRow[] = bal.length === 0 ? [] : [
    row('Calorías', 'kcal', (b) => b.eaten, (b) => b.kcalMin, (b) => b.kcalMax),
    row('Proteína', 'g', (b) => b.proteinEaten, (b) => b.proteinTarget, (b) => b.proteinMax, true),
    row('Carbohidratos', 'g', (b) => Math.round(b.carbs), (b) => b.carbsMin, (b) => b.carbsTarget),
    row('Grasas', 'g', (b) => Math.round(b.fat), (b) => b.fatMin, (b) => b.fatTarget),
  ];
  return { nutri, start, end: dayAt(6).getTime(), cardioMin: Math.round(cardioMin), cardioKm: Math.round(cardioKm * 10) / 10, daysLogged: logged.length, avgKcal, avgTarget, avgProtein, proteinTarget, proteinDays, workouts: ws.length, volume: Math.round(volume), volumePrev: Math.round(prevVolume), prs, dayVolume, burned: Math.round(burned), waistDelta: p.waistDelta, weightDelta: p.weightDelta, dayStreak, weekStreak, notes: notes.slice(0, 4) };
}
