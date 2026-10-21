import type { Exercise, MuscleGroup } from './types';

export type MuscleKey = 'face' | 'neck' | 'traps' | 'shoulders' | 'chest' | 'biceps' | 'triceps' | 'forearms' | 'abs' | 'obliques' | 'lats' | 'lowerBack' | 'hip' | 'glutes' | 'quads' | 'hamstrings' | 'calves';

export interface Targets {
  primary: MuscleKey[];
  secondary: MuscleKey[];
}

/** Grupos que solo se ven por la espalda / solo de frente (para elegir la vista de la miniatura). */
export const BACK_ONLY: MuscleKey[] = ['traps', 'lats', 'lowerBack', 'glutes', 'hamstrings', 'triceps'];
export const FRONT_ONLY: MuscleKey[] = ['chest', 'abs', 'obliques', 'quads', 'biceps', 'face'];

const BY_GROUP: Record<MuscleGroup, Targets> = {
  Pecho: { primary: ['chest'], secondary: ['shoulders', 'triceps'] },
  Espalda: { primary: ['lats'], secondary: ['biceps', 'traps'] },
  Hombros: { primary: ['shoulders'], secondary: ['triceps', 'traps'] },
  Bíceps: { primary: ['biceps'], secondary: ['forearms'] },
  Tríceps: { primary: ['triceps'], secondary: ['shoulders'] },
  Cuádriceps: { primary: ['quads'], secondary: ['glutes'] },
  Isquios: { primary: ['hamstrings'], secondary: ['glutes', 'lowerBack'] },
  Glúteos: { primary: ['glutes'], secondary: ['hamstrings'] },
  Gemelos: { primary: ['calves'], secondary: [] },
  Abdominales: { primary: ['abs'], secondary: ['obliques'] },
  'Rostro y Cuello': { primary: ['face', 'neck'], secondary: [] },
  Estiramientos: { primary: [], secondary: [] },
};

/** Músculo que trabaja cada estiramiento, según su nombre (para el mapa corporal). */
const STRETCH_TARGETS: [RegExp, Targets][] = [
  [/cu[aá]driceps/, { primary: ['quads'], secondary: [] }],
  [/isquios|femoral/, { primary: ['hamstrings'], secondary: ['calves'] }],
  [/gemelo/, { primary: ['calves'], secondary: [] }],
  [/gl[uú]teo|paloma|figura 4/, { primary: ['glutes'], secondary: ['hip'] }],
  [/aductor|mariposa/, { primary: ['hip'], secondary: [] }],
  [/flexor de la cadera|zancada/, { primary: ['hip', 'quads'], secondary: [] }],
  [/pecho/, { primary: ['chest'], secondary: ['shoulders'] }],
  [/hombro/, { primary: ['shoulders'], secondary: [] }],
  [/tr[ií]ceps/, { primary: ['triceps'], secondary: [] }],
  [/b[ií]ceps/, { primary: ['biceps'], secondary: ['forearms'] }],
  [/dorsal|ni[ñn]o|espalda alta/, { primary: ['lats'], secondary: ['lowerBack'] }],
  [/lumbar|gato|columna/, { primary: ['lowerBack'], secondary: ['abs'] }],
  [/cobra|abdom/, { primary: ['abs'], secondary: [] }],
  [/lateral de tronco|oblicu/, { primary: ['obliques'], secondary: ['lats'] }],
  [/cuello|trapecio/, { primary: ['neck', 'traps'], secondary: [] }],
];

/** Músculos diana de un ejercicio (por su nombre y, si no, por su grupo muscular). */
export function targetsFor(ex: Pick<Exercise, 'name' | 'muscleGroup'>): Targets {
  const n = ex.name.toLowerCase();
  const t = (primary: MuscleKey[], secondary: MuscleKey[] = []): Targets => ({ primary, secondary });
  if (ex.muscleGroup === 'Estiramientos') return STRETCH_TARGETS.find(([r]) => r.test(n))?.[1] ?? { primary: [], secondary: [] };
  if (/cinta|treadmill/.test(n)) return t(['quads', 'calves'], ['hamstrings', 'glutes']);
  if (/jalón de tríceps|tríceps|francés|fondos en banco|patada de tr/.test(n)) return t(['triceps'], ['shoulders']);
  if (/press de hombros|press.*(hombro|militar|arnold)/.test(n)) return t(['shoulders'], ['triceps', 'traps']);
  if (/hip thrust|empuje de caderas|puente de gl/.test(n)) return t(['glutes', 'hamstrings'], ['quads']);
  if (/hiperextensión inversa/.test(n)) return t(['glutes', 'hamstrings'], ['lowerBack']);
  if (/hiperext/.test(n)) return t(['lowerBack', 'glutes'], ['hamstrings']);
  if (/peso muerto|rumano|buenos d/.test(n)) return t(['hamstrings', 'glutes', 'lowerBack'], ['traps', 'forearms']);
  if (/aducci/.test(n)) return t(['hip'], ['quads']);
  if (/abducci/.test(n)) return t(['glutes', 'hip']);
  if (/prensa|press de piernas|sentadilla|hack|zancada|búlgara|bulgara|cajón|subida|goblet|step-up|extensión de cu/.test(n)) return t(['quads', 'glutes'], ['hamstrings', 'calves']);
  if (/jalón|dominada|pull-over|pullover/.test(n)) return t(['lats', 'biceps'], ['traps', 'forearms']);
  if (/remo/.test(n)) return t(['lats', 'traps'], ['biceps', 'shoulders']);
  if (/curl con|curl de|curl en|curl martillo|curl inclinado|curl predicador|bíceps/.test(n) && !/femoral/.test(n)) return t(['biceps'], ['forearms']);
  if (/femoral/.test(n)) return t(['hamstrings'], ['calves']);
  if (/elevaci.*lateral|elevaciones laterales|pájaro|face pull/.test(n)) return t(['shoulders'], ['traps']);
  if (/flexion|fondos en paralelas \(pecho/.test(n)) return t(['chest', 'triceps'], ['shoulders', 'abs']);
  if (/press.*(banca|pecho|plano|máquina)|apertura|cruce|pec deck/.test(n)) return t(['chest'], ['shoulders', 'triceps']);
  if (/press.*(hombro|militar|arnold)/.test(n)) return t(['shoulders'], ['triceps', 'traps']);
  if (/gemelo/.test(n)) return t(['calves']);
  if (/plancha|crunch|abdominal|rueda|russian/.test(n)) return t(['abs', 'obliques']);
  return BY_GROUP[ex.muscleGroup] ?? { primary: [], secondary: [] };
}
