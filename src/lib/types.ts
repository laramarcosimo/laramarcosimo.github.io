export type Sex = 'M' | 'F';
export type Goal = 'recomp' | 'deficit' | 'maintain' | 'surplus';
export interface Profile {
  age: number;
  sex: Sex;
  height: number;
  weight: number;
  goal: Goal;
  /** Factor de actividad base (sin contar entrenos, que se suman aparte). */
  activity: number;
}

export interface Settings {
  geminiKey: string;
  geminiModel: string;
  restDefault: number;
  /** Descanso según el ejercicio (compuestos más largo, aislamiento más corto). */
  restAuto?: boolean;
  /** Textos explicativos: «short» (primera línea, por defecto) o «detailed» (completos). */
  textMode?: 'short' | 'detailed';
  /** Modo simple: sin textos explicativos (solo un icono ⓘ). */
  hideHints?: boolean;
  /** Modo simple: los botones con icono y texto muestran solo el icono. */
  iconOnly?: boolean;
  /** Recordatorio semanal de medidas: día (0 domingo … 6 sábado) y hora. */
  measureDay?: number;
  /** Meta diaria de pasos que fija el usuario (sin definir = sin meta). */
  stepGoal?: number;
  /** Gramos de aceite que suelta un «chuf» de tu dispensador (se calibra pesando varios). Por defecto 0,5. */
  oilPuffG?: number;
  /** Analizar cada foto de comida dos veces y avisar si no coinciden (gasta el doble de cupo de la IA). */
  doubleRead?: boolean;
  /** Mínimo de piezas de fruta al día (por defecto 1). */
  fruitMin?: number;
  /** Aviso semanal para pesarte y medirte en ayunas (por defecto activado; false = desactivado). */
  measureRemind?: boolean;
  /** Hora (0-23) a partir de la cual avisa del post-entreno si has entrenado hoy. Por defecto 21. */
  postHour?: number;
  /** Aviso diario de la rutina facial nocturna (si hoy aún no la has hecho) y su hora «HH:MM» (por defecto 22:30). */
  faceRemind?: boolean;
  faceTime?: string;
  /** Recordatorio mensual de la foto de progreso: activado, día del mes (1-28) y hora «HH:MM». */
  photoRemind?: boolean;
  photoDay?: number;
  photoTime?: string;
  /** Segundos de margen antes de enviar una consulta a la IA para poder cancelarla sin gastar nada (0 = enviar al instante). Por defecto 2. */
  aiGraceSec?: number;
  /** Modo vacaciones: en Hoy sale un circuito de mantenimiento de 10-15 min en vez de tu rutina; y los minutos elegidos hoy. */
  vacation?: boolean;
  vacationMin?: number;
  /** Periodos de vacaciones (inicio y fin): las semanas que los tocan no cuentan para la racha semanal. */
  vacationLog?: { from: number; to?: number }[];
  /** Desplazamiento del circuito de vacaciones (botón «Otro circuito»). */
  vacationShift?: number;
  /** Cuándo se hizo la última foto de progreso (para no avisar si ya la hiciste este mes). */
  lastPhotoTs?: number;
  /** Rangos de kcal por tipo de día (mínimo y máximo). Por defecto: entreno 1.600-1.800, descanso 1.700-1.800. */
  kcalTrain?: { min: number; max: number };
  kcalRest?: { min: number; max: number };
  /** Rango de proteína diaria en g: mínimo obligatorio, máximo techo opcional. */
  proteinRange?: { min: number; max: number };
  /** Objetivo diario de grasa y de carbohidratos (g); sin definir, los de la pauta por defecto. */
  fatTarget?: number;
  carbsTarget?: number;
  /** Baremos en gramos (mínimo y máximo): grasas, carbohidratos en días de entreno y en días sin entreno. */
  fatRange?: { min: number; max: number };
  carbsRange?: { min: number; max: number };
  carbsRestRange?: { min: number; max: number };
  /** Días de la semana de entreno (0 = domingo … 6 = sábado). Sin definir: se deduce de los entrenos registrados. */
  trainDays?: number[];
  /** Días (0 domingo … 6 sábado) en que la merienda es fuera de casa (p. ej. en la universidad). Por defecto lunes a miércoles. */
  meriendaFuera?: number[];
  measureHour?: number;
  /** Semana de descarga activa hasta esta fecha (ms). */
  deloadUntil?: number;
  restSound: boolean;
  restVibrate: boolean;
  /** Objetivo semanal de días entrenados (para la racha semanal). */
  weeklyGoal: number;
  /** Tamaño de letra de toda la app. */
  fontScale: 'normal' | 'large' | 'xlarge';
  /** Protección articular de rodilla: sin saltos ni apoyo directo de rodilla; prioriza cuádriceps sin impacto. */
  kneeSafe: boolean;
  /** Posición de la barra de navegación (también en `navbar_position`). */
  navbarPosition: 'bottom' | 'top';
}

export type MuscleGroup = 'Pecho' | 'Espalda' | 'Hombros' | 'Bíceps' | 'Tríceps' | 'Cuádriceps' | 'Isquios' | 'Glúteos' | 'Gemelos' | 'Abdominales' | 'Rostro y Cuello' | 'Estiramientos';
export type Equipment = 'Barra' | 'Mancuernas' | 'Máquina' | 'Polea' | 'Peso Corporal' | 'Kettlebell' | 'Banda';
export type Location = 'gym' | 'home';
export type HomeGear =
  | 'bodyweight'
  | 'pullup'
  | 'bands'
  | 'dumbbells'
  | 'kettlebell'
  | 'bench'
  | 'inclinebench'
  | 'barbell'
  | 'rack'
  | 'dipbars'
  | 'straps'
  | 'abwheel'
  | 'box'
  | 'backpack'
  | 'furniture';

export type BandLevel = 'ligera' | 'media' | 'fuerte';

/** Detalles del material de casa para ajustar cargas y repeticiones. */
export interface HomeSpecs {
  /** Máximo por mano (kg). */
  dumbbellKg: number;
  kettlebellKg: number;
  bandLevel: BandLevel;
  backpackKg: number;
}
export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure';

export interface PersonalRecords {
  maxWeight: number;
  maxVolume: number;
  best1RM: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  /** Ilustración (URL pública o data URL si el usuario sube la suya). */
  imageUrl: string;
  personalRecords: PersonalRecords;
  custom?: boolean;
  /** Se registra por tiempo (segundos) o repeticiones lentas, sin peso. */
  timed?: boolean;
  /** Escalón real de la máquina (kg entre un peso y el siguiente, incl. micro-placas). Lo fija el usuario. */
  stackStep?: number;
  /** Si la imagen es de un ejercicio equivalente (no exactamente este), qué se muestra: «Referencia: …». */
  imageNote?: string;
  /** Instrucciones biomecánicas breves. */
  instructions?: string;
  /** Se hace de una pierna/brazo cada vez: al añadirlo sus series salen en parejas D/I. */
  unilateral?: boolean;
  /** Puntos clave de técnica (presión, sentido del movimiento, respiración). */
  tips?: string[];
}

export interface Set {
  id: string;
  type: SetType;
  weight: number;
  reps: number;
  rpe?: number;
  completed: boolean;
  /** Referencia de la última sesión, p. ej. "80 kg x 8". */
  previous?: string;
  pr?: boolean;
  /** Ejercicios a una pierna/brazo: D = derecha, I = izquierda. */
  side?: 'D' | 'I';
  /** Cardio (cinta, elíptica, bici): minutos, kilómetros y kcal reales de la serie. */
  min?: number;
  km?: number;
  kcal?: number;
  /** Segundos de mantenimiento (isométrico) y repeticiones cortas (parciales). */
  secs?: number;
  partials?: number;
}

export interface WorkoutExercise {
  id: string;
  /** Pospuesto por el optimizador de tiempo («Opcional / Omitido»); se puede recuperar. */
  skipped?: boolean;
  /** Ejercicio extra del día: se guarda en el historial pero no altera la rutina. */
  extra?: boolean;
  exerciseId: string;
  notes?: string;
  sets: Set[];
  /** Una pierna/brazo cada vez: las series van en parejas D/I y el descanso llega tras la pareja. */
  unilateral?: boolean;
  /** Superserie: ejercicios con el mismo id se alternan y el descanso va al final de la ronda. */
  superset?: string;
  /** Descanso fijo de este ejercicio (si no, automático). */
  restSec?: number;
  /** Rango objetivo de repeticiones. */
  repMin?: number;
  repMax?: number;
  /** Registrar también segundos y reps cortas (por defecto, en el Hip Thrust). */
  extras?: boolean;
  /** Abdominales: la serie se mide en segundos (plancha…) en vez de repeticiones. */
  byTime?: boolean;
  /** Mancuernas: el kg escrito es el de CADA mancuerna (el total es el doble) o el peso total combinado. */
  perHand?: boolean;
}

export interface ActiveWorkout {
  id: string;
  /** Tiempo disponible elegido (por defecto, estándar 60-70 min). */
  timeMode?: 'q45' | 'm50' | 'std' | 'x75' | 'free';
  /** Descansos óptimos (compuestos 2,5 min, accesorios 90 s) en lugar de los de la rutina. */
  restPlan?: 'optimal';
  /** Rutina de la que parte (para recordar los extras de la última vez). */
  templateId?: string;
  /** Sesión realizada con el periodo / regla (para comparar cargas con sesiones equivalentes). */
  isPeriodSession?: boolean;
  location: Location;
  title: string;
  notes?: string;
  startedAt: number;
  exercises: WorkoutExercise[];
}

export interface TemplateSet {
  secs?: number;
  partials?: number;
  min?: number;
  km?: number;
  side?: 'D' | 'I';
  type: SetType;
  weight: number;
  reps: number;
}

export interface RoutineTemplate {
  id: string;
  title: string;
  folder?: string;
  notes?: string;
  exercises: { exerciseId: string; sets: TemplateSet[]; unilateral?: boolean; superset?: string; restSec?: number; notes?: string; repMin?: number; repMax?: number; extras?: boolean; byTime?: boolean; perHand?: boolean }[];
}

export interface LogSet {
  secs?: number;
  partials?: number;
  min?: number;
  km?: number;
  kcal?: number;
  side?: 'D' | 'I';
  type: SetType;
  weight: number;
  reps: number;
  rpe?: number;
}

export interface LogExercise {
  extra?: boolean;
  exerciseId: string;
  name: string;
  muscleGroup: MuscleGroup;
  notes?: string;
  /** El kg de las series es el de cada mancuerna: el volumen real es el doble. */
  perHand?: boolean;
  sets: LogSet[];
}

export interface WorkoutLog {
  id: string;
  templateId?: string;
  /** Ejercicios de la rutina que se pospusieron y no se hicieron. */
  skipped?: string[];
  isPeriodSession?: boolean;
  /** Marcada con el periodo automáticamente (estaba entre dos sesiones con periodo). */
  periodAuto?: boolean;
  /** Dónde se entrenó; los entrenos en casa no modifican los PRs de gimnasio. Ausente = gym. */
  location?: Location;
  title: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  totalVolumeKg: number;
  totalSets: number;
  prsAchieved: number;
  caloriesBurned: number;
  exercises: LogExercise[];
  source: 'app' | 'csv' | 'ocr';
}

export interface Meal {
  id: string;
  /** Toma del día; si falta se deduce de la hora. */
  slot?: Slot;
  ts: number;
  plato: string;
  calorias: number;
  proteinas: number;
  carbs: number;
  grasas: number;
  /** Comida fuera de casa (restaurante, universidad…). */
  out?: boolean;
  /** Ingredientes con su cantidad, si se conocen (para poder editarlos después). */
  detalle?: string[];
}

export interface PantryItem {
  id: string;
  name: string;
  qty: number;
  /** Supermercado / marca estimada. */
  store?: string;
  /** Fecha de caducidad (AAAA-MM-DD), opcional. */
  expires?: string;
  /** La fecha es una estimación (no la del envase). */
  expiresApprox?: boolean;
  /** Dónde se guarda: nevera, despensa seca o congelador (si no se indica, se deduce del nombre). */
  place?: 'nevera' | 'despensa' | 'congelador';
  /** Categoría elegida a mano (si no, se deduce del nombre): lácteos, carne, fruta… */
  category?: string;
  /** Gramos por unidad (envase) y de una ración, si se conocen (p. ej. por el código de barras). */
  unitGrams?: number;
  portionG?: number;
  /** Nombre de la unidad suelta dentro del envase (rebanadas, tortitas, pechugas, salchichas…). */
  unitLabel?: string;
  /** Unidades sueltas que trae cada envase (p. ej. 16 rebanadas, o 24 salchichas = 4 packs de 6). */
  unitsPerPack?: number;
  /** Unidades por pack interior si el envase trae varios (4 packs de 6 salchichas → 6). */
  innerPack?: number;
  /** Unidades sueltas que quedan en total. Si falta, se entiende que todos los envases están enteros. */
  units?: number;
  /** El usuario quitó el conteo por unidades: no se vuelve a aplicar solo. */
  unitsOff?: boolean;
}

/** Producto que ha pasado por la despensa: se recuerda para poder volver a añadirlo si se agota y se te olvida reponerlo. */
export interface PantryMemo {
  name: string;
  store?: string;
  place?: 'nevera' | 'despensa' | 'congelador';
  category?: string;
}

/** Unidades sueltas de un producto que la app recuerda para cuando vuelva a aparecer. */
export interface PackInfo {
  unitLabel: string;
  unitsPerPack: number;
  innerPack?: number;
}

/** Producto que ya escaneaste o leíste con foto: sus valores por 100 g se reutilizan al añadir ese alimento a mano. */
export interface SavedProduct {
  id: string;
  name: string;
  brand?: string;
  code?: string;
  image?: string;
  store?: string;
  /** Valores por 100 g/ml. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  satFat: number;
  fiber: number;
  salt: number;
  /** Ración del envase (g) y peso del envase (g), si se conocen. */
  serving?: number;
  pack?: number;
  /** Última vez que se usó (ms): el más reciente se propone primero. */
  usedAt: number;
  /** 'auto' = aprendido de una estimación de la IA (valores aproximados); si falta, viene de un escaneo o de tu foto de la tabla. */
  source?: 'auto';
}

export interface ShoppingItem {
  id: string;
  name: string;
  qty: number;
}

export interface HabitDay {
  /** Vasos de 250 ml. */
  agua: number;
  sleepHours?: number;
  steps?: number;
  /** Face Yoga nocturno completado. */
  faceYoga?: boolean;
  /** Suplementos tomados hoy (id → true). */
  supps?: Record<string, boolean>;
}

export interface Supplement {
  id: string;
  name: string;
  dose?: string;
  active: boolean;
}

export interface Supplementation {
  /** "¿Tomas suplementación actualmente?" (desactivado por defecto). */
  enabled: boolean;
  items: Supplement[];
}

export interface Measurement {
  id: string;
  ts: number;
  weight?: number;
  waist?: number;
  /** Barriga baja: parte más prominente por debajo del ombligo. */
  belly?: number;
  hip?: number;
  thigh?: number;
  arm?: number;
  chest?: number;
}

export type Slot = 'desayuno' | 'comida' | 'merienda' | 'cena' | 'snack';

export interface MealTemplate {
  id: string;
  name: string;
  calorias: number;
  proteinas: number;
  carbs: number;
  grasas: number;
  /** Nombres de ingredientes (se cruzan con la despensa). */
  ingredientes: string[];
  slots?: Slot[];
  /** Receta / elaboración en texto libre (pasos, tiempos…), opcional. */
  receta?: string;
}

/** Comida que ya sabes que harás hoy (comida/cena), para calcular lo que queda para el resto. */
export interface PlannedMeal {
  name: string;
  calorias: number;
  proteinas: number;
  carbs: number;
  grasas: number;
  templateId?: string;
  tupperId?: string;
  pantryName?: string;
  /** Varios productos de la despensa usados en este plato. */
  pantryNames?: string[];
  /** Cada ingrediente con su cantidad (12 uvas, 1 cucharada de ketchup…), si la sugerencia los traía. */
  detalle?: string[];
  /** Elaboración de la receta sugerida (para consultarla mientras cocinas). */
  tiempo?: string;
  pasos?: string[];
  consejo?: string;
}

/** Plato ya cocinado (meal prep) con raciones disponibles; los macros son POR RACIÓN. */
export interface Tupper {
  id: string;
  name: string;
  servings: number;
  calorias: number;
  proteinas: number;
  carbs: number;
  grasas: number;
  ingredientes?: string;
  createdAt: number;
}

export interface DayPlan {
  day: string;
  slots: Partial<Record<Slot, PlannedMeal>>;
  /** Tomas que hoy te saltas a propósito (p. ej. no desayunas): su presupuesto se reparte entre las demás. */
  skipped?: Slot[];
  /** Tomas tachadas solas por la hora (desayuno pasadas las 12, merienda pasadas las 20) sin registrar nada. */
  auto?: Slot[];
  /** Tomas que has vuelto a poner a mano: no se vuelven a tachar solas hoy. */
  restored?: Slot[];
}

/** Molestia articular registrada al pedir una alternativa. */
export interface Discomfort {
  id: string;
  ts: number;
  joint: string;
  exerciseName: string;
}

export interface AppState {
  /** Rutina nocturna de Face Yoga personalizada (ejercicios, tiempos, fotos). */
  faceNight?: import('./faceYoga').FaceNightCfg;
  discomfort: Discomfort[];
  /** Enlaces de vídeo de demostración elegidos por ti (clave = ejercicio o paso del calentamiento). */
  demoLinks: Record<string, string>;
  profile: Profile;
  settings: Settings;
  active: ActiveWorkout | null;
  workouts: WorkoutLog[];
  templates: RoutineTemplate[];
  exercises: Exercise[];
  measurements: Measurement[];
  mealTemplates: MealTemplate[];
  tuppers: Tupper[];
  shopping: ShoppingItem[];
  dayPlan: DayPlan | null;
  /** Lo que dejas planificado para MAÑANA (por la noche, pasada la hora de cenar). Al llegar el día pasa a ser el plan de hoy. */
  nextPlan?: DayPlan;
  /** Orden personalizado de los bloques de cada página. */
  layout: Record<string, string[]>;
  /** Bloques ocultos por página (ojo del modo Ordenar). */
  layoutHidden: Record<string, string[]>;
  meals: Meal[];
  pantry: PantryItem[];
  /** Productos ya escaneados o leídos con foto (se reutilizan sus valores). */
  products?: SavedProduct[];
  utensils: string[];
  /** Supermercados habituales (también se guarda como `user_supermarkets`). */
  supermarkets: string[];
  /** Alimentos que no le gustan al usuario (se excluyen de recetas y consejos). */
  dislikes: string[];
  /** Supermercado predeterminado (también en `default_supermarket`). */
  defaultSupermarket: string;
  /** Foto aprendida por producto (clave = producto normalizado). URL, data URL, o '' = usar icono. */
  productImages: Record<string, string>;
  /** Unidades por envase aprendidas por producto (clave = producto normalizado): rebanadas, tortitas, packs… */
  packInfo?: Record<string, PackInfo>;
  /** Productos que han estado en la despensa (incluidos los ya agotados), para buscarlos y volver a añadirlos. */
  pantryHistory?: PantryMemo[];
  /** Correcciones aprendidas de los gramos que estima la IA, por alimento. */
  calib?: Calibration;
  homeGear: HomeGear[];
  homeSpecs: HomeSpecs;
  habits: Record<string, HabitDay>;
  supplements: Supplementation;
  /** Hora a la que pulsaste «Ir a dormir» (ms), si estás durmiendo. */
  sleepStart: number | null;
}

/** Un ingrediente de un plato analizado, con su peso editable. */
export interface MealPart {
  nombre: string;
  gramos: number;
  calorias: number;
  proteinas: number;
  carbs: number;
  grasas: number;
  /** true si los valores salen de la tabla de la app; false si son estimación de la IA. */
  tabla: boolean;
  /** Estimación original de la IA, para reescalar al cambiar los gramos. */
  base?: { gramos: number; calorias: number; proteinas: number; carbs: number; grasas: number };
  /** El peso corresponde al alimento crudo (carne y pescado); si no, cocinado. */
  crudo?: boolean;
  /** Gramos que leyó la IA antes de tus correcciones (para aprender cuánto sueles corregir). */
  aiGramos?: number;
  /** Factor aplicado a los gramos de la IA según tus correcciones anteriores. */
  ajuste?: number;
}

/** Cuánto sueles corregir a la IA en cada alimento: factor medio sobre sus gramos y nº de veces. */
export type Calibration = Record<string, { ratio: number; n: number }>;

export interface MealAnalysis {
  /** Valores de un plato o tupper guardado al que se parece la foto. */
  guardado?: { nombre: string; calorias: number; proteinas: number; carbs: number; grasas: number };
  /** Calorías de cada lectura de la IA, si se hizo doble lectura. */
  lecturas?: number[];
  /** Aviso cuando las dos lecturas no coinciden. */
  aviso?: string;
  /** Desglose por ingrediente (editable). Los totales salen de aquí cuando existe. */
  desglose?: MealPart[];
  plato: string;
  calorias: number;
  proteinas: number;
  carbs: number;
  grasas: number;
  ingredientesDetectados: string[];
  coincidenciasDespensa: string[];
  /** Valoración breve de cómo encaja la comida en el objetivo del usuario. */
  consejo?: string;
}

export type Difficulty = 'Fácil' | 'Media' | 'Difícil';

export interface Recipe {
  nombre: string;
  dificultad: Difficulty;
  utensilios: string[];
  calorias: number;
  proteinas: number;
  carbs: number;
  grasas: number;
  tiempoMin: number;
  /** Ingredientes con cantidad, tal como los propone la IA. */
  ingredientes: { nombre: string; cantidad: string }[];
  /** Ingredientes de la despensa que se consumen (verificados). */
  ingredientesDespensa: string[];
  /** Ingredientes que NO están en la despensa o que no le gustan al usuario (aviso). */
  fueraDespensa: string[];
  pasos: string[];
}
