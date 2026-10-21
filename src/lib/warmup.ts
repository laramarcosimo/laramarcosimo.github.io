import type { Motion } from '../components/BodyMap';
import type { MuscleKey } from './muscles';
import type { Exercise } from './types';

export interface WarmupItem {
  /** Clave para guardar el vídeo de demostración. */
  key: string;
  name: string;
  detail: string;
  /** Duración del bloque (s). */
  seconds: number;
  /** Partes del bloque que se van alternando (p. ej. pierna derecha / izquierda). */
  splits?: string[];
  /** Ejercicio de la biblioteca abierta (ExerciseDB abierto, id de la animación; vacío = ilustración vectorial) cuya animación se usa como demostración. */
  img: string;
  muscles: string[];
  /** Mapa muscular y animación del movimiento. */
  bm: MuscleKey[];
  motion: Motion;
  tips: [string, string, string];
}

export interface WarmupPlan {
  title: string;
  items: WarmupItem[];
  why: string;
  /** Siempre 3 min como máximo. */
  minutes: number;
  kind: 'inferior' | 'torso' | 'mixto';
}

const LEGS = ['Pierna derecha', 'Pierna izquierda'];

const legSwing = (s: number): WarmupItem => ({ key: 'wu-leg-swings', name: 'Balanceos de pierna (leg swings)', detail: `Adelante y atrás, pendular y suave, apoyándote en una pared o máquina · ${s / 2} s por pierna`, seconds: s, splits: LEGS, img: '', bm: ['hip', 'hamstrings', 'quads'], motion: 'swing-front', muscles: ['Cadera', 'Isquios', 'Cuádriceps'], tips: ['Apóyate en una pared o máquina y mantén el torso erguido', 'Balancea la pierna como un péndulo, sin patada ni rebote; el rango crece poco a poco', 'Rodilla de apoyo ligeramente flexionada y core activo; sin impactos'] });
const sideSwing = (s: number): WarmupItem => ({ key: 'wu-side-swings', name: 'Patadas laterales pendulares (side-to-side swings)', detail: `Balancea la pierna suavemente cruzando por delante del cuerpo · ${s / 2} s por pierna`, seconds: s, splits: LEGS, img: '', bm: ['hip', 'glutes'], motion: 'swing-side', muscles: ['Aductores', 'Abductores', 'Cadera'], tips: ['Cruza la pierna por delante del cuerpo y ábrela hacia fuera como un péndulo', 'Pelvis estable: el movimiento sale de la cadera, no de la espalda', 'Suave y sin forzar el final del recorrido'] });
const hipOpener = (s: number): WarmupItem => ({ key: 'wu-hip-openers', name: 'Círculos de cadera (puerta abierta)', detail: `Sube la rodilla hacia el pecho y ábrela en círculo hacia fuera, suave · ${s / 2} s por pierna`, seconds: s, splits: LEGS, img: '', bm: ['hip', 'glutes'], motion: 'hip-circle', muscles: ['Cadera', 'Glúteo medio', 'Rotadores'], tips: ['Sube la rodilla hacia el pecho de forma controlada', 'Ábrela en círculo hacia fuera, como una puerta, y vuelve', 'Apóyate en una pared; pie de apoyo firme y rodilla sin bloquear'] });
const armCircles = (s: number): WarmupItem => ({ key: 'wu-arm-circles', name: 'Círculos de brazos controlados', detail: 'Grandes y suaves, primero hacia delante y luego hacia atrás', seconds: s, splits: ['Hacia delante', 'Hacia atrás'], img: '', bm: ['shoulders'], motion: 'arm-circles', muscles: ['Hombros', 'Escápulas'], tips: ['Brazos estirados a la altura de los hombros', 'Círculos grandes y controlados, sin encoger los hombros', 'Cambia de sentido a mitad del bloque'] });
const chestOpen = (s: number): WarmupItem => ({ key: 'wu-chest-open', name: 'Aperturas de pecho y abrazos dinámicos', detail: 'Abre los brazos en cruz y abrázate, alternando con fluidez', seconds: s, img: '3uj0Ozg', bm: ['chest', 'shoulders'], motion: 'chest-open', muscles: ['Pecho', 'Hombro anterior'], tips: ['Abre los brazos en cruz llevando los codos atrás', 'Abrázate y repite de forma fluida, sin rebotar', 'Respira: inhala al abrir y exhala al cerrar'] });
const dislocates = (s: number): WarmupItem => ({ key: 'wu-dislocates', name: 'Dislocaciones escapulares y rotaciones de hombro', detail: 'Con toalla o pica (agarre ancho) o sin material; brazos estirados, lento y sin dolor', seconds: s, img: '', bm: ['shoulders', 'traps'], motion: 'dislocates', muscles: ['Hombros', 'Escápulas', 'Manguito rotador'], tips: ['Agarre ancho con toalla o pica, brazos estirados', 'Pasa los brazos por encima de la cabeza hacia atrás hasta donde permitan tus hombros', 'Si duele o se doblan los codos, abre más el agarre'] });

const WHY = 'Movilidad dinámica suave: despierta las articulaciones y lubrica el líquido sinovial sin gastar energía neural antes de levantar carga. No hay impactos, saltos ni flexiones profundas en frío, así que es seguro para tus rodillas.';

/** Calentamiento ágil de 3 minutos exactos (180 s), de movilidad articular fluida y sin fatiga, según la rutina de hoy. */
export function localWarmup(all: Exercise[]): WarmupPlan {
  const exs = all.filter((e) => e.id !== 'Walking_Treadmill' && !e.timed); // cardio y rostro no cuentan
  const lower = exs.filter((e) => ['Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos'].includes(e.muscleGroup)).length;
  const upper = exs.length - lower;
  const kind: WarmupPlan['kind'] = lower > 0 && upper > 0 ? 'mixto' : lower > 0 ? 'inferior' : 'torso';

  let items: WarmupItem[];
  if (kind === 'inferior' || (kind === 'mixto' && lower >= upper * 2)) items = [legSwing(60), sideSwing(60), hipOpener(60)];
  else if (kind === 'torso' || (kind === 'mixto' && upper >= lower * 2)) items = [armCircles(45), chestOpen(45), dislocates(90)];
  else items = [legSwing(40), hipOpener(40), armCircles(30), chestOpen(30), dislocates(40)];

  return {
    title: items[0].key.startsWith('wu-leg') && items.length === 3 ? 'Calentamiento de piernas' : items[0].key === 'wu-arm-circles' && items.length === 3 ? 'Calentamiento de torso' : 'Calentamiento mixto',
    items,
    why: WHY,
    minutes: 3,
    kind,
  };
}
