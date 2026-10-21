import type { Exercise, LogExercise, LogSet, SetType, WorkoutLog } from './types';
import { guessEquipment, guessMuscle, noRecords } from './exercises';
import { workoutKcal } from './metabolic';
import { norm, num, uid } from './utils';
import { logVolume } from './workout';

const SET_MAP: Record<string, SetType> = { normal: 'normal', warmup: 'warmup', failure: 'failure', dropset: 'dropset', drop: 'dropset' };

/** Devuelve el ejercicio existente con ese nombre o crea uno propio (se acumula en `created`). */
export function makeResolver(existing: Exercise[]) {
  const created: Exercise[] = [];
  const resolve = (name: string): Exercise => {
    const key = norm(name);
    const hit = [...existing, ...created].find((e) => norm(e.name) === key);
    if (hit) return hit;
    const ex: Exercise = { id: uid(), name, muscleGroup: guessMuscle(name), equipment: guessEquipment(name), imageUrl: '', personalRecords: noRecords(), custom: true };
    created.push(ex);
    return ex;
  };
  return { resolve, created };
}

/** Construye un registro de historial a partir de ejercicios ya resueltos. */
export function buildLog(title: string, start: number, durationSec: number, exs: { ex: Exercise; sets: LogSet[] }[], weightKg: number, source: WorkoutLog['source'], kcalOverride = 0, volumeOverride = 0): WorkoutLog {
  const exercises: LogExercise[] = exs.map(({ ex, sets }) => ({ exerciseId: ex.id, name: ex.name, muscleGroup: ex.muscleGroup, sets }));
  const totalVolumeKg = volumeOverride > 0 ? Math.round(volumeOverride) : logVolume(exercises);
  return {
    id: uid(),
    title,
    startTime: new Date(start).toISOString(),
    endTime: new Date(start + durationSec * 1000).toISOString(),
    durationSeconds: durationSec,
    totalVolumeKg,
    totalSets: exercises.reduce((a, e) => a + e.sets.length, 0),
    prsAchieved: 0,
    caloriesBurned: kcalOverride > 0 ? kcalOverride : workoutKcal(weightKg, durationSec, exercises, (id) => exs.find((x) => x.ex.id === id)?.ex).total,
    exercises,
    source,
  };
}


/* ---------- CSV ---------- */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11, ene: 0, abr: 3, ago: 7, dic: 11 };

/** Formato de fecha típico: "7 Oct 2024, 10:30"; se acepta también ISO. */
export function parseDate(s: string): number {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-zñ]{3})[a-z]*\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon !== undefined) return new Date(+m[3], mon, +m[1], +m[4], +m[5]).getTime();
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? Date.now() : t;
}

export function importCsv(text: string, bodyWeight: number, resolve: (name: string) => Exercise): WorkoutLog[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('El CSV está vacío.');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (n: string): number => head.indexOf(n);
  const iTitle = col('title');
  const iStart = col('start_time');
  const iEnd = col('end_time');
  const iEx = col('exercise_title');
  const iType = col('set_type');
  const iW = col('weight_kg');
  const iR = col('reps');
  const iRpe = col('rpe');
  if (iStart < 0 || iEx < 0) throw new Error('El CSV no tiene el formato esperado (faltan start_time / exercise_title).');

  const groups = new Map<string, { title: string; start: number; end: number; ex: Map<string, LogSet[]> }>();
  for (const r of rows.slice(1)) {
    const startRaw = r[iStart] ?? '';
    const key = `${r[iTitle] ?? ''}|${startRaw}`;
    let g = groups.get(key);
    if (!g) {
      g = { title: r[iTitle] || 'Entreno importado', start: parseDate(startRaw), end: iEnd >= 0 ? parseDate(r[iEnd] ?? '') : 0, ex: new Map() };
      groups.set(key, g);
    }
    const exName = r[iEx] ?? 'Ejercicio';
    const sets = g.ex.get(exName) ?? [];
    sets.push({ type: SET_MAP[(r[iType] ?? 'normal').toLowerCase()] ?? 'normal', weight: num(r[iW]), reps: num(r[iR]), rpe: iRpe >= 0 && r[iRpe] ? num(r[iRpe]) : undefined });
    g.ex.set(exName, sets);
  }
  return [...groups.values()].map((g) => {
    const exs = [...g.ex.entries()].map(([name, sets]) => ({ ex: resolve(name), sets }));
    const durationSec = g.end > g.start ? Math.round((g.end - g.start) / 1000) : 3600;
    return buildLog(g.title, g.start, durationSec, exs, bodyWeight, 'csv');
  });
}
