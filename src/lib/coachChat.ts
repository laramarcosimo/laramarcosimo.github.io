import { dayBalance, planText } from './metabolic';
import { KNEE_RULES_PROMPT } from './knee';
import { weightStep } from './workout';
import type { ActiveWorkout, AppState } from './types';

/** Contexto que se inyecta a Gemini en cada pregunta del Coach en vivo: sesión actual, perfil y objetivos de nutrición. */
export const liveCoachContext = (s: AppState, w?: ActiveWorkout | null): string => {
  const p = s.profile;
  const lines = [
    `Perfil de la alumna: ${p.sex === 'M' ? 'hombre' : 'mujer'}, ${p.age} años, ${p.weight} kg, ${p.height} cm. Objetivo: recomposición corporal (tonificar glúteo y reducir cintura/grasa abdominal sin perder músculo). Trabaja siempre a 3 series por ejercicio.`,
    s.settings.kneeSafe ? `Cuidado patelar de rodillas ACTIVO. ${KNEE_RULES_PROMPT}` : '',
    planText(s.settings),
  ];
  const b = dayBalance(s);
  lines.push(`Hoy lleva ${b.eaten} kcal y ${b.proteinEaten} g de proteína; le quedan ${Math.max(0, b.remaining)} kcal.`);
  if (w) {
    const name = (id: string): string => s.exercises.find((e) => e.id === id)?.name ?? 'Ejercicio';
    const work = (e: ActiveWorkout['exercises'][number]) => e.sets.filter((x) => x.type !== 'warmup');
    const current = w.exercises.find((e) => !e.skipped && work(e).some((x) => !x.completed)) ?? w.exercises[w.exercises.length - 1];
    const done = w.exercises.reduce((a, e) => a + work(e).filter((x) => x.completed).length, 0);
    const total = w.exercises.reduce((a, e) => a + work(e).length, 0);
    lines.push(`ENTRENO EN CURSO: «${w.title}» en ${w.location === 'home' ? 'casa' : 'gimnasio'}, lleva ${Math.round((Date.now() - w.startedAt) / 60000)} min y ${done} de ${total} series hechas.`);
    if (current) {
      const last = [...work(current)].reverse().find((x) => x.completed);
      const cx = s.exercises.find((e) => e.id === current.exerciseId);
      if (cx?.equipment === 'Máquina') lines.push(`Es una MÁQUINA: los pesos suben por escalones fijos de ${weightStep(cx)} kg. Si pide el siguiente peso, indica UN solo escalón por encima de su última carga (nunca saltos grandes).`);
      const hard = work(current).filter((x) => x.completed && (x.rpe === 10 || x.type === 'failure'));
      if (hard.length) lines.push(`AVISO DE CARGA: en este ejercicio ya tuvo ${hard.length} serie(s) al límite (RPE 10/fallo). Si pregunta por el peso, recomiéndale BAJAR entre 1 y 2,5 kg para proteger la técnica y las articulaciones y asegurar el estímulo correcto.`);
      lines.push(`Ejercicio actual: ${name(current.exerciseId)} (${work(current).filter((x) => x.completed).length}/${work(current).length} series${last ? `; última serie ${last.weight} kg x ${last.reps}` : ''}).`);
    }
    lines.push(`Ejercicios de la sesión: ${w.exercises.map((e) => name(e.exerciseId)).join(', ')}.`);
  }
  return lines.filter(Boolean).join('\n');
};
