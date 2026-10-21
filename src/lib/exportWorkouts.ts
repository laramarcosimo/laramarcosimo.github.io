import type { WorkoutLog } from './types';

/** Escapa un campo CSV. */
const q = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const fmtDur = (sec: number): string => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

const pad = (n: number): string => String(n).padStart(2, '0');
const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * Historial de entrenos en CSV con las columnas de la app Strong (que otras apps como Hevy saben importar):
 * Date, Workout Name, Duration, Exercise Name, Set Order, Weight, Reps, Distance, Seconds, Notes, Workout Notes, RPE.
 * El calentamiento va como «W» en Set Order. Pesos en kg.
 */
export function workoutsToCsv(workouts: WorkoutLog[]): string {
  const rows = ['Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE'];
  for (const w of [...workouts].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))) {
    for (const e of w.exercises) {
      let order = 0;
      for (const s of e.sets) {
        const isW = s.type === 'warmup';
        if (!isW) order++;
        rows.push([fmtDate(w.startTime), w.title, fmtDur(w.durationSeconds), e.name, isW ? 'W' : order, s.weight || 0, s.reps || 0, s.km ?? 0, s.min ? Math.round(s.min * 60) : 0, '', '', s.rpe ?? ''].map(q).join(','));
      }
    }
  }
  return rows.join('\n');
}

/** Descarga o comparte el CSV (en iPhone, la hoja de compartir). */
export async function exportWorkoutsCsv(workouts: WorkoutLog[]): Promise<boolean> {
  const name = `entrenos-apex-${new Date().toISOString().slice(0, 10)}.csv`;
  const file = new File([workoutsToCsv(workouts)], name, { type: 'text/csv' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Historial de entrenos' });
      return true;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}
