import type { Exercise, MuscleGroup } from './types';

type Tips = [string, string, string];

/** Técnica y precauciones (3 puntos) de los ejercicios de tus rutinas. */
const TIPS: Record<string, Tips> = {
  Leg_Press: ['Pies a la altura de la cadera, rodillas alineadas con la punta del pie', 'No bloquees la articulación de la rodilla en el punto más alto', 'Controla la bajada lenta (3 s) y no despegues la pelvis del respaldo'],
  'single-leg-press': ['Pies a la altura de la cadera y rodilla alineada con la punta del pie', 'No bloquees la articulación de la rodilla en el punto más alto', 'Controla la bajada lenta y mantén la pelvis pegada al respaldo'],
  'hip-thrust-machine': ['Cinturón o palanca ajustados a la cadera, espalda alta apoyada', 'Empuja con los talones hasta alinear rodillas, cadera y hombros', 'Aprieta el glúteo arriba 1 s sin hiperextender la lumbar'],
  'hip-thrust-smith': ['Barra guiada con almohadilla sobre la cadera y pies a la anchura de la cadera', 'Sube aprieta el glúteo 1 s y baja controlado', 'Usa el tope giratorio de seguridad al terminar'],
  'hip-thrust-single': ['Pelvis nivelada: sin dejar caer la cadera del lado libre', 'Empuja con el talón del pie de apoyo y aprieta arriba 1 s', 'Carga ligera, rango completo y cada pierna por separado'],
  'cable-glute-kickback': ['Apóyate en la máquina y mantén la pelvis nivelada', 'Lleva la pierna atrás apretando el glúteo, rodilla casi estirada', 'Sin arquear la lumbar ni balancear; cada pierna por separado'],
  'cable-lateral-raise': ['Codo ligeramente flexionado y hombro bajo', 'Sube hasta la altura del hombro, sin impulso', 'Baja lento manteniendo la tensión de la polea'],
  deadbug: ['Lumbar pegada al suelo todo el rato', 'Baja brazo y pierna contrarios despacio', 'Exhala al estirar y activa el abdomen profundo'],
  'pallof-press': ['Pies firmes y caderas de frente, sin girar', 'Estira los brazos al frente y aguanta 2 s', 'Vuelve con control: la polea no debe sacarte de tu eje'],
  Box_Squat: ['Siéntate atrás hasta rozar el cajón, sin dejarte caer', 'Rodillas hacia fuera, en línea con los pies', 'Espalda neutra y empuja el suelo para subir; sin rebotar en el cajón'],
  Split_Squat_with_Dumbbells: ['Torso erguido y el peso en el talón de la pierna delantera', 'La rodilla delantera sigue la línea del pie, sin colapsar hacia dentro', 'Baja controlado; no apoyes la rodilla trasera con fuerza en el suelo'],
  Barbell_Hip_Thrust: ['Barbilla ligeramente hacia el pecho y costillas abajo', 'Sube empujando con los talones hasta alinear rodillas, cadera y hombros', 'Aprieta el glúteo arriba 1 s sin hiperextender la zona lumbar'],
  Thigh_Adductor: ['Espalda pegada al respaldo y rodillas alineadas con los pies', 'Cierra las piernas despacio, sin tirones', 'Vuelve controlando el recorrido; no rebotes en el tope'],
  Thigh_Abductor: ['Espalda pegada al respaldo y pies firmes en los apoyos', 'Abre las piernas con el glúteo, sin balancear el torso', 'Vuelve despacio sin dejar caer el peso'],
  Reverse_Hyperextension: ['Agárrate fuerte y mantén el torso quieto', 'Sube las piernas con el glúteo hasta la línea del cuerpo, sin pasarte', 'Baja lento; sin balanceo ni hiperextender la lumbar'],
  'Wide-Grip_Lat_Pulldown': ['Pecho alto y escápulas abajo y atrás antes de tirar', 'Lleva la barra a la clavícula llevando los codos hacia las costillas', 'Sube controlando; sin balancear el torso ni encoger los hombros'],
  Seated_Cable_Rows: ['Espalda larga y pecho abierto desde el inicio', 'Tira hacia el ombligo juntando las escápulas', 'Vuelve lento sin redondear la espalda'],
  'One-Arm_Dumbbell_Row': ['Espalda neutra y cadera estable, apoyo firme en banco o rodilla acolchada', 'Tira del codo hacia la cadera, sin rotar el torso', 'Baja controlado hasta estirar el dorsal'],
  Hyperextensions_Back_Extensions: ['Cadera apoyada y pies firmes', 'Sube hasta alinear el cuerpo, sin pasarte de la línea', 'Baja lento con la espalda neutra; no rebotes'],
  Dumbbell_Bicep_Curl: ['Codos pegados al cuerpo y hombros quietos', 'Sube sin balancear el torso ni coger impulso', 'Baja en 3 s hasta casi extender el brazo'],
  Pushups: ['Cuerpo en línea recta, core y glúteo activos', 'Codos a unos 45° del torso, no abiertos en cruz', 'Baja con control hasta rozar el pecho; sin hundir la lumbar'],
  Machine_Bench_Press: ['Ajusta el asiento para que las asas queden a la altura del pecho', 'Escápulas atrás y abajo, pegadas al respaldo', 'Empuja sin bloquear los codos y baja lento'],
  Leverage_Incline_Chest_Press: ['Asas a la altura de la parte alta del pecho y espalda pegada', 'Empuja hacia arriba y delante sin encoger los hombros', 'Baja controlado sin perder la tensión'],
  Machine_Shoulder_Military_Press: ['Espalda pegada y core firme, sin arquear la lumbar', 'Empuja hacia arriba sin bloquear los codos', 'Baja hasta la altura de las orejas, lento'],
  'Triceps_Pushdown_-_Rope_Attachment': ['Codos pegados al costado y quietos', 'Extiende y separa la cuerda al final del recorrido', 'Sube controlado sin mover los hombros'],
  Side_Lateral_Raise: ['Ligera flexión de codos y hombros bajos', 'Sube hasta la altura de los hombros, sin balanceo', 'Baja lento; mejor menos peso y más control'],
  Plie_Dumbbell_Squat: ['Pies abiertos y puntas hacia fuera, rodillas siguiendo los pies', 'Torso erguido y mancuerna entre las piernas', 'Baja hasta donde mantengas la espalda neutra; sube empujando el suelo'],
  Dumbbell_Step_Ups: ['Apoya todo el pie en el cajón e impulsa con la pierna de arriba', 'Rodilla alineada con el pie, sin colapsar hacia dentro', 'Baja controlado, sin dejarte caer'],
  Barbell_Deadlift: ['Barra pegada a las piernas y espalda neutra', 'Empuja el suelo y extiende cadera y rodillas a la vez', 'Baja llevando la cadera atrás; sin redondear la espalda'],
  Standing_Dumbbell_Calf_Raise: ['Apóyate para equilibrarte y sube sobre la punta del pie', 'Pausa arriba 1 s y baja estirando el gemelo', 'Rango completo y sin rebotes'],
  Walking_Treadmill: ['Postura erguida y mirada al frente', 'Paso natural, sin agarrarte a las barras', 'Ritmo cómodo en el que puedas hablar'],
};

const GENERIC: Record<MuscleGroup, Tips> = {
  Pecho: ['Escápulas atrás y abajo, pecho abierto', 'Codos a unos 45° del torso', 'Controla la bajada y no bloquees los codos'],
  Espalda: ['Empieza el movimiento con las escápulas, no con los brazos', 'Espalda neutra, sin balancear el torso', 'Controla la fase de vuelta'],
  Hombros: ['Hombros bajos, sin encogerlos hacia las orejas', 'Core firme y sin arquear la lumbar', 'Recorrido controlado, sin impulso'],
  Bíceps: ['Codos pegados al cuerpo', 'Sin balancear el torso', 'Baja lento hasta casi extender el brazo'],
  Tríceps: ['Codos quietos y apuntando al frente', 'Extiende por completo sin bloquear de golpe', 'Controla la vuelta'],
  Cuádriceps: ['Rodillas alineadas con la punta de los pies', 'No bloquees la rodilla en el punto más alto', 'Controla la bajada lenta'],
  Isquios: ['Cadera atrás y espalda neutra', 'Rodillas casi estiradas sin bloquearlas', 'Sube apretando el glúteo; baja lento'],
  Glúteos: ['Pelvis neutra, sin arquear la lumbar', 'Empuja con el talón y aprieta arriba 1 s', 'Controla la bajada'],
  Gemelos: ['Rango completo: estira abajo y sube a la punta', 'Pausa arriba 1 s', 'Sin rebotes'],
  Abdominales: ['Costillas abajo y lumbar estable', 'Exhala al hacer fuerza', 'Calidad antes que repeticiones'],
  Estiramientos: ['Estira hasta notar tensión suave, nunca dolor', 'Sin rebotes: mantén la postura quieta', 'Respira lento y profundo, soltando en cada exhalación'],
  'Rostro y Cuello': ['Presión suave, sin tirar de la piel', 'Movimiento lento y controlado', 'Respiración relajada'],
};

/** 3 viñetas de técnica y precauciones de un ejercicio (las suyas si las tiene; si no, las de la rutina o genéricas). */
export const techniqueTips = (ex: Exercise): Tips => (ex.tips && ex.tips.length >= 3 ? [ex.tips[0], ex.tips[1], ex.tips[2]] : TIPS[ex.id] ?? GENERIC[ex.muscleGroup]);
