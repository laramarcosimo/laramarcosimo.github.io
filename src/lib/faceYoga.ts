import { faceArt } from './faceArt';

export type BodyPosition = 'Sentada' | 'Boca arriba' | 'Boca abajo';

export interface NightStep {
  id: string;
  title: string;
  position: BodyPosition;
  /** Herramienta (Gua Sha, rodillo, manos, cama). */
  tool?: string;
  /** Zona / enfoque del ejercicio. */
  focus: string;
  /** Técnica explicada. */
  how: string;
  /** Imagen (public/exercises/face). */
  image: string;
  /** Filas (del original de 2000×1493) a recortar arriba y abajo cuando la imagen trae título y texto integrados. */
  crop?: { top: number; bottom: number; h: number };
  /** Búsqueda de vídeo en YouTube. */
  url: string;
  /** Ejercicio por mitades (30 s + 30 s): nombre de cada mitad y aviso al cambiar. */
  halves?: [string, string];
  /** Aviso repetido cada X segundos (p. ej. tragar saliva). */
  pulse?: { every: number; label: string };
}

const yt = (q: string): string => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

export const WORK_SECONDS = 60;
export const REST_SECONDS = 5;

/** Texto honesto sobre qué esperar de la rutina. */
export const NIGHT_INFO =
  'Rutina de rescate de cuello y rostro con Gua Sha, rodillo de jade, manos y cama. Puedes cambiar ejercicios y tiempos: la duración total se recalcula sola. La evidencia del yoga facial es limitada (hay un pequeño ensayo clínico de 2018 con mejoras en la plenitud de las mejillas); para papada, cuello y frente los datos son escasos. Si funciona, es gradual: constancia diaria durante 8-12 semanas. Si notas mareo o molestia cervical al colgar o inclinar la cabeza, reduce el recorrido o salta ese ejercicio.';

// Imágenes con título y texto integrados (se recortan por encima y por debajo para dejar solo el dibujo).
const TEXT_CROP = { top: 165, bottom: 1250, h: 1493 };

export const OCULAR: NightStep = {
  id: 'ocular',
  title: 'Bloqueo ocular',
  position: 'Sentada',
  focus: 'Párpado caído y mirada abierta',
  how: 'Forma una «C» con los dedos índice y pulgar de cada mano. Apoya los índices bajo las cejas y los pulgares sobre los pómulos para fijar la piel. Cierra los ojos con fuerza contra la sujeción de tus dedos durante 5 segundos y relaja 3 segundos. Repite 6-7 veces.',
  image: '/exercises/face/n-ocular.jpg',
  crop: TEXT_CROP,
  url: yt('face yoga eye lid exercise orbicularis oculi'),
};
export const FRONTAL: NightStep = {
  id: 'frontal',
  title: 'Bloqueo frontal',
  position: 'Sentada',
  focus: 'Firmeza de cejas y alisado de frente',
  how: 'Coloca las palmas planas sobre toda la frente, justo encima de las cejas, y presiona con firmeza para anclar la piel. Intenta subir las cejas con fuerza sin permitir que se forme ningún pliegue. Mantén 8 segundos y relaja 3 sin retirar las manos. Repite 5 veces.',
  image: '/exercises/face/n-frontal.jpg',
  crop: TEXT_CROP,
  url: yt('face yoga forehead lines exercise hands'),
};

/** Rutina nocturna de 7 minutos. El minuto 1 depende del día del mes: pares → bloqueo ocular, impares → bloqueo frontal. */
export const nightSteps = (date: Date = new Date()): NightStep[] => [
  date.getDate() % 2 === 0 ? OCULAR : FRONTAL,
  {
    id: 'lingual',
    title: 'Planchado lingual interno',
    position: 'Sentada',
    focus: 'Código de barras y surco nasogeniano',
    how: 'Con la boca cerrada y la mandíbula relajada, pasa la punta de la lengua con presión firme por todo el contorno de los labios por dentro, entre los dientes y los labios. Círculos lentos y amplios: 30 segundos en un sentido y 30 en el contrario (te aviso a la mitad).',
    image: '/exercises/face/n-lingual.jpg',
    crop: TEXT_CROP,
    url: yt('face yoga tongue circles lips smoker lines'),
    halves: ['Sentido de las agujas del reloj', 'Sentido contrario'],
  },
  {
    id: 'lapiz',
    title: 'Lápiz dinámico',
    position: 'Sentada',
    focus: 'Pómulos, mejillas y elevadores labiales',
    how: 'Sostén un lápiz o bolígrafo en horizontal solo con los labios (sin tocar los dientes). Dibuja una sonrisa amplia y haz micro-elevaciones suaves de la cabeza, arriba y abajo, sin soltarlo.',
    image: '/exercises/face/n-lapiz.jpg',
    url: yt('face yoga pen smile cheek exercise'),
  },
  {
    id: 'beso',
    title: 'Besos al techo con anclaje',
    position: 'Sentada',
    focus: 'Platisma frontal y doble mentón',
    how: 'Cruza las manos y apóyalas firmes bajo las clavículas, tirando de la piel hacia abajo. Eleva la barbilla, adelanta la mandíbula y proyecta los labios en un beso firme hacia el techo. Aguanta 10 segundos, vuelve al centro y repite hasta completar el minuto (4 series).',
    image: '/exercises/face/n-beso.jpg',
    url: yt('ceiling kiss neck exercise face yoga'),
  },
  {
    id: 'lateral',
    title: 'Estiramiento lingual lateral',
    position: 'Sentada',
    focus: 'Esternocleidomastoideo y definición lateral del cuello',
    how: 'Con las manos en el pecho, gira la cabeza 45° hacia un lado y saca la lengua hacia la comisura de los labios durante 30 segundos, sin arquear los hombros. Después repite 30 segundos hacia el lado contrario.',
    image: '/exercises/face/n-lateral.jpg',
    url: yt('neck side stretch tongue face yoga sternocleidomastoid'),
    halves: ['Lado derecho', 'Lado izquierdo'],
  },
  {
    id: 'suspendida',
    title: 'Cabeza suspendida al borde',
    position: 'Boca arriba',
    focus: 'Tensión gravitacional de cuello y papada',
    how: 'Túmbate con los hombros al filo de la cama y deja caer la cabeza hacia atrás con cuidado, sin forzar. Mantén la posición tragando saliva cada 10 segundos para tensar los anillos del cuello. Para salir, apoya las manos en el colchón y sube la cabeza despacio.',
    image: '/exercises/face/n-suspendida.jpg',
    url: yt('head hanging off bed neck exercise'),
    pulse: { every: 10, label: 'Traga saliva ahora' },
  },
  {
    id: 'extension',
    title: 'Extensión cervical compensatoria',
    position: 'Boca abajo',
    focus: 'Musculatura posterior y corrección postural',
    how: 'Boca abajo con el pecho al borde de la cama y la cabeza colgando hacia el suelo. Eleva lentamente la cabeza hasta alinearla con la espalda y baja con control. 6 a 8 repeticiones lentas, sin tirones.',
    image: '/exercises/face/n-extension.jpg',
    url: yt('prone neck extension exercise bed'),
  },
];


export const REGLA_ORO = 'Regla de oro: aplica 4 a 5 gotas de aceite facial o crema densa en cuello, escote y rostro antes de empezar para que las piedras deslicen suavemente.';
const R = (id: string, title: string, tool: string, how: string, q: string, art: string, position: BodyPosition = 'Sentada', halves?: [string, string]): NightStep => ({
  id, title, tool, position, focus: tool, how, image: faceArt(art), url: yt(q), halves,
});
const RESCATE_DEF: [NightStep, number][] = [
  [R('r1', 'Borrador de frente', 'Gua Sha', 'Con la piedra a 15°, raspa en zig-zag sobre las arrugas de la frente y desliza hacia arriba hasta el pelo.', 'gua sha forehead lines technique', 'frente'), 45],
  [R('r2', 'Apertura y anclaje de entrecejo', 'Gua Sha', 'Sostén y ancla la ceja con una mano mientras acuestas la Gua Sha a 15° y deslizas desde el entrecejo subiendo hacia la sien.', 'gua sha entrecejo anclar ceja técnica', 'entrecejo'), 30],
  [R('r3', 'Bloqueo ocular', 'Manos', 'Inmoviliza las cejas con los dedos y abre bien los ojos usando solo los párpados, sin arrugar la frente.', 'face yoga eyelid lift anchor eyebrows exercise', 'ocular'), 30],
  [R('r4', 'Planchado labio superior', 'Gua Sha', 'Oculta levemente los labios y desliza el borde plano de la piedra desde bajo la nariz hacia las comisuras.', 'gua sha upper lip lines technique', 'labio'), 30],
  [R('r5', 'Alisado eleva-pómulos', 'Rodillo de jade', 'Con el cabezal grande, rueda desde la aleta de la nariz hacia las sienes para elevar mejillas sin arrugar nada.', 'jade roller cheekbones lift technique', 'pomulo', 'Sentada', ['Lado derecho', 'Lado izquierdo']), 40],
  [R('r6', 'Escultor mandibular', 'Gua Sha', 'Encaja la hendidura V de la piedra en el hueso de la mandíbula y arrastra firme desde la barbilla hasta la oreja.', 'gua sha jawline sculpting technique', 'mandibula', 'Sentada', ['Lado derecho', 'Lado izquierdo']), 40],
  [R('r7', 'Borrador de líneas del cuello', 'Gua Sha', 'Con la piedra casi plana (15°), realiza pases rápidos y suaves de zig-zag directamente sobre tus líneas horizontales.', 'gua sha neck lines technique', 'cuello'), 45],
  [R('r8', 'Planchado de cuello', 'Rodillo de jade', 'Cabezal grande. Rueda desde las clavículas hacia arriba hasta la barbilla con presión media para alisar la piel.', 'jade roller neck upward technique', 'rodillo'), 45],
  [R('r9', 'Drenaje cervical', 'Rodillo de jade', 'Rueda el cabezal grande desde detrás de las orejas hacia abajo por los laterales del cuello hasta las clavículas.', 'jade roller neck lymphatic drainage', 'drenaje'), 30],
  [R('r10', 'Besos al techo con anclaje', 'Manos', 'Apoya tus palmas fijando la piel sobre las clavículas, mira arriba y proyecta besos para estirar el platisma.', 'ceiling kiss neck platysma exercise', 'besos'), 45],
  [R('r11', 'Cabeza suspendida al borde', 'Cama', 'Tumbada boca arriba en la cama, deja la cabeza al aire un par de centímetros por el borde para tonificar los flexores.', 'head hanging off bed neck exercise', 'suspendida', 'Boca arriba'), 35],
  [R('r12', 'Extensión cervical', 'Cama', 'Tumbada boca abajo en la cama, eleva suavemente el pecho y relaja hombros para corregir la postura que provoca las arrugas.', 'prone neck extension exercise posture', 'extension', 'Boca abajo'), 30],
];
export const RESCATE: NightStep[] = RESCATE_DEF.map(([s]) => s);
const ALL = (date: Date): NightStep[] => [...RESCATE, OCULAR, FRONTAL, ...nightSteps(date)];

/** Duración total (rutina antigua): 7 ejercicios de 60 s y 6 pausas de 5 s. */
export const NIGHT_TOTAL_SECONDS = 7 * WORK_SECONDS + 6 * REST_SECONDS;

/** Un ejercicio de la rutina tal como lo personalizas: se guarda solo lo que cambias. */
export interface FaceStepCfg {
  id: string;
  /** Ejercicio propio (no viene de la biblioteca). */
  custom?: boolean;
  title?: string;
  /** Segundos TOTALES del ejercicio (si va por lados, se reparten a mitades). */
  seconds: number;
  /** Se hace un lado y luego el otro. */
  sides?: boolean;
  /** Foto propia (data URL pequeña). */
  image?: string;
  how?: string;
}
export interface FaceNightCfg {
  restSec: number;
  steps: FaceStepCfg[];
  /** Versión de la rutina por defecto (2 = Rescate cuello y rostro). */
  v?: number;
}
export type RunStep = NightStep & { seconds: number };

export const defaultNightCfg = (_date: Date = new Date()): FaceNightCfg => ({
  v: 2,
  restSec: 0,
  steps: RESCATE_DEF.map(([s, sec]) => ({ id: s.id, seconds: sec, sides: !!s.halves })),
});

/** Config activa: una guardada con la rutina antigua se sustituye por la de Rescate. */
export const activeNightCfg = (cfg: FaceNightCfg | undefined, date: Date = new Date()): FaceNightCfg => (cfg && cfg.v === 2 ? cfg : defaultNightCfg(date));

/** Aplica tu personalización a la biblioteca. Sin personalizar, es la rutina de siempre. */
export const resolveNight = (cfg: FaceNightCfg | undefined, date: Date = new Date()): { steps: RunStep[]; restSec: number } => {
  const c = activeNightCfg(cfg, date);
  const lib = new Map<string, NightStep>(ALL(date).map((s) => [s.id, s]));
  const steps = c.steps.map((k): RunStep => {
    const base = lib.get(k.id);
    const seconds = Math.max(5, Math.round(k.seconds || WORK_SECONDS));
    const own = !!k.image;
    return {
      id: k.id,
      title: k.title?.trim() || base?.title || 'Ejercicio',
      position: base?.position ?? 'Sentada',
      focus: base?.focus ?? '',
      how: k.how ?? base?.how ?? '',
      image: own ? k.image! : base?.image ?? '',
      crop: own ? undefined : base?.crop,
      tool: base?.tool,
      url: base?.url ?? '',
      halves: k.sides ? base?.halves ?? ['Lado derecho', 'Lado izquierdo'] : undefined,
      pulse: base?.pulse,
      seconds,
    };
  });
  return { steps, restSec: Math.max(0, Math.round(c.restSec)) };
};

/** Segundos de cada lado: la primera mitad (redondeada hacia arriba) y el resto. */
export const sideSeconds = (total: number): [number, number] => {
  const a = Math.ceil(total / 2);
  return [a, total - a];
};

export const nightTotal = (steps: { seconds: number }[], restSec: number): number => steps.reduce((a, s) => a + s.seconds, 0) + Math.max(0, steps.length - 1) * restSec;
