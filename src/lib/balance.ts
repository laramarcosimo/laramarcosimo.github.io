import { dayBalance } from './metabolic';
import type { AppState } from './types';
import { dayKey } from './utils';

const DAY = 86400000;

export interface Carry {
  /** Exceso (+) o defecto (−) acumulado en los últimos 3 días con comidas registradas. */
  net: number;
  days: number;
  /** Ajuste sugerido para hoy (kcal, negativo = comer menos). 0 si no hace falta. */
  suggestion: number;
  note: string;
}

/**
 * Compensación: lo que importa es el promedio semanal. Un exceso se reparte en 2-3 días con un recorte
 * pequeño (máx. 12 % de la meta base), sin tocar la proteína. Los días sin registros no cuentan.
 */
export function carryOver(s: AppState, now = Date.now()): Carry {
  let net = 0;
  let days = 0;
  for (let i = 1; i <= 3; i++) {
    const key = dayKey(now - i * DAY);
    if (!s.meals.some((m) => dayKey(m.ts) === key)) continue;
    const b = dayBalance(s, key);
    net += b.eaten - b.target;
    days++;
  }
  const base = dayBalance(s).base;
  if (days === 0) return { net: 0, days, suggestion: 0, note: '' };
  if (net > 150) {
    const cut = Math.min(Math.round(net / 3 / 10) * 10, Math.round(base * 0.12));
    return { net: Math.round(net), days, suggestion: -cut, note: `Llevas +${Math.round(net)} kcal sobre la meta en los últimos ${days} día(s). Compénsalo con un recorte suave de ~${cut} kcal hoy (y mañana si hace falta). Mantén la proteína.` };
  }
  if (net < -400) return { net: Math.round(net), days, suggestion: 0, note: `Vas ${Math.abs(Math.round(net))} kcal por debajo de lo previsto. No hace falta compensar: no te saltes comidas ni proteína para mantener el músculo.` };
  return { net: Math.round(net), days, suggestion: 0, note: 'Vas en línea con tu meta de los últimos días.' };
}
