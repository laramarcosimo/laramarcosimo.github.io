import type { Measurement, Meal } from './types';

const KCAL_PER_KG = 7700;
const DAY = 86_400_000;

export interface TdeeEstimate {
  /** Gasto diario real estimado (kcal/día). */
  tdee: number;
  /** Media de kcal que registraste los días con comida anotada. */
  avgIntake: number;
  /** Cambio de peso por semana (kg, negativo = bajas). */
  kgPerWeek: number;
  loggedDays: number;
  weighIns: number;
  /** Días entre la primera y la última pesada usadas. */
  spanDays: number;
}

const localDay = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export interface TrainingCheck {
  /** kcal por sesión que cuenta la app (media de tus últimos entrenos). */
  appPerSession: number;
  /** kcal por sesión que se deducen de tu gasto real. */
  impliedPerSession: number;
  verdict: 'ok' | 'menos' | 'mas';
}

/**
 * Contrasta lo que la app cuenta por entreno con lo que sale de tu gasto real:
 * gasto real − gasto sin entrenar = lo que de verdad añaden tus entrenos al día. Solo con 6 o más sesiones en 4 semanas.
 */
export function trainingCheck(tdee: number, restDaily: number, sessions: number, appPerSession: number): TrainingCheck | null {
  if (sessions < 6 || !(appPerSession > 0)) return null;
  const impliedPerSession = Math.round(((tdee - restDaily) * 28) / sessions);
  const ratio = impliedPerSession / appPerSession;
  return { appPerSession: Math.round(appPerSession), impliedPerSession, verdict: ratio < 0.6 ? 'menos' : ratio > 1.4 ? 'mas' : 'ok' };
}

/**
 * Gasto real = lo que comes de media − (cambio de peso × 7700 kcal/kg) / días.
 * Solo cuenta días con comida anotada (≥ 800 kcal) y exige datos suficientes: 10 días registrados y 3 pesadas que abarquen 14 días,
 * para no sacar conclusiones de unos pocos días de ruido (agua, sal, ciclo…).
 */
export function adaptiveTdee(input: { meals: Meal[]; measurements: Measurement[] }, now = Date.now(), windowDays = 28): TdeeEstimate | null {
  const from = now - windowDays * DAY;
  const perDay = new Map<string, number>();
  for (const m of input.meals) if (m.ts >= from && m.ts <= now) perDay.set(localDay(m.ts), (perDay.get(localDay(m.ts)) ?? 0) + m.calorias);
  const logged = [...perDay.values()].filter((k) => k >= 800);
  if (logged.length < 10) return null;
  const w = input.measurements
    .filter((x) => x.weight && x.weight > 0 && x.ts >= from && x.ts <= now)
    .sort((a, b) => a.ts - b.ts)
    .map((x) => ({ t: (x.ts - from) / DAY, kg: x.weight as number }));
  if (w.length < 3) return null;
  const span = w[w.length - 1].t - w[0].t;
  if (span < 14) return null;
  // Pendiente por mínimos cuadrados (kg/día): más estable que restar el último peso al primero.
  const n = w.length;
  const mt = w.reduce((a, p) => a + p.t, 0) / n;
  const mk = w.reduce((a, p) => a + p.kg, 0) / n;
  const num = w.reduce((a, p) => a + (p.t - mt) * (p.kg - mk), 0);
  const den = w.reduce((a, p) => a + (p.t - mt) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;
  const avgIntake = logged.reduce((a, k) => a + k, 0) / logged.length;
  const tdee = avgIntake - slope * KCAL_PER_KG;
  if (!(tdee > 1000 && tdee < 5000)) return null;
  return { tdee: Math.round(tdee), avgIntake: Math.round(avgIntake), kgPerWeek: Math.round(slope * 7 * 100) / 100, loggedDays: logged.length, weighIns: n, spanDays: Math.round(span) };
}
