import { isConnected, lastBackupAt, lastBackupError, readCloud } from './cloud';
import { lastManualBackupTs } from './backup';
import { byDay, faceStreak, faceTimeOf, weeklyStreak } from './streaks';
import { recurrentJoint } from './joints';
import { completeProtein } from './foods';
import { dayBalance } from './metabolic';
import type { AppState } from './types';
import { isVacationWeek } from './vacation';
import { dayKey, daysUntil } from './utils';

const SNOOZE_KEY = 'apex-reminders-snooze';
const DAY = 86400000;

export interface Reminder {
  id: 'face' | 'postworkout' | 'measure' | 'backup' | 'expiry' | 'deload' | 'protein' | 'joint' | 'cloud' | 'photo';
  title: string;
  text: string;
  /** No se puede posponer. */
  persistent?: boolean;
}

const snoozes = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
};

export const snooze = (id: string, days = 1): void => {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify({ ...snoozes(), [id]: Date.now() + days * DAY }));
  } catch {
    /* noop */
  }
};

/** Si hoy has entrenado y aún faltan ≥ 15 g de proteína: cuándo avisar (hora elegida, por defecto 21:00) y qué decir. De madrugada sigue contando el día anterior. */
export function postWorkoutInfo(s: AppState, now = Date.now()): { dueAt: number; title: string; text: string } | null {
  const endOf = (w: AppState['workouts'][number]): number => Date.parse(w.endTime) || Date.parse(w.startTime) + w.durationSeconds * 1000;
  const d = new Date(now);
  if (d.getHours() < 5) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  const dayStart = d.getTime();
  if (!s.workouts.some((w) => { const t = endOf(w); return t >= dayStart && t <= now; })) return null;
  const b = dayBalance(s, dayKey(dayStart));
  const protLeft = Math.round(b.proteinRemaining);
  if (protLeft < 15) return null;
  const kcalLeft = Math.max(0, Math.round(b.remaining));
  const idea = completeProtein(s.pantry, protLeft, kcalLeft)[0];
  return {
    dueAt: dayStart + (s.settings.postHour ?? 21) * 3600000,
    title: `Has entrenado: te quedan ${protLeft} g de proteína`,
    text: `Para la cena tras entrenar: te quedan ${protLeft} g de proteína y ${kcalLeft} kcal hoy.${idea ? ` Con tu despensa: ${idea.portion} (≈ ${idea.protein} g de proteína, ${idea.kcal} kcal).` : ' Una opción rápida: yogur griego, 2 huevos o un batido de proteínas.'}`,
  };
}

/** Próximo momento en que toca recordar la foto de progreso: el día elegido del mes y, si no se hizo, cada día a esa hora hasta hacerla. null si está desactivado. */
export function photoDueAt(s: AppState, now = Date.now()): number | null {
  if (!s.settings.photoRemind) return null;
  const day = Math.min(28, Math.max(1, s.settings.photoDay ?? 1));
  const [h, m] = (s.settings.photoTime ?? '09:00').split(':').map(Number);
  const cur = new Date(now);
  const taken = !!s.settings.lastPhotoTs && new Date(s.settings.lastPhotoTs).getMonth() === cur.getMonth() && new Date(s.settings.lastPhotoTs).getFullYear() === cur.getFullYear();
  const target = new Date(cur.getFullYear(), cur.getMonth() + (taken ? 1 : 0), day, h || 0, m || 0, 0, 0).getTime();
  if (target > now) return target;
  const today = new Date(now);
  today.setHours(h || 0, m || 0, 0, 0);
  return today.getTime() > now ? today.getTime() : today.getTime() + 86_400_000; // atrasada: cada día a esa hora
}

/** Recordatorios pendientes: medir la cintura (cada 7 días) y copia de seguridad (cada 14 días si no hay copia automática). */
export function dueReminders(s: AppState, now = Date.now()): Reminder[] {
  const out: Reminder[] = [];
  const z = snoozes();
  const hasData = s.workouts.length > 0 || s.meals.length > 0;

  // Rutina facial nocturna: desde la hora elegida, si hoy aún no la has hecho.
  if (s.settings.faceRemind && !s.habits[dayKey(now)]?.faceYoga && !(z.face > now)) {
    const { h, m } = faceTimeOf(s.settings);
    const at = new Date(now);
    at.setHours(h, m, 0, 0);
    if (now >= at.getTime()) {
      const n = faceStreak(s.habits, now);
      out.push({ id: 'face', title: 'Toca tu Face Yoga', text: `Son 7 minutos y se hacen tumbada o sentada en la cama.${n > 0 ? ` Llevas una racha de ${n} día${n === 1 ? '' : 's'}: no la rompas.` : ' Empieza hoy tu racha.'}` });
    }
  }

  // Foto de progreso mensual: desde el día elegido, si aún no la has hecho este mes.
  if (s.settings.photoRemind && !(z.photo > now)) {
    const at = photoDueAt(s, now);
    const day = Math.min(28, Math.max(1, s.settings.photoDay ?? 1));
    const taken = !!s.settings.lastPhotoTs && new Date(s.settings.lastPhotoTs).getMonth() === new Date(now).getMonth() && new Date(s.settings.lastPhotoTs).getFullYear() === new Date(now).getFullYear();
    if (!taken && at !== null && new Date(now).getDate() >= day) out.push({ id: 'photo', title: 'Toca tu foto de progreso del mes', text: 'Hazte una foto de cuerpo entero y otra de la cara (misma luz, misma distancia y misma postura). Está en Hoy → Progreso → Fotos de progreso.' });
  }

  // Post-entreno / cena: si hoy has entrenado, desde la hora elegida (por defecto 21:00) recuerda la proteína y las kcal que quedan.
  {
    const info = postWorkoutInfo(s, now);
    if (info && now >= info.dueAt && !(z.postworkout > now)) out.push({ id: 'postworkout', title: info.title, text: info.text });
  }

  // Medidas semanales: día y hora a tu elección; avisa si alguna de las medidas visibles no se ha tomado desde la última cita.
  {
    const day = s.settings.measureDay ?? 1;
    const hour = s.settings.measureHour ?? 8;
    const d = new Date(now);
    d.setHours(hour, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() - day + 7) % 7));
    if (d.getTime() > now) d.setDate(d.getDate() - 7);
    const dueAt = d.getTime();
    const hiddenMeasures = s.layoutHidden['hoy-medidas'] ?? [];
    const LABEL: Record<string, string> = { weight: 'peso', waist: 'cintura', hip: 'cadera', thigh: 'muslo', arm: 'brazo', chest: 'pecho' };
    const lastTs = (k: 'weight' | 'waist' | 'hip' | 'thigh' | 'arm' | 'chest') => Math.max(0, ...s.measurements.filter((m) => (m[k] ?? 0) > 0).map((m) => m.ts));
    const missing = (Object.keys(LABEL) as (keyof typeof LABEL)[]).filter((k) => !hiddenMeasures.includes(k) && lastTs(k as 'weight') < dueAt);
    if (s.settings.measureRemind !== false && hasData && missing.length > 0 && !(z.measure > now)) {
      out.push({ id: 'measure', title: `Toca medirte · ${missing.length} ${missing.length === 1 ? 'medida' : 'medidas'}`, text: `Faltan: ${missing.map((k) => LABEL[k]).join(', ')}. Mídete en ayunas y en las mismas condiciones para ver tu progreso real. Puedes cambiar el día, la hora y qué medidas ves en Ajustes y en «Progreso».` });
    }
  }

  const cloudOn = isConnected() && readCloud().auto;
  const last = Math.max(lastManualBackupTs(), lastBackupAt());
  if (hasData && !cloudOn && now - last > 7 * DAY && (!(z.backup > now) || now - last > 21 * DAY)) {
    out.push({ id: 'backup', title: 'Haz una copia de seguridad', text: last ? 'Hace más de una semana de tu última copia. Si borras la app, perderías lo posterior.' : 'Todavía no tienes ninguna copia. Si borras la app, perderías tus datos.', persistent: now - last > 21 * DAY });
  }
  // La copia automática está configurada pero lleva días sin subirse (o ha fallado).
  if (hasData && isConnected() && readCloud().auto && !(z.cloud > now)) {
    const lastUp = lastBackupAt();
    const err = lastBackupError();
    if ((lastUp > 0 && now - lastUp > 3 * DAY) || (lastUp === 0 && err)) {
      const days = lastUp > 0 ? Math.floor((now - lastUp) / DAY) : 0;
      out.push({ id: 'cloud', title: lastUp > 0 ? `La copia en la nube lleva ${days} días sin subirse` : 'No se ha podido subir la primera copia', text: `${err ? `Último error: ${err.msg}. ` : ''}Abre Ajustes → Copia de seguridad y pulsa «Subir copia a la nube» para ver qué falla. Si borras la app antes, perderías lo posterior.` });
    }
  }
  const expiring = s.pantry.filter((p) => p.expires && p.qty > 0 && daysUntil(p.expires, now) <= 2);
  if (expiring.length > 0 && !(z.expiry > now)) {
    out.push({ id: 'expiry', title: 'Caduca pronto', text: `${expiring.map((p) => p.name).slice(0, 4).join(', ')}${expiring.length > 4 ? '…' : ''}: úsalo primero o congélalo.` });
  }

  const weeks = weeklyStreak(byDay(s.workouts), s.settings.weeklyGoal, now, (w) => isVacationWeek(s.settings, w));
  // Fatiga: ejercicios que en las últimas 2 semanas se hicieron «al límite» (RPE 10 o fallo). Con 3 semanas seguidas y 3 o más, ya toca descargar.
  const heavy = new Set<string>();
  for (const w of s.workouts) {
    if (now - Date.parse(w.startTime) > 14 * DAY) continue;
    for (const e of w.exercises) if (e.sets.some((x) => x.type !== 'warmup' && (x.rpe === 10 || x.type === 'failure'))) heavy.add(e.exerciseId);
  }
  if ((weeks >= 4 || (weeks >= 3 && heavy.size >= 3)) && !(z.deload > now)) {
    out.push({ id: 'deload', title: weeks >= 4 ? `${weeks} semanas seguidas entrenando` : `Fatiga acumulada: ${heavy.size} ejercicios al límite`, text: heavy.size >= 3 ? `Llevas ${weeks} semanas seguidas y ${heavy.size} ejercicios al límite (RPE 10 o fallo) en las últimas 2 semanas. Valora una semana de descarga: mismos ejercicios con ~40 % menos de series y sin llegar al fallo.` : 'Valora una semana de descarga: mismos ejercicios con ~40 % menos de series y sin llegar al fallo. Ayuda a recuperar y a seguir progresando.' });
  }

  const rj = recurrentJoint(s, now);
  if (rj && !(z.joint > now)) {
    out.push({ id: 'joint', title: `Molestia recurrente: ${rj.joint.toLowerCase()}`, text: `Has cambiado ejercicios por esa zona ${rj.count} veces en 2 semanas. Considera descansarla unos días, calentar mejor y, si persiste, consultar a un fisioterapeuta. La app evita proponerte ejercicios que la cargan.` });
  }

  // Proteína pendiente por la tarde (a partir de las 18:00, con alguna comida registrada hoy).
  if (new Date(now).getHours() >= 18 && !(z.protein > now)) {
    const b = dayBalance(s);
    const missing = Math.round(b.proteinTarget - b.proteinEaten);
    if (b.eaten > 0 && missing >= 30) {
      const ideas = missing >= 50 ? 'lata de atún (~25 g) + yogur griego (~10 g) + 2 huevos (~12 g)' : missing >= 35 ? 'lata de atún (~25 g) + yogur griego (~10 g)' : 'yogur griego (~10 g) o 2 huevos (~12 g) o un batido de proteína (~25 g)';
      out.push({ id: 'protein', title: `Te faltan ${missing} g de proteína hoy`, text: `Ideas rápidas para la cena: ${ideas}.` });
    }
  }
  // En vacaciones se pausan los avisos de entreno.
  return s.settings.vacation ? out.filter((r) => !['postworkout', 'deload', 'joint'].includes(r.id)) : out;
}
