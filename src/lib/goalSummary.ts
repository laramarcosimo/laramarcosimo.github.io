import { dayBalance } from './metabolic';
import type { AppState } from './types';
import { dayKey } from './utils';

const DAY = 86_400_000;
const GOAL_NAME: Record<string, string> = { recomp: 'recomposición (menos grasa y más tono)', deficit: 'perder grasa', maintain: 'mantener', surplus: 'ganar músculo' };

export interface GoalCheck {
  label: string;
  ok: boolean;
  detail: string;
}
export interface GoalSummary {
  verdict: 'good' | 'mixed' | 'bad' | 'unknown';
  headline: string;
  /** Texto breve (2-4 frases) listo para el PDF. */
  text: string;
  checks: GoalCheck[];
}

const pct = (n: number, d: number): number => (d ? Math.round((n / d) * 100) : 0);
const f1 = (n: number): string => (Math.round(n * 10) / 10).toString().replace('.', ',');

/**
 * ¿Se están cumpliendo los objetivos entre dos fechas? Compara entrenos por semana, calorías, proteína, carbohidratos y grasas
 * (días dentro de tu baremo) y la evolución de peso y cintura según tu objetivo. Todo calculado en el dispositivo, sin IA.
 */
export function goalSummary(s: AppState, fromTs: number, toTs: number, now = Date.now()): GoalSummary {
  const to = Math.min(toTs, now);
  const days = Math.max(1, Math.round((to - fromTs) / DAY));
  const weeks = Math.max(1, days / 7);
  const checks: GoalCheck[] = [];

  const ws = s.workouts.filter((w) => { const t = Date.parse(w.startTime); return t >= fromTs && t < to + DAY; });
  const trained = new Set(ws.map((w) => dayKey(Date.parse(w.startTime)))).size;
  const goal = s.settings.weeklyGoal;
  const perWeek = trained / weeks;
  const vacation = !!s.settings.vacation;
  if (!vacation) checks.push({ label: 'entrenos', ok: perWeek >= goal * 0.85, detail: `${f1(perWeek)} por semana (objetivo ${goal})` });

  const keys: string[] = [];
  for (let t = fromTs; t < to + DAY && keys.length < 400; t += DAY) keys.push(dayKey(t + 12 * 3600000));
  const logged = [...new Set(keys)].filter((k) => s.meals.some((m) => dayKey(m.ts) === k));
  const bal = logged.map((k) => dayBalance(s, k));
  if (bal.length >= 3) {
    const share = (f: (b: ReturnType<typeof dayBalance>) => boolean): number => pct(bal.filter(f).length, bal.length);
    const kcal = share((b) => b.eaten >= b.kcalMin && b.eaten <= b.kcalMax);
    const prot = share((b) => b.proteinEaten >= b.proteinTarget);
    const carbs = share((b) => b.carbs >= b.carbsMin && b.carbs <= b.carbsTarget);
    const fat = share((b) => b.fat >= b.fatMin && b.fat <= b.fatTarget);
    checks.push({ label: 'calorías', ok: kcal >= 60, detail: `${kcal} % de los días dentro de tu rango` });
    checks.push({ label: 'proteína', ok: prot >= 70, detail: `${prot} % de los días con tu mínimo` });
    checks.push({ label: 'carbohidratos', ok: carbs >= 60, detail: `${carbs} % de los días en tu baremo` });
    checks.push({ label: 'grasas', ok: fat >= 60, detail: `${fat} % de los días en tu baremo` });
  }

  const ms = s.measurements.filter((m) => m.ts >= fromTs && m.ts < to + DAY).sort((a, b) => a.ts - b.ts);
  const span = (k: 'weight' | 'waist' | 'belly'): { d: number } | null => {
    const v = ms.filter((m) => (m[k] ?? 0) > 0);
    return v.length >= 2 ? { d: Math.round(((v[v.length - 1][k] as number) - (v[0][k] as number)) * 10) / 10 } : null;
  };
  const w = span('weight');
  const c = span('waist');
  const bel = span('belly');
  const g = s.profile.goal;
  if (g === 'recomp' && (c || w || bel)) {
    const okWaist = c ? c.d <= -0.5 || (c.d <= 0 && (w?.d ?? 0) <= 0.5) : (w?.d ?? 0) <= 0;
    const ok = okWaist && !(bel && bel.d >= 0.5); // la barriga baja no debe subir
    checks.push({ label: 'cuerpo', ok, detail: [c ? `cintura ${c.d > 0 ? '+' : ''}${f1(c.d)} cm` : '', bel ? `barriga baja ${bel.d > 0 ? '+' : ''}${f1(bel.d)} cm` : '', w ? `peso ${w.d > 0 ? '+' : ''}${f1(w.d)} kg` : ''].filter(Boolean).join(' y ') });
  } else if (g === 'deficit' && w) checks.push({ label: 'peso', ok: w.d < 0, detail: `${w.d > 0 ? '+' : ''}${f1(w.d)} kg` });
  else if (g === 'maintain' && w) checks.push({ label: 'peso', ok: Math.abs(w.d) <= 1, detail: `${w.d > 0 ? '+' : ''}${f1(w.d)} kg` });
  else if (g === 'surplus' && w) checks.push({ label: 'peso', ok: w.d > 0, detail: `${w.d > 0 ? '+' : ''}${f1(w.d)} kg` });

  if (checks.length === 0) return { verdict: 'unknown', headline: 'Aún no hay datos para valorar tus objetivos', text: 'Anota entrenos, comidas y medidas para ver si estás cumpliendo tus objetivos.', checks };
  const ok = checks.filter((x) => x.ok);
  const bad = checks.filter((x) => !x.ok);
  const ratio = ok.length / checks.length;
  const verdict: GoalSummary['verdict'] = ratio >= 0.75 ? 'good' : ratio >= 0.4 ? 'mixed' : 'bad';
  const headline = verdict === 'good' ? 'Vas cumpliendo tus objetivos' : verdict === 'mixed' ? 'Cumples parte de tus objetivos' : 'Todavía no se cumplen tus objetivos';
  const parts: string[] = [`Objetivo: ${GOAL_NAME[g] ?? g}. Cumples ${ok.length} de ${checks.length} puntos.`];
  if (ok.length) parts.push(`Bien: ${ok.map((x) => `${x.label} (${x.detail})`).join('; ')}.`);
  if (bad.length) parts.push(`A mejorar: ${bad.map((x) => `${x.label} (${x.detail})`).join('; ')}.`);
  if (vacation) parts.push('Modo vacaciones activo: el objetivo de entrenos está en pausa.');
  return { verdict, headline, text: parts.join(' '), checks };
}

type RGB = [number, number, number];
interface BoxDoc {
  setFont: (f: string, s?: string) => void;
  setFontSize: (n: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g?: number, b?: number) => void;
  roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string) => void;
  text: (t: string | string[], x: number, y: number, o?: { align?: 'left' | 'center' | 'right' }) => void;
  getTextWidth: (t: string) => number;
}

/** Parte un texto en líneas que caben en `maxW` mm con la fuente actual. */
export const wrapText = (d: Pick<BoxDoc, 'getTextWidth'>, text: string, maxW: number): string[] => {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && d.getTextWidth(next) > maxW) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
};

const TONE: Record<GoalSummary['verdict'], RGB> = { good: [5, 150, 105], mixed: [217, 119, 6], bad: [220, 38, 38], unknown: [100, 116, 139] };

/** Recuadro «¿Cumples tus objetivos?» con titular de color y 2-4 frases. Devuelve el alto usado. */
export function drawGoalBox(d: BoxDoc, x: number, y: number, w: number, gs: GoalSummary): number {
  const c = TONE[gs.verdict];
  d.setFont('helvetica', 'normal');
  d.setFontSize(8.5);
  const lines = wrapText(d, gs.text, w - 12);
  const h = 13 + lines.length * 4.1 + 2;
  d.setFillColor(c[0] + Math.round((255 - c[0]) * 0.9), c[1] + Math.round((255 - c[1]) * 0.9), c[2] + Math.round((255 - c[2]) * 0.9));
  d.roundedRect(x, y, w, h, 3, 3, 'F');
  d.setFillColor(...c);
  d.roundedRect(x, y, 3, h, 1.5, 1.5, 'F');
  d.setFont('helvetica', 'bold');
  d.setFontSize(10);
  d.setTextColor(...c);
  d.text(gs.headline, x + 8, y + 7);
  d.setFont('helvetica', 'normal');
  d.setFontSize(8.5);
  d.setTextColor(51, 65, 85);
  lines.forEach((l, i) => d.text(l, x + 8, y + 12.5 + i * 4.1));
  return h;
}
