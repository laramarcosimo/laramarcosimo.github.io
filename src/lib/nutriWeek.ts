import { analyzeProgression } from './progression';
import { recentJoints, recurrentJoint } from './joints';
import { slotOf } from './templates';
import type { AppState } from './types';
import { norm } from './utils';

const DAY = 86_400_000;

const OILY_FISH = /salmon|atun|sardina|caballa|boqueron|anchoa|trucha|bonito/;
const FISH = /merluza|bacalao|gamba|pescado|lubina|dorada|rape|calamar|sepia|pulpo|lenguado|marisco|mejillon/;
const VEG = /ensalada|verdura|brocoli|espinaca|calabacin|tomate|lechuga|pimiento|zanahoria|judias verdes|coliflor|berenjena|esparrago|champinon|pepino|cebolla|acelga|crema de|gazpacho|menestra|salteado/;
const FRUIT = /platano|manzana|pera|naranja|mandarina|kiwi|fresa|uva|melon|sandia|pina|arandano|frambuesa|mango|melocoton|cereza|fruta|datil|higo/;
const SOURCES: [string, RegExp][] = [
  ['huevo', /huevo|tortilla|revuelto/],
  ['pollo/pavo', /pollo|pavo|pechuga/],
  ['ternera/cerdo', /ternera|cerdo|lomo|hamburguesa|jamon|chorizo/],
  ['pescado', new RegExp(`${OILY_FISH.source}|${FISH.source}`)],
  ['legumbres', /garbanzo|lenteja|alubia|judias blancas|legumbre|hummus/],
  ['lácteos', /yogur|skyr|queso|cottage|leche|kefir/],
  ['tofu/vegetal', /tofu|tempeh|seitan/],
  ['proteína en polvo', /whey|proteina en polvo|batido/],
];

export interface WeekStats {
  days: number;
  avgKcal: number;
  avgProtein: number;
  /** Media de proteína por toma. */
  perSlot: Record<string, number>;
  oilyFish: number;
  fish: number;
  vegDays: number;
  fruitDays: number;
  sources: Record<string, number>;
  workouts: number;
  /** Comidas marcadas como fuera de casa, total de comidas y kcal/proteína medias de cada tipo. */
  outMeals: number;
  totalMeals: number;
  outAvg: { kcal: number; protein: number };
  homeAvg: { kcal: number; protein: number };
  /** Series de trabajo por grupo muscular en los últimos 7 días. */
  setsByMuscle: Record<string, number>;
}

/** Estadística de los últimos 7 días calculada en el móvil (sin IA): lo que come y lo que entrena. */
export const weekStats = (s: AppState, now = Date.now()): WeekStats => {
  const meals = s.meals.filter((m) => now - m.ts <= 7 * DAY);
  const byDay: Record<string, typeof meals> = {};
  for (const m of meals) (byDay[new Date(m.ts).toDateString()] ??= []).push(m);
  const days = Object.keys(byDay).length;
  const text = (m: { plato: string }) => norm(m.plato);
  const slotSum: Record<string, { p: number; n: number }> = {};
  for (const m of meals) {
    const k = slotOf(m);
    (slotSum[k] ??= { p: 0, n: 0 }).p += m.proteinas;
    slotSum[k].n += 1;
  }
  const perSlot = Object.fromEntries(Object.entries(slotSum).map(([k, v]) => [k, Math.round(v.p / v.n)]));
  const sources: Record<string, number> = {};
  for (const m of meals) for (const [name, re] of SOURCES) if (re.test(text(m))) sources[name] = (sources[name] ?? 0) + 1;
  const dayHas = (re: RegExp) => Object.values(byDay).filter((ms) => ms.some((m) => re.test(text(m)))).length;
  const wk = s.workouts.filter((w) => now - Date.parse(w.startTime) <= 7 * DAY);
  const setsByMuscle: Record<string, number> = {};
  for (const w of wk) for (const e of w.exercises) setsByMuscle[e.muscleGroup] = (setsByMuscle[e.muscleGroup] ?? 0) + e.sets.filter((x) => x.type !== 'warmup').length;
  const out = meals.filter((m) => m.out);
  const home = meals.filter((m) => !m.out);
  const avg = (l: typeof meals) => ({ kcal: l.length ? Math.round(l.reduce((a, m) => a + m.calorias, 0) / l.length) : 0, protein: l.length ? Math.round(l.reduce((a, m) => a + m.proteinas, 0) / l.length) : 0 });
  return {
    outMeals: out.length,
    totalMeals: meals.length,
    outAvg: avg(out),
    homeAvg: avg(home),
    days,
    avgKcal: days ? Math.round(meals.reduce((a, m) => a + m.calorias, 0) / days) : 0,
    avgProtein: days ? Math.round(meals.reduce((a, m) => a + m.proteinas, 0) / days) : 0,
    perSlot,
    oilyFish: meals.filter((m) => OILY_FISH.test(text(m))).length,
    fish: meals.filter((m) => FISH.test(text(m)) || OILY_FISH.test(text(m))).length,
    vegDays: dayHas(VEG),
    fruitDays: dayHas(FRUIT),
    sources,
    workouts: wk.length,
    setsByMuscle,
  };
};

/** Texto para la IA con lo que ha pasado esta semana (variedad, pescado, verdura…), para que las propuestas la corrijan. */
export const weekContext = (s: AppState): string => {
  const w = weekStats(s);
  if (w.days === 0) return '';
  const top = Object.entries(w.sources).sort((a, b) => b[1] - a[1]);
  const missing = ['pescado', 'legumbres', 'huevo', 'pollo/pavo', 'ternera/cerdo'].filter((k) => !w.sources[k]);
  const outTxt = w.outMeals ? ` Comidas fuera de casa: ${w.outMeals} de ${w.totalMeals} (media ${w.outAvg.kcal} kcal y ${w.outAvg.protein} g de proteína fuera frente a ${w.homeAvg.kcal} kcal y ${w.homeAvg.protein} g en casa).` : '';
  return `HISTORIAL DE LA SEMANA (últimos 7 días, ${w.days} días registrados):${outTxt} pescado azul ${w.oilyFish} veces (meta 2-3/semana), pescado en total ${w.fish}, verdura en ${w.vegDays} días, fruta en ${w.fruitDays} días, proteína media ${w.avgProtein} g/día. Fuentes de proteína más repetidas: ${top.slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ') || 'ninguna'}${missing.length ? `; no ha comido: ${missing.join(', ')}` : ''}. Da prioridad a lo que le falta (pescado azul si va corto, legumbres, verdura) y NO repitas la fuente de proteína que más ha usado.`;
};

/** Hora habitual de entreno (mediana de los últimos entrenos), o null si no hay datos. */
export const usualTrainHour = (s: AppState): number | null => {
  const hs = s.workouts.slice(-8).map((w) => new Date(w.startTime).getHours()).sort((a, b) => a - b);
  return hs.length >= 2 ? hs[Math.floor(hs.length / 2)] : null;
};

/** Reglas de comida alrededor del entreno para los días que toca entrenar. */
export const periText = (s: AppState, trainingDay: boolean): string => {
  if (!trainingDay) return '';
  const h = usualTrainHour(s);
  return `ENTRENO DE HOY${h !== null ? ` (suele entrenar sobre las ${h}:00)` : ''}: la toma de 1-3 h ANTES del entreno debe llevar hidratos de fácil digestión + algo de proteína, poca grasa y poca fibra; la toma de las 2 h DESPUÉS debe llevar 25-30 g de proteína y hidratos para recuperar. Reparte los carbohidratos del día sobre todo alrededor del entreno; las tomas lejanas del entreno, más proteína y verdura que hidratos.`;
};

/** Datos reales para la auditoría de entreno: estancamientos, volumen semanal por músculo y molestias articulares. */
export const trainingContext = (s: AppState, items: { nombre: string; eid: string; notes?: string }[]): string => {
  const w = weekStats(s);
  const stalled = items.filter((it) => analyzeProgression(s.workouts, it.eid, it.nombre, it.notes, 2.5)?.kind === 'stall').map((it) => it.nombre);
  const joints = recentJoints(s.discomfort);
  const rec = recurrentJoint(s);
  const sets = Object.entries(w.setsByMuscle).map(([k, v]) => `${k} ${v}`).join(', ');
  return `DATOS REALES DE LA USUARIA: series de trabajo de los últimos 7 días por músculo: ${sets || 'sin entrenos'} (referencia: 10-20 series semanales por músculo grande; si un músculo clave de la recomposición, como glúteo, va por debajo, valora añadir trabajo). Ejercicios ESTANCADOS (sin mejorar en las últimas sesiones): ${JSON.stringify(stalled)} → valora cambiarlos por una variante o ajustar series/reps/descanso. Molestias articulares recientes: ${joints.length ? joints.join(', ') : 'ninguna'}${rec ? `; se repite ${rec.joint} (${rec.count} veces en 14 días)` : ''} → no propongas ejercicios que carguen esas articulaciones.`;
};

/** Días por defecto con merienda en la universidad: lunes a miércoles. */
export const DEFAULT_MERIENDA_FUERA = [1, 2, 3];

/** Dónde se merienda hoy (según Ajustes): fuera de casa exige algo portátil y sin cocinar. */
export const meriendaText = (settings: AppState['settings'], now = new Date()): string => {
  const fuera = (settings.meriendaFuera ?? DEFAULT_MERIENDA_FUERA).includes(now.getDay());
  return fuera
    ? 'MERIENDA DE HOY: la toma FUERA DE CASA (en la universidad): tiene que ser portátil, aguantar varias horas sin nevera y poder comerse sin cocinar ni calentar (fruta, bocadillo o sándwich pequeño, frutos secos, tortitas con crema de cacahuete, yogur o queso en táper con hielo, barrita casera). Nada que necesite plato, microondas o cubiertos complicados.'
    : 'MERIENDA DE HOY: la toma es EN CASA: puede cocinarse o prepararse al momento y usar la nevera.';
};

/** Tomas que ya no se van a hacer por la hora: desayuno pasadas las 12:00 y merienda pasadas las 20:00, si no hay nada previsto, registrado, tachado ni vuelto a poner. */
export const autoSkipDue = (hour: number, o: { planned: string[]; skipped: string[]; restored: string[]; logged: string[] }): string[] =>
  ([['desayuno', 12], ['merienda', 20]] as const).filter(([sl, cut]) => hour >= cut && ![...o.planned, ...o.skipped, ...o.restored, ...o.logged].includes(sl)).map(([sl]) => sl);
