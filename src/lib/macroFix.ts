import { resolveLine, type Resolved } from './foodDb';

export interface MacroBudget {
  carbsSlot?: number;
  grasaSlot?: number;
  restoCarbs?: number;
  restoGrasa?: number;
}
export interface MacroTotals {
  calorias: number;
  proteinas: number;
  carbs: number;
  grasas: number;
}
export interface MacroFix {
  /** Posición de la línea que se cambia. */
  index: number;
  line: string;
  /** Línea ya reducida; vacía si lo mejor es quitar el ingrediente. */
  newLine: string;
  /** Diferencia de macros que supone el cambio (negativa = baja). */
  delta: { kcal: number; prot: number; carbs: number; fat: number };
  /** Qué macro se pasaba. */
  over: ('carbs' | 'grasa')[];
  before: MacroTotals;
  after: MacroTotals;
}

const FRAC: Record<string, string> = { '0.5': '½' };
const WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, medio: 0.5, media: 0.5, '½': 0.5 };

/** Escala la cantidad de una línea («2 cucharadas de aceite (≈ 30 g)») por un factor; null si no se puede reescribir. */
export const scaleLine = (line: string, factor: number): string | null => {
  const m = line.match(/^(\s*)(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|½|un|una|uno|dos|tres|cuatro|cinco|medio|media)(?![a-záéíóúñ])(.*)$/i);
  if (!m) return null;
  const q = m[2].trim().toLowerCase();
  let qty: number;
  if (WORDS[q] !== undefined) qty = WORDS[q];
  else if (q.includes('/')) {
    const [x, y] = q.split('/').map((v) => Number(v.trim()));
    qty = y ? x / y : NaN;
  } else qty = Number(q.replace(',', '.'));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  let rest = m[3];
  const grams = /^\s*(g|gr|gramos?|ml)\b/i.test(rest);
  const next = qty * factor;
  const nq = grams ? String(Math.max(5, Math.round(next / 5) * 5)) : FRAC[String(Math.round(next * 2) / 2)] ?? String(Math.round(next * 2) / 2);
  if (!grams && Math.round(next * 2) / 2 <= 0) return null;
  // El peso entre paréntesis («≈ 30 g») es el total de la línea: se reduce igual.
  rest = rest.replace(/\(([^)]*?)(\d+(?:[.,]\d+)?)(\s*(?:g|gr|ml)\b[^)]*)\)/i, (_a, pre: string, n: string, post: string) => `(${pre}${Math.max(1, Math.round((Number(n.replace(',', '.')) * factor) / (grams ? 5 : 1)) * (grams ? 5 : 1))}${post})`);
  // «1 cucharadas» → «1 cucharada»
  if (nq === '1') rest = rest.replace(/^(\s*)(cucharada|cucharadita|loncha|lonchita|rebanada|puñado|unidad|taza|pieza)s\b/i, '$1$2');
  return `${m[1]}${nq}${rest}`;
};

const totalsOf = (rs: (Resolved | null)[]): MacroTotals | null => {
  if (rs.some((r) => !r)) return null;
  const t = { calorias: 0, proteinas: 0, carbs: 0, grasas: 0 };
  for (const r of rs as Resolved[]) {
    t.calorias += r.kcal;
    t.proteinas += r.protein;
    t.carbs += r.carbs;
    t.grasas += r.fat;
  }
  return { calorias: Math.round(t.calorias), proteinas: Math.round(t.proteinas), carbs: Math.round(t.carbs), grasas: Math.round(t.grasas) };
};

/**
 * Si un plato se pasa de carbohidratos o de grasa para lo que le toca a la toma, propone UN cambio: reducir (o quitar) el ingrediente
 * que arregla el exceso perdiendo la menor proteína y tocando lo menos posible. Todo con la tabla de la app, sin IA.
 */
export const suggestMacroFix = (detalle: string[], b: MacroBudget): MacroFix | null => {
  const rs = detalle.map((l) => resolveLine(l));
  const before = totalsOf(rs);
  if (!before) return null;
  const capC = Math.min(b.carbsSlot !== undefined ? b.carbsSlot + 10 : Infinity, b.restoCarbs !== undefined ? b.restoCarbs * 1.1 + 5 : Infinity);
  const capF = Math.min(b.grasaSlot !== undefined ? b.grasaSlot + 5 : Infinity, b.restoGrasa !== undefined ? b.restoGrasa * 1.1 + 3 : Infinity);
  const overC = before.carbs > capC;
  const overF = before.grasas > capF;
  if (!overC && !overF) return null;
  const excess = (t: MacroTotals): number => Math.max(0, t.carbs - capC) / Math.max(capC, 20) + Math.max(0, t.grasas - capF) / Math.max(capF, 10);
  let best: { fix: MacroFix; score: number } | null = null;
  rs.forEach((r, i) => {
    if (!r || (r.carbs <= 0.5 && r.fat <= 0.5)) return;
    for (const f of [0.75, 0.5, 0.25, 0]) {
      const nl = f === 0 ? '' : scaleLine(detalle[i], f);
      if (f !== 0 && !nl) continue;
      const nr = f === 0 ? null : resolveLine(nl as string);
      if (f !== 0 && !nr) continue;
      const rs2 = rs.map((x, k) => (k === i ? nr : x)).filter((_, k) => k !== i || f !== 0);
      const after = totalsOf(rs2);
      if (!after) continue;
      const left = excess(after);
      const lostProt = before.proteinas - after.proteinas;
      // Mejor: el que deja el exceso a 0 con menos proteína perdida y menos reducción; si ninguno llega a 0, el que más lo baja.
      const score = left * 1000 + lostProt * 3 + (1 - f) * 10;
      const delta = { kcal: (nr?.kcal ?? 0) - r.kcal, prot: (nr?.protein ?? 0) - r.protein, carbs: (nr?.carbs ?? 0) - r.carbs, fat: (nr?.fat ?? 0) - r.fat };
      if (!best || score < best.score) best = { score, fix: { index: i, line: detalle[i], newLine: nl as string, delta, over: [...(overC ? ['carbs' as const] : []), ...(overF ? ['grasa' as const] : [])], before, after } };
    }
  });
  const fix = (best as { fix: MacroFix } | null)?.fix ?? null;
  return fix && excess(fix.after) < excess(before) ? fix : null;
};
