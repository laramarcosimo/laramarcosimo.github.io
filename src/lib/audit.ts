import { isKneeUnsafe } from './knee';
import type { Exercise, MuscleGroup, RoutineTemplate } from './types';
import { uid } from './utils';

export type Status = 'ok' | 'warn' | 'alert';
type Rt = RoutineTemplate['exercises'][number];

export interface AuditItem {
  index: number;
  name: string;
  muscle: MuscleGroup;
  equipment: string;
  sets: number;
}

export interface AuditResult {
  status: Status;
  /** Hasta 3 puntos clave del coach. */
  points: string[];
  /** Orden recomendado: índices del orden original. */
  order: number[];
  /** Ejercicios con impacto o compresión patelar lesiva. */
  kneeAlerts: string[];
  source: 'ia' | 'local';
}

const PUSH: MuscleGroup[] = ['Pecho', 'Hombros', 'Tríceps'];
const PULL: MuscleGroup[] = ['Espalda', 'Bíceps'];
const POSTERIOR: MuscleGroup[] = ['Isquios', 'Glúteos'];
const SEAT_RE = /sissy|pistol|sentadilla (profunda|completa)|ass to grass/i;

/** Prioridad de orden: compuestos pesados primero, aislamiento y core al final. Menor = antes. */
export const rankOf = (name: string, muscle: MuscleGroup): number => {
  const n = name.toLowerCase();
  if (muscle === 'Estiramientos') return 8; // siempre al final
  if (muscle === 'Abdominales') return 7;
  if (/hip thrust|empuje de caderas|puente de glúteo|prensa|press de piernas|sentadilla|hack|zancada|búlgara|bulgara|step-up|subida al cajón/.test(n) && muscle !== 'Gemelos') return 1;
  if (muscle === 'Pecho' && /press|fondos|flexiones/.test(n)) return 2;
  if (muscle === 'Espalda' && /jalón|jalon|dominada|remo|pull/.test(n) && !/pullover/.test(n)) return 2;
  if (muscle === 'Hombros' && /press|militar|arnold/.test(n)) return 3;
  if (/peso muerto|buenos días|buenos dias|hiperext/.test(n)) return 4; // fatiga lumbar: nunca antes de lo que exige estabilidad axial
  if (['Cuádriceps', 'Isquios', 'Gemelos', 'Glúteos'].includes(muscle)) return 5;
  return 6;
};

const sum = (items: AuditItem[], groups: MuscleGroup[]) => items.filter((i) => groups.includes(i.muscle) && !/posterior|pájaro|pajaro|face pull/i.test(i.name)).reduce((a, i) => a + i.sets, 0);

/** Revisión local (sin IA): equilibrio, rodilla y orden. Sirve de base y de respaldo. */
export function localAudit(items: AuditItem[]): AuditResult {
  const points: string[] = [];
  let status: Status = 'ok';

  const rear = items.filter((i) => i.muscle === 'Hombros' && /posterior|pájaro|pajaro|face pull/i.test(i.name)).reduce((a, i) => a + i.sets, 0);
  const push = sum(items, PUSH);
  const pull = sum(items, PULL) + rear;
  if (push + pull >= 4) {
    if (push > pull * 1.6) { points.push(`Hay mucho más empuje (${push} series) que tracción (${pull}). Añade remos o jalones para proteger los hombros y la postura.`); status = 'warn'; }
    else if (pull > push * 1.6) { points.push(`Hay más tracción (${pull} series) que empuje (${push}): vigila que pecho y hombro no queden descuidados.`); status = 'warn'; }
  }
  const quad = items.filter((i) => i.muscle === 'Cuádriceps').reduce((a, i) => a + i.sets, 0);
  const post = items.filter((i) => POSTERIOR.includes(i.muscle)).reduce((a, i) => a + i.sets, 0);
  if (quad + post >= 4) {
    if (quad > post * 1.6) { points.push(`Cadena anterior (${quad} series) muy por encima de la posterior (${post}). Sube femoral y glúteo para proteger las rodillas.`); status = 'warn'; }
    else if (post > quad * 2.2 && quad > 0) points.push('Predomina la cadena posterior: está bien para glúteo, pero no olvides algo de cuádriceps sin impacto.');
  }
  const kneeAlerts = items.filter((i) => isKneeUnsafe(i.name) || SEAT_RE.test(i.name)).map((i) => i.name);
  if (kneeAlerts.length) { points.unshift(`Ojo con tus rodillas: ${kneeAlerts.join(', ')} implica impacto o flexión profunda con compresión de la rótula. Cámbialo por prensa inclinada, peso muerto rumano o box squat controlado.`); status = 'alert'; }
  if (!items.some((i) => i.muscle === 'Abdominales') && items.length >= 4) points.push('No hay trabajo de abdominales: con tu objetivo de abdomen y tonificación, añade 2-3 series al final.');

  const order = items
    .map((i) => ({ i: i.index, r: rankOf(i.name, i.muscle) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.i);
  const moved = order.some((v, k) => v !== k);
  if (moved) points.push('He puesto primero los compuestos pesados (cuando hay más energía neural) y el aislamiento y el core al final.');
  if (points.length === 0) points.push('Rutina equilibrada y bien ordenada: no hay nada que cambiar.');
  return { status, points: points.slice(0, 3), order, kneeAlerts, source: 'local' };
}

export const isPermutation = (order: number[], n: number): boolean => order.length === n && new Set(order).size === n && order.every((v) => Number.isInteger(v) && v >= 0 && v < n);

/** Crea superseries antagonistas entre ejercicios consecutivos (entreno en casa). */
export function pairAntagonists(list: Rt[], byId: (id: string) => Exercise | undefined): Rt[] {
  const group = (m?: MuscleGroup): 'push' | 'pull' | 'quad' | 'post' | '' => (!m ? '' : PUSH.includes(m) ? 'push' : PULL.includes(m) ? 'pull' : m === 'Cuádriceps' ? 'quad' : POSTERIOR.includes(m) ? 'post' : '');
  const out = list.map((e) => ({ ...e }));
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i].superset || out[i + 1].superset) continue;
    const a = group(byId(out[i].exerciseId)?.muscleGroup);
    const b = group(byId(out[i + 1].exerciseId)?.muscleGroup);
    if ((a === 'push' && b === 'pull') || (a === 'pull' && b === 'push') || (a === 'quad' && b === 'post') || (a === 'post' && b === 'quad')) {
      const g = uid();
      out[i].superset = g;
      out[i + 1].superset = g;
      i++;
    }
  }
  return out;
}
