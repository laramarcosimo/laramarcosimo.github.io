import { analyze } from './progress';
import { macroGoal, proteinGoal, kcalRange, planText, typicalSessionKcal, type DayBalance } from './metabolic';
import type { AppState, Goal } from './types';

export interface DayPlan {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}


/** Metas para día de descanso y día de entreno (esta última con la sesión típica). */
export const dayPlans = (s: AppState): { rest: DayPlan; train: DayPlan; session: number } => {
  const protein = proteinGoal(s.settings).min;
  const session = typicalSessionKcal(s);
  const midR = (r: { min: number; max: number }) => Math.round((r.min + r.max) / 2);
  const mk = (kcal: number, training: boolean): DayPlan => ({ kcal, protein, carbs: midR(macroGoal(s.settings, training).carbs), fat: midR(macroGoal(s.settings, training).fat) });
  const mid = (t: boolean) => { const r = kcalRange(s.settings, t); return Math.round((r.min + r.max) / 2); };
  return { rest: mk(mid(false), false), train: mk(mid(true), true), session };
};

const GOAL_TEXT: Record<Goal, string> = {
  recomp:
    'OBJETIVO DEL USUARIO: perder grasa localizada en el abdomen y lograr un cuerpo tonificado y firme (recomposición corporal). El peso en la báscula NO es el objetivo (puede mantenerse o subir si gana músculo): el indicador de éxito es la cintura y la fuerza. Comidas saciantes y poco procesadas, sin pasar hambre. CIFRAS: las ÚNICAS válidas son las del baremo indicado más abajo (calorías, proteína, carbohidratos y grasa); si algo de este texto choca con esas cifras, mandan las cifras.',
  deficit: 'OBJETIVO DEL USUARIO: perder grasa conservando el músculo. Comidas saciantes y poco procesadas. CIFRAS: las ÚNICAS válidas son las del baremo indicado más abajo; si algo choca con ellas, mandan las cifras.',
  maintain: 'OBJETIVO DEL USUARIO: mantener el peso y la composición corporal. CIFRAS: las ÚNICAS válidas son las del baremo indicado más abajo; si algo choca con ellas, mandan las cifras.',
  surplus: 'OBJETIVO DEL USUARIO: ganar masa muscular con comida de calidad. CIFRAS: las ÚNICAS válidas son las del baremo indicado más abajo; si algo choca con ellas, mandan las cifras.',
};

/** Qué falta y qué sobra HOY, dicho sin ambigüedad: proteína cubierta (no insistir) y calorías por debajo del mínimo (no quedarse corta). */
export const coverageNote = (b: DayBalance): string => {
  const notes: string[] = [];
  if (b.proteinRemaining <= 0) notes.push(`LA PROTEÍNA DE HOY YA ESTÁ CUBIERTA (${Math.round(b.proteinEaten)} g de un mínimo de ${b.proteinTarget} g): NO recomiendes más alimentos proteicos; si faltan calorías, cúbrelas con hidratos de calidad y grasas saludables.`);
  if (b.fat >= b.fatTarget - 2) notes.push(`HA LLEGADO A SU MÁXIMO DE GRASA (${Math.round(b.fat)} g de ${b.fatTarget} g): NO recomiendes nada con grasa (aceite, frutos secos, aguacate, queso, embutidos, huevo entero…).`);
  if (b.carbs >= b.carbsTarget - 5) notes.push(`HA LLEGADO A SU MÁXIMO DE CARBOHIDRATOS (${Math.round(b.carbs)} g de ${b.carbsTarget} g): NO recomiendes pan, pasta, arroz, patata, cereales ni fruta dulce.`);
  const toMin = Math.max(0, b.kcalMin - b.eaten);
  if (toMin > 0) notes.push(`Para llegar al MÍNIMO de calorías de hoy aún faltan ${toMin} kcal: no propongas raciones minúsculas, ajusta las cantidades a lo que falta (sin pasar de ${b.kcalMax} kcal en total).`);
  else if (b.eaten > b.kcalMax) notes.push(`Hoy ya se ha pasado del máximo de calorías (${b.kcalMax}): propón solo algo muy ligero o nada.`);
  return notes.join(' ');
};

/** Contexto de objetivo y del día para que Gemini recomiende comidas ajustadas. */
export const goalContext = (s: AppState, b: DayBalance): string => {
  const carbsMax = Math.max(0, b.carbsTarget - b.carbs);
  const carbsToMin = Math.max(0, b.carbsMin - b.carbs);
  const fatMax = Math.max(0, b.fatTarget - b.fat);
  const fatToMin = Math.max(0, b.fatMin - b.fat);
  const lines = [
    GOAL_TEXT[s.profile.goal],
    planText(s.settings),
    `Peso ${s.profile.weight} kg. Hoy es día de ${b.trained ? 'ENTRENO (ya entrenado)' : b.trainingDay ? 'ENTRENO (aún sin entrenar)' : 'descanso'}.`,
    `Meta de hoy (${b.trainingDay ? 'entreno' : 'descanso'}): ${b.kcalMin}-${b.kcalMax} kcal, ${b.proteinTarget}-${b.proteinMax} g de proteína, ${b.carbsMin === b.carbsTarget ? b.carbsTarget : b.carbsMin + '-' + b.carbsTarget} g de carbohidratos y ${b.fatMin === b.fatTarget ? b.fatTarget : b.fatMin + '-' + b.fatTarget} g de grasa. Ya consumido: ${b.eaten} kcal, ${b.proteinEaten} g de proteína, ${Math.round(b.carbs)} g de carbohidratos y ${Math.round(b.fat)} g de grasa.`,
    `Restante: ${Math.max(0, b.remaining)} kcal, ${Math.max(0, b.proteinRemaining)} g de proteína; carbohidratos: faltan ${carbsToMin} g para el mínimo y caben como máximo ${carbsMax} g; grasa: faltan ${fatToMin} g para el mínimo y caben como máximo ${fatMax} g (el máximo NO se supera).`,
    coverageNote(b),
    b.proteinRemaining > 0 && new Date().getHours() >= 16 ? `PRIORIDAD DE PROTEÍNA: ya es tarde y aún faltan ${b.proteinRemaining} g para el mínimo (${b.proteinTarget} g). Cada propuesta debe aportar mucha proteína magra (pollo, pavo, pescado, huevo, claras, skyr, queso fresco batido) para llegar al mínimo sin pasarse de las kcal restantes.` : '',
    progressLine(s),
    s.dislikes.length ? `Alimentos que NO le gustan (nunca los propongas): ${s.dislikes.join(', ')}.` : '',
    'Criterios: prioriza alimentos saciantes (proteína magra, fibra, verduras, legumbres, huevo, lácteos altos en proteína), poco procesados; evita azúcares añadidos, frituras y calorías líquidas. Ajusta raciones para no superar las calorías restantes y acercarte a la proteína restante.',
    b.trained ? 'Como ya ha entrenado, el carbohidrato de las comidas siguientes puede ser algo mayor (recuperación); mantén las grasas moderadas.' : 'Si entrena hoy, reparte los carbohidratos antes y después de la sesión; en comidas lejanas al entreno, más proteína y verdura, menos carbohidrato.',
  ];
  return lines.join('\n');
};

/** Contexto breve para recetas (menos tokens que el contexto completo). */
export const recipeContext = (s: AppState, b: DayBalance): string => {
  return [
    planText(s.settings),
    GOAL_TEXT[s.profile.goal],
    s.dislikes.length ? `Alimentos que NO le gustan (nunca los propongas): ${s.dislikes.join(', ')}.` : '',
    `Hoy ${b.trained ? 'YA ha entrenado' : b.trainingDay ? 'toca entreno y aún no ha entrenado' : 'es día de descanso'}. Le restan ${Math.max(0, b.remaining)} kcal, ${Math.max(0, b.proteinRemaining)} g de proteína, carbohidratos: entre ${Math.max(0, b.carbsMin - Math.round(b.carbs))} (mínimo) y ${Math.max(0, b.carbsTarget - Math.round(b.carbs))} g (máximo); grasa: entre ${Math.max(0, b.fatMin - Math.round(b.fat))} (mínimo) y ${Math.max(0, b.fatTarget - Math.round(b.fat))} g (máximo, no se supera).`,
    coverageNote(b),
    b.proteinRemaining > 0 && new Date().getHours() >= 16 ? `PRIORIDAD: faltan ${b.proteinRemaining} g de proteína para el mínimo; las recetas deben ser ricas en proteína magra.` : '',
  ].filter(Boolean).join('\n');
};

const progressLine = (s: AppState): string => {
  const p = analyze(s.measurements, s.profile.height);
  if (!p.latest) return '';
  const w = p.latest.waist ? `cintura ${p.latest.waist} cm` : '';
  const d = p.waistDelta !== null ? ` (${p.waistDelta > 0 ? '+' : ''}${p.waistDelta} cm desde el inicio)` : '';
  const lastBelly = [...s.measurements].sort((a, b) => b.ts - a.ts).find((m) => (m.belly ?? 0) > 0)?.belly;
  const bl = lastBelly ? `barriga baja ${lastBelly} cm${p.bellyDelta !== null ? ` (${p.bellyDelta > 0 ? '+' : ''}${p.bellyDelta} cm desde el inicio)` : ''}` : '';
  const body = [w ? w + d : '', bl, p.latest.weight ? `peso ${p.latest.weight} kg` : ''].filter(Boolean).join(', ');
  return `Progreso: ${body}. ${p.verdict.text} Cintura y barriga baja: lo malo es que suban (la barriga baja es lo que más quiere reducir). Cadera, muslo, brazo y pecho: que suban es BUENO (más glúteo y músculo); solo es un problema si bajan mucho.`;
};
