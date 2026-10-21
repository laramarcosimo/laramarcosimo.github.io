import { BIG_DROP_CM, MIN_CHANGE_CM } from './measureRules';
import type { Measurement } from './types';

export type Tone = 'good' | 'warn' | 'neutral';

export interface Progress {
  count: number;
  first?: Measurement;
  latest?: Measurement;
  waistDelta: number | null;
  bellyDelta: number | null;
  weightDelta: number | null;
  whtr: number | null;
  verdict: { tone: Tone; text: string };
  /** Lecturas por medida: barriga baja y crecimiento (o bajada fuerte) de cadera, muslo, brazo y pecho. */
  notes: { tone: Tone; text: string }[];
}

type Field = 'waist' | 'belly' | 'weight' | 'hip' | 'thigh' | 'arm' | 'chest';

const withField = (list: Measurement[], f: Field) => list.filter((m) => typeof m[f] === 'number' && (m[f] as number) > 0);

/** Cambio entre la primera y la última medida registrada (null si hay menos de dos). */
const deltaOf = (list: Measurement[], f: Field): number | null => {
  const v = withField(list, f);
  return v.length >= 2 ? Math.round((v[v.length - 1][f]! - v[0][f]!) * 10) / 10 : null;
};

const GROWTH: { f: 'hip' | 'thigh' | 'arm' | 'chest'; label: string; up: string }[] = [
  { f: 'hip', label: 'La cadera', up: 'más glúteo' },
  { f: 'thigh', label: 'El muslo', up: 'más músculo' },
  { f: 'arm', label: 'El brazo', up: 'más músculo' },
  { f: 'chest', label: 'El pecho', up: 'más músculo' },
];

const buildNotes = (list: Measurement[]): Progress['notes'] => {
  const notes: Progress['notes'] = [];
  const belly = deltaOf(list, 'belly');
  if (belly !== null) {
    if (belly <= -MIN_CHANGE_CM) notes.push({ tone: 'good', text: `La barriga baja baja ${Math.abs(belly)} cm: vas perdiendo la grasa que más te interesa.` });
    else if (belly >= MIN_CHANGE_CM) notes.push({ tone: 'warn', text: `La barriga baja sube ${belly} cm. Revisa calorías, sueño y mide siempre en las mismas condiciones.` });
  }
  for (const g of GROWTH) {
    const d = deltaOf(list, g.f);
    if (d === null) continue;
    if (d >= MIN_CHANGE_CM) notes.push({ tone: 'good', text: `${g.label} sube ${d} cm: es ${g.up}, buena señal.` });
    else if (d <= -BIG_DROP_CM) notes.push({ tone: 'warn', text: `${g.label} baja ${Math.abs(d)} cm: no es lo que buscas ahí. Revisa que comes suficiente proteína y calorías y que sigues progresando en fuerza.` });
  }
  return notes;
};

/**
 * Lectura de la recomposición: lo que importa es la CINTURA (grasa abdominal) y la fuerza, no el peso.
 * Cintura ↓ con peso estable o ↑ = pierdes grasa y ganas músculo.
 */
export function analyze(measurements: Measurement[], heightCm: number): Progress {
  const list = [...measurements].sort((a, b) => a.ts - b.ts);
  const waists = withField(list, 'waist');
  const weights = withField(list, 'weight');
  const waistDelta = waists.length >= 2 ? Math.round((waists[waists.length - 1].waist! - waists[0].waist!) * 10) / 10 : null;
  const bellyDelta = deltaOf(list, 'belly');
  const weightDelta = weights.length >= 2 ? Math.round((weights[weights.length - 1].weight! - weights[0].weight!) * 10) / 10 : null;
  const lastWaist = waists[waists.length - 1]?.waist;
  const whtr = lastWaist && heightCm > 0 ? Math.round((lastWaist / heightCm) * 100) / 100 : null;

  let verdict: Progress['verdict'] = { tone: 'neutral', text: 'Registra tu cintura cada semana (mismo día, en ayunas) para ver cómo evoluciona tu grasa abdominal.' };
  if (waistDelta !== null) {
    const wd = weightDelta ?? 0;
    if (waistDelta <= -0.5 && wd >= -0.5) verdict = { tone: 'good', text: `Recomposición en marcha: la cintura baja ${Math.abs(waistDelta)} cm sin perder peso. Pierdes grasa y ganas músculo` };
    else if (waistDelta <= -0.5) verdict = { tone: 'good', text: `Pierdes grasa abdominal (${waistDelta} cm). Vigila que tu fuerza no baje: mantén la proteína y progresa en tus ejercicios.` };
    else if (waistDelta >= 0.5 && wd > 0) verdict = { tone: 'warn', text: 'El peso y la cintura suben: parte puede ser grasa. Ajusta calorías (más déficit ligero) y revisa porciones.' };
    else if (waistDelta >= 0.5) verdict = { tone: 'warn', text: 'La cintura sube. Revisa sodio, sueño y calorías; mide siempre en las mismas condiciones.' };
    else verdict = { tone: 'neutral', text: 'Cintura estable. Con déficit ligero y entrenamiento constante, los cambios se notan a las 3-4 semanas.' };
  }
  return { count: list.length, first: list[0], latest: list[list.length - 1], waistDelta, bellyDelta, weightDelta, whtr, verdict, notes: buildNotes(list) };
}
