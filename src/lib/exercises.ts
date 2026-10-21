import type { Equipment, Exercise, MuscleGroup, RoutineTemplate } from './types';

import { EXERCISE_GIFS } from './exerciseGifs';

/** Ilustraciones anatómicas animadas (ExerciseDB abierto): figura gris sobre fondo blanco, músculo activo resaltado. Sin fotos de gimnasio. */
const GIF_BASE = 'https://static.exercisedb.dev/media';
export const gifUrl = (edbId: string): string => `${GIF_BASE}/${edbId}.gif`;
/** Animación de un ejercicio de la biblioteca (por su id interno); cadena vacía si no hay equivalente (se usa una ilustración vectorial). */
/** Fotos reales (free-exercise-db, dominio público) guardadas en la app para los ejercicios sin animación disponible. */
export const PHOTO_IDS = new Set(['Barbell_Hip_Thrust', 'Plank', 'Dumbbell_Floor_Press', 'Superman', 'Box_Squat', 'Plie_Dumbbell_Squat', 'wall-sit']);
/** Ejercicios que se quitaron de la biblioteca (sin imagen propia): se retiran también de las rutinas guardadas. */
export const REMOVED_IDS = new Set(['Step-up_with_Knee_Raise', 'Band_Good_Morning', 'Band_Skull_Crusher', 'Cross_Over_-_With_Bands']);
export const photoUrl = (id: string): string => `/exercises/photo/${id}.jpg?v=3`;
export const builtinImageUrl = (id: string): string => (EXERCISE_GIFS[id] ? gifUrl(EXERCISE_GIFS[id]) : PHOTO_IDS.has(id) ? photoUrl(id) : '');
/** Póster (primer fotograma, JPG ligero guardado en la propia app) de la animación de un ejercicio: miniaturas instantáneas y sin red. */
export const posterUrl = (imageUrl: string): string => {
  if (imageUrl.startsWith('/exercises/photo/')) return imageUrl;
  const m = imageUrl.match(/\/media\/([A-Za-z0-9]+)\.gif$/);
  return m ? `/exercises/poster/${m[1]}.jpg` : '';
};
export const posterOfEdb = (edbId: string): string => (edbId ? `/exercises/poster/${edbId}.jpg` : '');
/** Versión del esquema de imágenes: al subirla, las URLs guardadas se sustituyen por las nuevas. */
export const DB_VERSION = 3;

export const MUSCLE_GROUPS: MuscleGroup[] = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos', 'Abdominales', 'Rostro y Cuello', 'Estiramientos'];
export const EQUIPMENT: Equipment[] = ['Barra', 'Mancuernas', 'Máquina', 'Polea', 'Peso Corporal', 'Kettlebell', 'Banda'];

/** Filtros agrupados del selector. */
export const MUSCLE_FILTERS: Record<string, MuscleGroup[]> = {
  Pecho: ['Pecho'],
  Espalda: ['Espalda'],
  Piernas: ['Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos'],
  Hombros: ['Hombros'],
  Brazos: ['Bíceps', 'Tríceps'],
  Abdominales: ['Abdominales'],
  'Rostro y cuello': ['Rostro y Cuello'],
  Estiramientos: ['Estiramientos'],
};

type Row = [id: string, name: string, muscle: MuscleGroup, eq: Equipment];
const B = 'Barra', M = 'Mancuernas', Q = 'Máquina', P = 'Polea', C = 'Peso Corporal', K = 'Kettlebell', N = 'Banda';

const ROWS: Row[] = [
  ['Barbell_Bench_Press_-_Medium_Grip', 'Press de banca (barra)', 'Pecho', B],
  ['Incline_Dumbbell_Press', 'Press banca inclinado (mancuernas)', 'Pecho', M],
  ['Barbell_Incline_Bench_Press_-_Medium_Grip', 'Press banca inclinado (barra)', 'Pecho', B],
  ['Dumbbell_Bench_Press', 'Press de banca (mancuernas)', 'Pecho', M],
  ['Dumbbell_Flyes', 'Aperturas con mancuernas', 'Pecho', M],
  ['Cable_Crossover', 'Cruce de poleas', 'Pecho', P],
  ['Dips_-_Chest_Version', 'Fondos en paralelas (pecho)', 'Pecho', C],
  ['Machine_Bench_Press', 'Press Plano Máquina', 'Pecho', Q],
  ['Butterfly', 'Pec deck', 'Pecho', Q],
  ['Pushups', 'Flexiones', 'Pecho', C],
  ['Pullups', 'Dominadas', 'Espalda', C],
  ['Wide-Grip_Lat_Pulldown', 'Jalón al Pecho (Cable)', 'Espalda', P],
  ['Bent_Over_Barbell_Row', 'Remo con barra', 'Espalda', B],
  ['One-Arm_Dumbbell_Row', 'Remo con Mancuerna', 'Espalda', M],
  ['Seated_Cable_Rows', 'Remo Sentado con Agarre en V (Cable)', 'Espalda', P],
  ['Bent_Over_Two-Dumbbell_Row', 'Remo con dos mancuernas', 'Espalda', M],
  ['Barbell_Deadlift', 'Peso Muerto (Barra)', 'Espalda', B],
  ['Straight-Arm_Pulldown', 'Pull-over en polea', 'Espalda', P],
  ['Hyperextensions_Back_Extensions', 'Extensión de Espalda (Hiperextensión con peso)', 'Espalda', C],
  ['Barbell_Squat', 'Sentadilla (barra)', 'Cuádriceps', B],
  ['Front_Barbell_Squat', 'Sentadilla frontal', 'Cuádriceps', B],
  ['Leg_Press', 'Press de Piernas Sentado', 'Cuádriceps', Q],
  ['Leg_Extensions', 'Extensión de cuádriceps', 'Cuádriceps', Q],
  ['Split_Squat_with_Dumbbells', 'Sentadilla Búlgara (Mancuerna)', 'Cuádriceps', M],
  ['Dumbbell_Lunges', 'Zancadas', 'Cuádriceps', M],
  ['Hack_Squat', 'Hack squat', 'Cuádriceps', Q],
  ['Goblet_Squat', 'Sentadilla goblet', 'Cuádriceps', K],
  ['Standing_Calf_Raises', 'Elevación de gemelos de pie', 'Gemelos', Q],
  ['Romanian_Deadlift', 'Peso muerto rumano', 'Isquios', B],
  ['Lying_Leg_Curls', 'Curl femoral tumbado', 'Isquios', Q],
  ['Seated_Leg_Curl', 'Curl femoral sentado', 'Isquios', Q],
  ['Good_Morning', 'Buenos días', 'Isquios', B],
  ['Natural_Glute_Ham_Raise', 'Curl nórdico', 'Isquios', C],
  ['Barbell_Hip_Thrust', 'Empuje de Caderas (Barra)', 'Glúteos', B],
  ['Thigh_Abductor', 'Abducción de Cadera (Máquina)', 'Glúteos', Q],
  ['Standing_Military_Press', 'Press militar (barra)', 'Hombros', B],
  ['Dumbbell_Shoulder_Press', 'Press militar (mancuernas)', 'Hombros', M],
  ['Side_Lateral_Raise', 'Elevación Lateral (Mancuerna)', 'Hombros', M],
  ['Front_Dumbbell_Raise', 'Elevaciones frontales', 'Hombros', M],
  ['Reverse_Flyes', 'Pájaros (posterior)', 'Hombros', M],
  ['Face_Pull', 'Face pull', 'Hombros', P],
  ['Arnold_Dumbbell_Press', 'Press Arnold', 'Hombros', M],
  ['Upright_Barbell_Row', 'Remo al mentón', 'Hombros', B],
  ['Dumbbell_Shrug', 'Encogimientos (trapecio)', 'Hombros', M],
  ['Kettlebell_Arnold_Press', 'Press Arnold (kettlebell)', 'Hombros', K],
  ['Barbell_Curl', 'Curl con barra', 'Bíceps', B],
  ['Dumbbell_Bicep_Curl', 'Curl de Bíceps (Mancuerna)', 'Bíceps', M],
  ['Hammer_Curls', 'Curl martillo', 'Bíceps', M],
  ['Preacher_Curl', 'Curl predicador', 'Bíceps', B],
  ['Standing_Biceps_Cable_Curl', 'Curl en polea', 'Bíceps', P],
  ['Incline_Dumbbell_Curl', 'Curl inclinado', 'Bíceps', M],
  ['Triceps_Pushdown', 'Extensión de tríceps en polea', 'Tríceps', P],
  ['EZ-Bar_Skullcrusher', 'Press francés', 'Tríceps', B],
  ['Bench_Dips', 'Fondos en banco', 'Tríceps', C],
  ['Dips_-_Triceps_Version', 'Fondos en paralelas (tríceps)', 'Tríceps', C],
  ['Standing_Dumbbell_Triceps_Extension', 'Extensión sobre la cabeza', 'Tríceps', M],
  ['Close-Grip_Barbell_Bench_Press', 'Press cerrado', 'Tríceps', B],
  ['Tricep_Dumbbell_Kickback', 'Patada de tríceps', 'Tríceps', M],
  ['Plank', 'Plancha', 'Abdominales', C],
  ['Crunches', 'Crunch', 'Abdominales', C],
  ['Hanging_Leg_Raise', 'Elevación de piernas colgado', 'Abdominales', C],
  ['Ab_Roller', 'Rueda abdominal', 'Abdominales', C],
  ['Cable_Crunch', 'Crunch en polea', 'Abdominales', P],
  ['Russian_Twist', 'Russian twist', 'Abdominales', C],
  ['Side_Bridge', 'Plancha lateral', 'Abdominales', C],
  // Ejercicios aptos para entrenar en casa
  ['Decline_Push-Up', 'Flexiones declinadas', 'Pecho', C],
  ['Push-Up_Wide', 'Flexiones anchas', 'Pecho', C],
  ['Dumbbell_Floor_Press', 'Press en suelo (mancuernas)', 'Pecho', M],
  ['Bench_Press_-_With_Bands', 'Press de pecho con banda', 'Pecho', N],
  ['Inverted_Row', 'Remo invertido (mesa/barra baja)', 'Espalda', C],
  ['Chin-Up', 'Dominadas supinas', 'Espalda', C],
  ['Superman', 'Superman', 'Espalda', C],
  ['Band_Pull_Apart', 'Band pull apart', 'Espalda', N],
  ['Two-Arm_Kettlebell_Row', 'Remo con kettlebell', 'Espalda', K],
  ['Bodyweight_Squat', 'Sentadilla con peso corporal', 'Cuádriceps', C],
  ['Freehand_Jump_Squat', 'Sentadilla con salto', 'Cuádriceps', C],
  ['Bodyweight_Walking_Lunge', 'Zancadas caminando', 'Cuádriceps', C],
  ['Dumbbell_Squat', 'Sentadilla con mancuernas', 'Cuádriceps', M],
  ['Squats_-_With_Bands', 'Sentadilla con banda', 'Cuádriceps', N],
  ['Stiff-Legged_Dumbbell_Deadlift', 'Peso muerto rumano (mancuernas)', 'Isquios', M],
  ['Single_Leg_Glute_Bridge', 'Puente de glúteo a una pierna', 'Glúteos', C],
  ['Butt_Lift_Bridge', 'Puente de glúteo', 'Glúteos', C],
  ['Hip_Extension_with_Bands', 'Extensión de cadera con banda', 'Glúteos', N],
  ['One-Arm_Kettlebell_Swings', 'Swing con kettlebell', 'Glúteos', K],
  ['Calf_Raise_On_A_Dumbbell', 'Gemelos con mancuerna', 'Gemelos', M],
  ['Calf_Raises_-_With_Bands', 'Gemelos con banda', 'Gemelos', N],
  ['Two-Arm_Kettlebell_Military_Press', 'Press militar con kettlebell', 'Hombros', K],
  ['Shoulder_Press_-_With_Bands', 'Press de hombro con banda', 'Hombros', N],
  ['Lateral_Raise_-_With_Bands', 'Elevaciones laterales con banda', 'Hombros', N],
  ['Reverse_Crunch', 'Crunch inverso', 'Abdominales', C],
  ['Dumbbell_Squat_To_A_Bench', 'Sentadilla a banco (mancuernas)', 'Cuádriceps', M],
  // Ejercicios de las rutinas de la semana (Hevy)
  ['Box_Squat', 'Sentadilla al Cajón (Barra)', 'Cuádriceps', B],
  ['Thigh_Adductor', 'Aducción de Cadera (Máquina)', 'Glúteos', Q],
  ['Reverse_Hyperextension', 'Hiperextensión Inversa', 'Glúteos', Q],
  ['Leverage_Incline_Chest_Press', 'Press de Pecho Inclinado (Máquina)', 'Pecho', Q],
  ['Machine_Shoulder_Military_Press', 'Press de Hombros Sentado (Máquina)', 'Hombros', Q],
  ['Triceps_Pushdown_-_Rope_Attachment', 'Jalón de tríceps con cuerda', 'Tríceps', P],
  ['Plie_Dumbbell_Squat', 'Sentadilla Sumo (Mancuerna)', 'Cuádriceps', M],
  ['Dumbbell_Step_Ups', 'Subida al Cajón (Mancuerna)', 'Cuádriceps', M],
  ['Standing_Dumbbell_Calf_Raise', 'Elevación de Gemelos de Pie (Mancuerna)', 'Gemelos', M],
  ['Walking_Treadmill', 'Cinta', 'Cuádriceps', Q],
];

export const noRecords = () => ({ maxWeight: 0, maxVolume: 0, best1RM: 0 });

export const BUILTIN_EXERCISES: Exercise[] = ROWS.map(([id, name, muscleGroup, equipment]) => ({
  id,
  name,
  muscleGroup,
  equipment,
  imageUrl: builtinImageUrl(id),
  personalRecords: noRecords(),
}));

// Ejercicios de protección de rodilla sin ilustración propia en la biblioteca (usan icono / imagen equivalente).
BUILTIN_EXERCISES.push(
  { id: 'wall-sit', name: 'Sentadilla isométrica en pared (wall sit)', muscleGroup: 'Cuádriceps', equipment: 'Peso Corporal', imageUrl: photoUrl('wall-sit'), personalRecords: noRecords() },
  { id: 'chair-box-squat', name: 'Box squat a silla (controlado)', muscleGroup: 'Cuádriceps', equipment: 'Peso Corporal', imageUrl: builtinImageUrl('Bodyweight_Squat'), personalRecords: noRecords() },
);

// Ejercicios que se hacen de una pierna/brazo cada vez: sus series salen en parejas I → D (izquierda primero).
for (const e of BUILTIN_EXERCISES) if (['Dumbbell_Lunges', 'Bodyweight_Walking_Lunge', 'Split_Squat_with_Dumbbells', 'Single_Leg_Glute_Bridge', 'Dumbbell_Step_Ups', 'One-Arm_Dumbbell_Row'].includes(e.id)) e.unilateral = true;

// Rostro y cuello (yoga facial): se registran por tiempo, sin peso. Animación SVG ligera en public/exercises/face.
const face = (id: string, name: string, file: string, instructions: string, tips: [string, string, string]): Exercise => ({ id, name, muscleGroup: 'Rostro y Cuello', equipment: 'Peso Corporal', imageUrl: `/exercises/face/${file}.svg`, personalRecords: noRecords(), timed: true, instructions, tips });
BUILTIN_EXERCISES.push(
  face('face-jawline', 'Definición de mandíbula (jawline sculpt)', 'jawline', 'Con el índice y el corazón en forma de gancho (o con los nudillos), desliza desde la punta de la barbilla a lo largo de la mandíbula hasta la base de las orejas y baja suavemente por el cuello. Elimina retención de líquidos (papada) y define el ángulo mandibular.', [
    'Presión adecuada: firme pero sin tirar de la piel; usa crema o sérum para que deslice.',
    'Sentido del movimiento: de la barbilla hacia la oreja y después hacia abajo por el cuello.',
    'Respiración relajada: inspira por la nariz y suelta el aire despacio, con los hombros bajos.',
  ]),
  face('neck-platysma', 'Platisma: cuello y papada (isométrico)', 'platysma', 'Inclina la cabeza ligeramente hacia atrás (≈45°), pega la lengua con firmeza al paladar y proyecta la mandíbula inferior suavemente hacia delante hasta notar tensión en el cuello, sin colapsar las cervicales. Tonifica el cuello y previene el descolgamiento.', [
    'Presión adecuada: no empujes con las manos; la tensión sale del propio músculo y no debe doler.',
    'Sentido del movimiento: mandíbula hacia delante y arriba, nuca larga, sin hundir el cuello.',
    'Respiración relajada: respira con normalidad, sin aguantar el aire.',
  ]),
  face('face-cheek', 'Elevación de pómulos (cheek lifter)', 'cheek', 'Forma una «O» alargada cubriendo los dientes con los labios y eleva las comisuras hacia los ojos, como una sonrisa contenida, mientras los dedos índices sujetan la piel para evitar arrugas gestuales. Estimula el riego sanguíneo y eleva los pómulos caídos.', [
    'Presión adecuada: apoyo ligero con los índices, sin estirar la piel seca (usa crema o sérum).',
    'Sentido del movimiento: comisuras hacia los ojos; pómulos arriba y atrás.',
    'Respiración relajada: respira por la nariz y mantén frente y ojos tranquilos.',
  ]),
  face('face-lymph', 'Drenaje linfático y clavículas', 'lymph', 'Masaje suave con las yemas de los dedos desde detrás de la oreja, descendiendo por el esternocleidomastoideo hasta el hueco de la clavícula, para guiar el drenaje hacia los ganglios linfáticos.', [
    'Presión adecuada: muy suave, como una caricia; sin hundir los dedos ni frotar en seco (usa crema o sérum).',
    'Sentido del movimiento: siempre de la oreja hacia la clavícula, hacia abajo.',
    'Respiración relajada: lenta y profunda, con los hombros sueltos.',
  ]),
  face('face-forehead', 'Frente lisa y elevación de cejas', 'forehead', 'Apoya las yemas en la frente, justo encima de las cejas, y fija la piel. Eleva las cejas contra esa resistencia y suelta despacio. Evita fruncir el entrecejo y mantén la mandíbula relajada.', [
    'Presión adecuada: solo fijar la piel, sin arrastrarla (con crema o sérum).',
    'Sentido del movimiento: cejas hacia arriba, piel de la frente quieta.',
    'Respiración relajada: exhala al soltar y mantén el rostro sin tensión.',
  ]),
);

// Estiramientos (estilo yoga suave): se registran por tiempo, sin peso ni repeticiones. Cada serie es un lado o una pasada y los segundos se ajustan en el propio entreno.
const stretch = (id: string, name: string, instructions: string, tips: [string, string, string]): Exercise => ({ id, name, muscleGroup: 'Estiramientos', equipment: 'Peso Corporal', imageUrl: '', personalRecords: noRecords(), timed: true, instructions, tips });
BUILTIN_EXERCISES.push(
  stretch('stretch-quads', 'Estiramiento de cuádriceps (de pie)', 'De pie, apóyate en una pared o silla. Dobla una rodilla llevando el talón hacia el glúteo y sujeta el pie con la mano del mismo lado. Rodillas juntas, pelvis hacia delante. Una serie por pierna.', [
    'Rodillas juntas y pelvis ligeramente metida: así el estiramiento llega al cuádriceps y no a la lumbar.',
    'Tira solo hasta notar un estiramiento cómodo en la parte delantera del muslo, sin dolor en la rodilla.',
    'Respira lento y profundo; con cada exhalación suelta un poco más la tensión.',
  ]),
  stretch('stretch-hamstrings', 'Estiramiento de isquios (sentada, piernas estiradas)', 'Sentada en el suelo con las piernas estiradas (o una doblada). Con la espalda larga, inclina el pecho hacia los pies bajando desde la cadera, no desde la espalda. Si no llegas, agarra la pantorrilla o usa una toalla.', [
    'Baja desde la cadera con la espalda larga; no redondees la zona lumbar para llegar más lejos.',
    'Rodillas ligeramente flexibles si tiras de la parte de atrás del muslo; sin rebotes.',
    'Respira despacio: al exhalar, avanza unos milímetros más.',
  ]),
  stretch('stretch-calves', 'Estiramiento de gemelos en la pared', 'Manos en la pared y una pierna atrás con el talón pegado al suelo y la rodilla estirada. Adelanta la cadera hasta notar tensión en la pantorrilla. Para el sóleo, dobla un poco la rodilla de atrás. Una serie por pierna.', [
    'Talón de atrás siempre pegado al suelo y pie apuntando al frente.',
    'Cuerpo en línea recta desde el talón hasta la cabeza, sin arquear la espalda.',
    'Mantén sin rebotar y respira con calma.',
  ]),
  stretch('stretch-figure4', 'Figura 4 tumbada (glúteo)', 'Tumbada boca arriba con las rodillas dobladas. Cruza el tobillo derecho sobre la rodilla izquierda formando un 4 y acerca la pierna izquierda hacia el pecho sujetándola por detrás del muslo. Una serie por lado.', [
    'Cabeza y espalda relajadas en el suelo; los hombros sueltos.',
    'Empuja suavemente la rodilla de arriba hacia fuera con la mano si quieres más intensidad.',
    'Respira profundo; el glúteo se va soltando con cada exhalación.',
  ]),
  stretch('stretch-pigeon', 'Postura de la paloma (glúteo y cadera)', 'Desde cuadrupedia, lleva la rodilla derecha hacia la mano derecha y estira la pierna izquierda hacia atrás. Baja el pecho sobre la pierna delantera apoyando antebrazos o frente. Si molesta la rodilla, usa la versión Figura 4 tumbada. Una serie por lado.', [
    'Cadera lo más nivelada posible; coloca una toalla o cojín bajo el glúteo si queda en el aire.',
    'La rodilla no debe doler: si tira de ella, adelanta el pie o cambia a la figura 4.',
    'Exhala al bajar el pecho y relaja la cara y los hombros.',
  ]),
  stretch('stretch-butterfly', 'Postura de la mariposa (aductores)', 'Sentada con las plantas de los pies juntas y las rodillas abiertas. Sujeta los pies, alarga la espalda y deja caer las rodillas hacia el suelo sin forzar. Puedes inclinarte un poco hacia delante desde la cadera.', [
    'Espalda larga y pecho abierto; no encorves los hombros.',
    'Deja que las rodillas caigan solas por el peso; no las empujes con las manos.',
    'Respira lento, soltando la ingle en cada exhalación.',
  ]),
  stretch('stretch-hipflexor', 'Zancada baja (flexor de la cadera)', 'En media zancada con la rodilla de atrás apoyada en el suelo (sobre una toalla o cojín). Mete la pelvis hacia delante y eleva el brazo del lado de atrás hasta notar el estiramiento en la parte delantera de la cadera. Una serie por lado.', [
    'Mete ligeramente la pelvis (cola hacia dentro): sin arquear la lumbar.',
    'Rodilla de delante sobre el tobillo, sin pasar la punta del pie.',
    'Respira profundo y mantén el tronco erguido.',
  ]),
  stretch('stretch-chest-door', 'Estiramiento de pecho en el marco de la puerta', 'De pie en el marco de una puerta, antebrazo apoyado en el marco con el codo a la altura del hombro. Da un pequeño paso adelante hasta notar el pecho abrirse. Una serie por lado.', [
    'Hombro bajo y alejado de la oreja; no lo encojas.',
    'Paso pequeño y progresivo: el estiramiento es suave, nunca doloroso.',
    'Respira hacia el pecho y suelta el aire despacio.',
  ]),
  stretch('stretch-shoulder', 'Estiramiento de hombro (brazo cruzado)', 'De pie o sentada, cruza un brazo por delante del pecho y sujétalo con la otra mano por encima o por debajo del codo, sin tirar de la articulación. Una serie por lado.', [
    'Hombro relajado y bajo: no lo subas hacia la oreja.',
    'Tira del brazo por encima del codo, nunca de la muñeca o la articulación.',
    'Respira tranquila y mantén la mirada al frente.',
  ]),
  stretch('stretch-triceps', 'Estiramiento de tríceps (tras la nuca)', 'Eleva un brazo, dobla el codo y deja la mano detrás de la nuca. Con la otra mano, empuja suavemente el codo hacia atrás y hacia abajo. Una serie por brazo.', [
    'Cuello neutro: no empujes la cabeza hacia delante.',
    'Costillas recogidas, sin arquear la lumbar.',
    'Presión suave sobre el codo; respira sin aguantar el aire.',
  ]),
  stretch('stretch-biceps', 'Estiramiento de bíceps (brazos atrás)', 'De pie, entrelaza las manos detrás de la espalda con los brazos estirados y eleva suavemente las manos mientras abres el pecho. Alternativa: palma apoyada en una pared con el brazo estirado y giro del cuerpo hacia el lado contrario.', [
    'Pecho abierto y hombros hacia atrás, sin encogerlos.',
    'Sube las manos solo hasta notar tensión cómoda delante del brazo.',
    'Respira profundo y relaja la mandíbula.',
  ]),
  stretch('stretch-child', 'Postura del niño (espalda y dorsales)', 'De rodillas, siéntate sobre los talones y baja el pecho hacia el suelo estirando los brazos por delante con las palmas apoyadas. Deja caer la frente. Para trabajar un lado, camina con las manos hacia un lado.', [
    'Caderas hacia atrás, hacia los talones, y brazos largos.',
    'Frente apoyada y cuello relajado; deja pesar el cuerpo.',
    'Respira hacia la espalda: las costillas se expanden en cada inhalación.',
  ]),
  stretch('stretch-catcow', 'Gato-vaca (columna)', 'En cuadrupedia (manos bajo los hombros y rodillas bajo las caderas). Al inhalar, hunde suavemente la espalda y abre el pecho (vaca); al exhalar, redondea la espalda metiendo la barbilla (gato). Movimiento lento, de ida y vuelta durante toda la serie.', [
    'Mueve toda la columna despacio, vértebra a vértebra.',
    'Manos firmes en el suelo y brazos estirados sin bloquear los codos.',
    'Sincroniza: inhala al abrir, exhala al redondear.',
  ]),
  stretch('stretch-cobra', 'Postura de la cobra (abdominales)', 'Tumbada boca abajo con las manos bajo los hombros. Empuja suavemente con las manos y eleva el pecho manteniendo el pubis y las piernas en el suelo. Hombros lejos de las orejas. Sube solo hasta donde la lumbar esté cómoda.', [
    'Hombros bajos y alejados de las orejas; cuello largo.',
    'La lumbar no debe doler: sube menos si notas pinchazo y apoya los antebrazos.',
    'Respira profundo y abre el pecho en cada inhalación.',
  ]),
  stretch('stretch-twist', 'Giro de columna tumbada (lumbar)', 'Tumbada boca arriba, abraza las rodillas contra el pecho y déjalas caer hacia un lado mientras los brazos se abren en cruz y la mirada va al lado contrario. Hombros pegados al suelo. Una serie por lado.', [
    'Los dos hombros pegados al suelo; si se levanta uno, apoya las rodillas en un cojín.',
    'Giro suave y sin forzar: la gravedad hace el trabajo.',
    'Respira lento y relaja la espalda baja.',
  ]),
  stretch('stretch-side', 'Estiramiento lateral de tronco (oblicuos)', 'De pie o sentada con la espalda larga, eleva un brazo por encima de la cabeza y, sin girar el torso, inclina el cuerpo hacia el lado contrario formando una curva larga. Una serie por lado.', [
    'Mantén los dos glúteos apoyados (o los pies firmes) y la pelvis estable.',
    'Inclina de lado, sin girar el pecho al suelo ni al techo.',
    'Respira hacia el costado que se estira.',
  ]),
  stretch('stretch-neck', 'Estiramiento de cuello (inclinación lateral)', 'Sentada o de pie con la espalda larga, inclina la oreja hacia el hombro del mismo lado. Si quieres algo más, apoya la mano del mismo lado con muy poco peso y baja el hombro contrario. Sin tirones. Una serie por lado.', [
    'Hombro contrario bajo y relajado; no lo subas hacia la oreja.',
    'Peso de la mano mínimo: solo el de la propia mano, sin tirar.',
    'Respira lento y relaja la mandíbula.',
  ]),
);

BUILTIN_EXERCISES.push({
  id: 'single-leg-press',
  name: 'Prensa unilateral a una pierna (single-leg press)',
  muscleGroup: 'Cuádriceps',
  equipment: 'Máquina',
  imageUrl: builtinImageUrl('single-leg-press'),
  personalRecords: noRecords(),
  unilateral: true,
  instructions: 'Un solo pie en la plataforma, rodilla alineada con la punta del pie y pelvis pegada al respaldo. Baja controlado hasta unos 90° y empuja sin llegar a bloquear la rodilla al final (sin hiperextender). Pie bajo y centrado = más cuádriceps; pie alto y adelantado = más glúteo e isquios. Registra cada pierna por separado.',
  tips: [
    'Corrige asimetrías: trabajar cada pierna por separado evita que la fuerte compense a la débil.',
    'Más control neuromuscular y menos compresión en la rodilla: con cargas relativas más bajas basta para trabajar.',
    'Final del movimiento: extiende sin bloquear la rodilla y sin que la pelvis se despegue del respaldo.',
  ],
});

// Alternativas de Hip Thrust para entrenar sola (se usan desde «Si entreno sola» en la tarjeta del Hip Thrust).
const ht = (id: string, name: string, equipment: Equipment, instructions: string, extra: Partial<Exercise> = {}): Exercise => ({ id, name, muscleGroup: 'Glúteos', equipment, imageUrl: '', personalRecords: noRecords(), instructions, ...extra });
BUILTIN_EXERCISES.push(
  ht('hip-thrust-machine', 'Hip Thrust en Máquina (plate-loaded / selectorizada)', 'Máquina', 'Ajusta el cinturón o la palanca a la altura de la cadera, espalda alta apoyada y pies firmes. Empuja con los talones hasta alinear rodillas, cadera y hombros y aprieta el glúteo arriba.'),
  ht('hip-thrust-smith', 'Hip Thrust en Multipower (Smith)', 'Máquina', 'Espalda alta en el banco, barra guiada sobre la cadera con almohadilla. Empuja con los talones, aprieta arriba 1 s y usa el tope giratorio de seguridad al terminar.'),
  ht('hip-thrust-single', 'Hip Thrust Unilateral (1 pierna)', 'Mancuernas', 'Espalda alta en el banco y una mancuerna sobre la cadera. Empuja con un solo pie manteniendo la pelvis nivelada; registra cada pierna por separado.', { unilateral: true }),
);

// Variantes del Hip Thrust sin foto propia libre: se muestra la del Hip Thrust con barra (mismo patrón: espalda alta en el banco y extensión completa de cadera) con la nota de referencia.
for (const e of BUILTIN_EXERCISES) if (e.id.startsWith('hip-thrust-')) { e.imageUrl = photoUrl('Barbell_Hip_Thrust'); e.imageNote = 'Referencia: Hip Thrust con barra (mismo patrón de movimiento)'; }

// Complementos para completar la sesión cuando la rutina queda corta (seguros para rodillas, sin impacto ni compresión cervical).
BUILTIN_EXERCISES.push(
  { id: 'cable-glute-kickback', name: 'Patada de Glúteo en Polea', muscleGroup: 'Glúteos', equipment: 'Polea', imageUrl: builtinImageUrl('cable-glute-kickback'), personalRecords: noRecords(), unilateral: true, instructions: 'Tobillera en la polea baja, apóyate en la máquina y lleva la pierna hacia atrás con la rodilla casi estirada, apretando el glúteo. Sin balancear la cadera ni arquear la lumbar.' },
  { id: 'cable-lateral-raise', name: 'Elevación Lateral en Polea', muscleGroup: 'Hombros', equipment: 'Polea', imageUrl: builtinImageUrl('cable-lateral-raise'), personalRecords: noRecords(), instructions: 'De lado a la polea baja, sube el brazo hasta la altura del hombro con el codo ligeramente flexionado. Tensión constante y bajada lenta, sin encoger el hombro.' },
  { id: 'deadbug', name: 'Deadbug (bicho muerto)', muscleGroup: 'Abdominales', equipment: 'Peso Corporal', imageUrl: builtinImageUrl('deadbug'), personalRecords: noRecords(), instructions: 'Tumbada boca arriba, lumbar pegada al suelo, brazos al techo y rodillas a 90°. Baja brazo y pierna contrarios despacio sin despegar la lumbar y alterna. Activa el transverso del abdomen.' },
  { id: 'pallof-press', name: 'Press Pallof en Polea', muscleGroup: 'Abdominales', equipment: 'Polea', imageUrl: builtinImageUrl('pallof-press'), personalRecords: noRecords(), instructions: 'De lado a la polea a la altura del pecho, agarra el asa con las dos manos y estira los brazos al frente sin dejar que la polea te gire. Anti-rotación: estiliza y compacta la cintura.' },
);

const idOf = (name: string): string => BUILTIN_EXERCISES.find((e) => e.name === name)?.id ?? '';

type Item = { n: string; sets: number; reps: string; rest?: number; uni?: boolean };

/** Rutina de la semana: las series de los ejercicios a una pierna/brazo se guardan en parejas D/I. */
const W = (id: string, title: string, list: Item[]): RoutineTemplate => ({
  id,
  title,
  folder: 'Mi semana',
  exercises: list.map((it) => {
    const sets: RoutineTemplate['exercises'][number]['sets'] = [];
    for (let i = 0; i < it.sets; i++) {
      if (it.uni) {
        sets.push({ type: 'normal', weight: 0, reps: 0, side: 'I' });
        sets.push({ type: 'normal', weight: 0, reps: 0, side: 'D' });
      } else sets.push({ type: 'normal', weight: 0, reps: 0 });
    }
    return { exerciseId: idOf(it.n), sets, unilateral: it.uni || undefined, restSec: it.rest, notes: `${it.sets} series${it.reps ? ` · ${it.reps} reps` : ''}${it.uni ? ' (cada lado)' : ''}` };
  }),
});

/** Rutina de rostro y cuello (6-8 min): las repeticiones de cada serie son los segundos. */
export const GLOW_TEMPLATE: RoutineTemplate = {
  id: 'tpl-glow',
  title: 'Glow & Jawline Sculpt',
  folder: 'Rostro y cuello',
  notes: '6-8 min. Con la piel limpia y crema o sérum para que los dedos deslicen.',
  exercises: [
    ['Definición de mandíbula (jawline sculpt)', 3, 30, '3 series × 30 s o 20 repeticiones continuas'],
    ['Platisma: cuello y papada (isométrico)', 3, 20, '3 series × 20 s de tensión isométrica controlada'],
    ['Elevación de pómulos (cheek lifter)', 3, 30, '3 series × 30 s'],
    ['Drenaje linfático y clavículas', 2, 40, '2 series × 40 s lentos y suaves'],
  ].map(([n, sets, sec, notes]) => ({
    exerciseId: idOf(n as string),
    restSec: 15,
    notes: notes as string,
    sets: Array.from({ length: sets as number }, () => ({ type: 'normal' as const, weight: 0, reps: sec as number })),
  })),
};

export const DEFAULT_TEMPLATES: RoutineTemplate[] = [
  W('tpl-lunes', 'Lunes', [
    { n: 'Press de Piernas Sentado', sets: 3, reps: '10-12', rest: 60 },
    { n: 'Sentadilla al Cajón (Barra)', sets: 3, reps: '12', rest: 60 },
    { n: 'Sentadilla Búlgara (Mancuerna)', sets: 3, reps: '6-8', rest: 60, uni: true },
    { n: 'Empuje de Caderas (Barra)', sets: 3, reps: '8-10', rest: 80 },
    { n: 'Aducción de Cadera (Máquina)', sets: 3, reps: '10-12', rest: 60 },
    { n: 'Hiperextensión Inversa', sets: 3, reps: '8', rest: 50 },
  ]),
  W('tpl-martes', 'Martes', [
    { n: 'Jalón al Pecho (Cable)', sets: 3, reps: '8-10', rest: 50 },
    { n: 'Remo Sentado con Agarre en V (Cable)', sets: 3, reps: '10', rest: 50 },
    { n: 'Remo con Mancuerna', sets: 3, reps: '8-10', rest: 50, uni: true },
    { n: 'Extensión de Espalda (Hiperextensión con peso)', sets: 3, reps: '8-10', rest: 50 },
    { n: 'Curl de Bíceps (Mancuerna)', sets: 3, reps: '8', rest: 50 },
  ]),
  W('tpl-miercoles', 'Miércoles', [
    { n: 'Flexiones', sets: 1, reps: '10' },
    { n: 'Press Plano Máquina', sets: 4, reps: '8-10' },
    { n: 'Press de Pecho Inclinado (Máquina)', sets: 4, reps: '8-10' },
    { n: 'Press de Hombros Sentado (Máquina)', sets: 4, reps: '8' },
    { n: 'Jalón de tríceps con cuerda', sets: 3, reps: '10' },
    { n: 'Elevación Lateral (Mancuerna)', sets: 3, reps: '10-12' },
    { n: 'Cinta', sets: 1, reps: '' },
  ]),
  W('tpl-jueves', 'Jueves', [
    { n: 'Press de Piernas Sentado', sets: 3, reps: '8-10', rest: 60 },
    { n: 'Sentadilla Sumo (Mancuerna)', sets: 3, reps: '8-12', rest: 60 },
    { n: 'Subida al Cajón (Mancuerna)', sets: 3, reps: '8-12', rest: 30, uni: true },
    { n: 'Peso Muerto (Barra)', sets: 3, reps: '10-12', rest: 60 },
    { n: 'Abducción de Cadera (Máquina)', sets: 3, reps: '10-12', rest: 50 },
    { n: 'Elevación de Gemelos de Pie (Mancuerna)', sets: 3, reps: '10-12', rest: 30 },
  ]),
  GLOW_TEMPLATE,
];

/** Ids de las rutinas de ejemplo antiguas (Push/Pull/Legs/Upper/Lower), sustituidas por las de la semana. */
export const OLD_DEFAULT_IDS = ['tpl-push', 'tpl-pull', 'tpl-legs', 'tpl-upper', 'tpl-lower'];

/** Estimación del grupo muscular a partir del nombre (para importaciones). */
export const guessMuscle = (name: string): MuscleGroup => {
  const n = name.toLowerCase();
  const rules: [RegExp, MuscleGroup][] = [
    [/bench|press de banca|chest|fly|flye|pec|push.?up|flexion|apertura/, 'Pecho'],
    [/calf|gemelo/, 'Gemelos'],
    [/hip thrust|glute|gl[uú]teo|abduc/, 'Glúteos'],
    [/hamstring|femoral|rdl|rumano|leg curl/, 'Isquios'],
    [/squat|sentadilla|leg press|prensa|leg ext|extensi[oó]n de cu|lunge|zancada/, 'Cuádriceps'],
    [/row|pull|lat |remo|jal[oó]n|dominada|deadlift|peso muerto|back/, 'Espalda'],
    [/shoulder|overhead|militar|lateral raise|elevaci|delt|face pull|shrug/, 'Hombros'],
    [/tricep|tr[ií]ceps|pushdown|skull|dip|fondos|franc[eé]s/, 'Tríceps'],
    [/bicep|curl/, 'Bíceps'],
  ];
  return rules.find(([r]) => r.test(n))?.[1] ?? 'Abdominales';
};

export const guessEquipment = (name: string): Equipment => {
  const n = name.toLowerCase();
  if (/kettlebell/.test(n)) return 'Kettlebell';
  if (/band|banda/.test(n)) return 'Banda';
  if (/dumbbell|mancuerna/.test(n)) return 'Mancuernas';
  if (/barbell|barra|\(bar\)/.test(n)) return 'Barra';
  if (/cable|polea|pulldown|pushdown/.test(n)) return 'Polea';
  if (/machine|m[aá]quina|smith|leg press|pec deck/.test(n)) return 'Máquina';
  return 'Peso Corporal';
};

/** 1RM estimado (Epley). */
export const epley = (w: number, r: number): number => (r <= 0 || w <= 0 ? 0 : r === 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10);

/** Cardio (cinta, elíptica, bici): se registra con tiempo y distancia en vez de kg y repeticiones. */
export const isCardio = (e?: { id: string; name: string }): boolean => !!e && (e.id === 'Walking_Treadmill' || /\b(cinta|el[ií]ptica|bicicleta|bici est[aá]tica|remo erg)/i.test(e.name));
