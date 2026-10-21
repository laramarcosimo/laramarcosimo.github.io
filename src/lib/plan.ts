import { SLOTS, consumeTupper, logTemplate, slotOf } from './templates';
import type { AppState, DayPlan, PlannedMeal, Slot } from './types';
import { dayKey } from './utils';

/** Registra una comida prevista: si es un tupper descuenta una ración; si es de la despensa, una unidad. */
export const registerPlanned = (s: AppState, p: PlannedMeal, slot: Slot): AppState => {
  if (p.tupperId) return consumeTupper(s, p.tupperId, slot);
  const used = p.pantryNames ?? (p.pantryName ? [p.pantryName] : []);
  return logTemplate(s, { ...p, ingredientes: used }, used.length > 0, slot);
};

/** Hora (decimal) a partir de la cual una toma «ya pasó»; la cena no caduca (el plan se renueva cada día). */
export const SLOT_END: Record<Slot, number | null> = { desayuno: 11, comida: 16, merienda: 19.5, cena: null, snack: null };

export const slotPassed = (slot: Slot, now: number): boolean => {
  const end = SLOT_END[slot];
  if (end === null) return false;
  const d = new Date(now);
  return d.getHours() + d.getMinutes() / 60 >= end;
};

const withoutSlot = (s: AppState, slot: Slot): AppState => {
  if (!s.dayPlan) return s;
  const slots = { ...s.dayPlan.slots };
  delete slots[slot];
  return { ...s, dayPlan: { ...s.dayPlan, slots } };
};

/** Pasa al diario la comida prevista de una toma (y la quita del plan). */
export const movePlannedToDiary = (s: AppState, slot: Slot): AppState => {
  const p = s.dayPlan?.slots[slot];
  return p ? withoutSlot(registerPlanned(s, p, slot), slot) : s;
};

export interface AutoMoved {
  slot: Slot;
  name: string;
  /** true = se anotó en el diario; false = ya habías anotado otra cosa en esa toma y solo se quitó del plan. */
  logged: boolean;
}

/**
 * Lo que dejaste previsto en «Planificar día» y cuya hora ya pasó (desayuno 11:00, comida 16:00, merienda 19:30) se anota solo
 * en el diario y se quita del plan. Si en esa toma ya habías apuntado otra comida, se entiende que comiste eso y solo se quita del plan.
 */
export function autoLogPlanned(s: AppState, now = Date.now()): { state: AppState; moved: AutoMoved[] } {
  const today = dayKey(now);
  if (!s.dayPlan || s.dayPlan.day !== today) return { state: s, moved: [] };
  let next = s;
  const moved: AutoMoved[] = [];
  for (const slot of Object.keys(s.dayPlan.slots) as Slot[]) {
    const p = s.dayPlan.slots[slot];
    if (!p || !slotPassed(slot, now)) continue;
    const already = next.meals.some((m) => dayKey(m.ts) === today && slotOf(m) === slot);
    next = already ? withoutSlot(next, slot) : withoutSlot(registerPlanned(next, p, slot), slot);
    moved.push({ slot, name: p.name, logged: !already });
  }
  return { state: next, moved };
}

/** Tomas pendientes del día: sin nada anotado, sin nada previsto y no saltadas. Entre ellas se reparte lo que queda por comer. */
export const pendingSlots = (s: AppState, today: string, override?: DayPlan): { id: Slot; weight: number }[] => {
  const dp = override ?? (s.dayPlan?.day === today ? s.dayPlan : undefined);
  const logged = new Set(s.meals.filter((m) => dayKey(m.ts) === today).map((m) => slotOf(m)));
  // Los snacks son opcionales: nunca reservan presupuesto.
  return SLOTS.filter((x) => x.id !== 'snack' && !dp?.slots[x.id] && !(dp?.skipped ?? []).includes(x.id) && !logged.has(x.id)).map(({ id, weight }) => ({ id, weight }));
};

/** Reparte kcal y proteína restantes entre las tomas pendientes según su peso (si solo queda una, se lleva todo). */
export const splitBudget = (leftKcal: number, leftProt: number, free: { id: Slot; weight: number }[]): Record<string, { kcal: number; prot: number }> => {
  const wsum = free.reduce((a, f) => a + f.weight, 0) || 1;
  return Object.fromEntries(free.map((f) => [f.id, { kcal: Math.max(0, Math.round((leftKcal * f.weight) / wsum / 10) * 10), prot: Math.max(0, Math.round((leftProt * f.weight) / wsum)) }]));
};

/** Día siguiente (AAAA-MM-DD) a una fecha dada. */
export const nextDayKey = (now: number = Date.now()): string => {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  return dayKey(d.getTime());
};

/**
 * ¿Ya se puede planificar mañana? A partir de las 22:00, o desde las 20:00 si la cena de hoy ya está anotada, prevista o saltada.
 */
export const canPlanTomorrow = (s: AppState, now: number = Date.now()): boolean => {
  const h = new Date(now).getHours();
  if (h >= 22) return true;
  if (h < 20) return false;
  const today = dayKey(now);
  const dp = s.dayPlan?.day === today ? s.dayPlan : undefined;
  return s.meals.some((m) => dayKey(m.ts) === today && slotOf(m) === 'cena') || !!dp?.slots.cena || (dp?.skipped ?? []).includes('cena');
};

/** Cuando llega el día, el plan de «mañana» pasa a ser el de hoy; si quedó viejo, se descarta. Devuelve el mismo estado si no hay nada que hacer. */
export const rolloverPlan = (s: AppState, now: number = Date.now()): AppState => {
  const np = s.nextPlan;
  if (!np) return s;
  const today = dayKey(now);
  if (np.day === today) return { ...s, dayPlan: s.dayPlan?.day === today ? mergePlans(s.dayPlan, np) : np, nextPlan: undefined };
  return np.day < today ? { ...s, nextPlan: undefined } : s;
};

const mergePlans = (cur: DayPlan, np: DayPlan): DayPlan => ({ ...cur, slots: { ...np.slots, ...cur.slots }, skipped: [...new Set([...(np.skipped ?? []), ...(cur.skipped ?? [])])] });
