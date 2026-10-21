import type { DayBalance } from './metabolic';

export interface SlotTarget {
  /** Calorías objetivo de la toma y margen aceptable. */
  kcal: number;
  kcalLow: number;
  kcalHigh: number;
  /** Proteína objetivo y techo para la toma; `covered` = la del día ya llegó a tu mínimo. */
  prot: number;
  protCap: number;
  covered: boolean;
  carbs: number;
  fat: number;
  /** Lo que falta en total (todo el día) para llegar al mínimo de kcal. */
  kcalToMin: number;
}

interface Planned {
  kcal: number;
  prot: number;
  carbs: number;
  fat: number;
}

const r10 = (n: number): number => Math.round(n / 10) * 10;

/**
 * Objetivos NUMÉRICOS de una toma a partir de lo que ya comiste y lo que tienes previsto:
 *  - calorías: reparto de lo que falta para llegar a tu rango (el mínimo es obligatorio), nunca por encima del máximo del día;
 *  - proteína: reparto de lo que falta para el MÍNIMO; si ya lo cubriste, la toma debe llevar muy poca (solo la que cae de forma natural);
 *  - carbohidratos y grasa: reparto del punto medio de tu baremo menos lo ya tomado.
 * `share` es la parte del resto del día que le toca a esta toma (1 = la última que queda; 0 = toma opcional como los snacks).
 */
export function slotTarget(b: DayBalance, planned: Planned, share: number): SlotTarget {
  const eatenK = b.eaten + planned.kcal;
  const toMin = Math.max(0, b.kcalMin - eatenK);
  const toMid = Math.max(0, b.target - eatenK);
  const room = Math.max(0, b.kcalMax - eatenK);
  const optional = share <= 0;
  const raw = optional ? Math.min(180, room) : share * Math.max(toMin, toMid);
  const kcal = Math.min(room, r10(raw));
  const kcalLow = optional ? 0 : Math.max(0, Math.min(kcal, r10(kcal * 0.9 - 10)));
  const kcalHigh = Math.min(room, r10(kcal * 1.1 + 20));

  const eatenP = b.proteinEaten + planned.prot;
  const toMinP = Math.max(0, b.proteinTarget - eatenP);
  const roomP = Math.max(0, b.proteinMax - eatenP);
  const covered = toMinP === 0;
  const prot = covered ? 0 : Math.round((optional ? 0.25 : share) * toMinP);
  const protCap = covered ? 10 : Math.min(Math.max(roomP, prot), prot + 8);

  const midC = (b.carbsMin + b.carbsTarget) / 2;
  const midF = (b.fatMin + b.fatTarget) / 2;
  const sh = optional ? 0.2 : share;
  return {
    kcal,
    kcalLow,
    kcalHigh,
    prot,
    protCap,
    covered,
    carbs: Math.max(0, Math.round((midC - b.carbs - planned.carbs) * sh)),
    fat: Math.max(0, Math.round((midF - b.fat - planned.fat) * sh)),
    kcalToMin: toMin,
  };
}
