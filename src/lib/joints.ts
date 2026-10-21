import { isKneeUnsafe } from './knee';
import type { AppState, Discomfort } from './types';

export const JOINTS = ['Rodilla', 'Hombro', 'Codo / muñeca', 'Espalda baja', 'Cadera', 'Cuello'] as const;

/** Ejercicios que cargan especialmente cada articulación (para no proponerlos mientras molesta). */
const LOADS: Record<string, RegExp> = {
  Rodilla: /zancada|salto|jump|búlgara|bulgara|pistol|extensión de cuád|extension de cuad/i,
  Hombro: /press militar|press de hombro|press tras nuca|fondos|frontal|arnold|press con barra de pie/i,
  'Codo / muñeca': /fondos|francés|frances|predicador|curl con barra|press cerrado|rompecráneos/i,
  'Espalda baja': /peso muerto|buenos días|buenos dias|remo con barra|sentadilla con barra|hiperext/i,
  Cadera: /zancada|sumo|abducci|hip thrust|búlgara|bulgara/i,
  Cuello: /encog|tras nuca|trapecio/i,
};

const DAY = 86400000;

/** Articulaciones con molestia registrada en los últimos días. */
export const recentJoints = (log: Discomfort[], days = 7, now = Date.now()): string[] => [...new Set(log.filter((d) => now - d.ts <= days * DAY).map((d) => d.joint))];

/** ¿Este ejercicio carga alguna de las articulaciones con molestia? Devuelve cuál. */
export const loadsJoint = (name: string, joints: string[]): string | undefined => joints.find((j) => LOADS[j]?.test(name) || (j === 'Rodilla' && isKneeUnsafe(name)));

export const avoidFilter = (joints: string[]) => (name: string): boolean => !loadsJoint(name, joints);

/** Aviso si una misma articulación se repite (≥3 molestias en 14 días). */
export const recurrentJoint = (s: AppState, now = Date.now()): { joint: string; count: number } | null => {
  const recent = s.discomfort.filter((d) => now - d.ts <= 14 * DAY);
  const counts = new Map<string, number>();
  for (const d of recent) counts.set(d.joint, (counts.get(d.joint) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 3 ? { joint: top[0], count: top[1] } : null;
};
