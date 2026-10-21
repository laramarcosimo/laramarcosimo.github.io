import { Timer } from 'lucide-react';
import type { Exercise } from '../lib/types';
import { cx } from '../lib/utils';
import { NumInput } from './ui';

export interface Targets {
  restSec?: number;
  repMin?: number;
  repMax?: number;
  extras?: boolean;
  byTime?: boolean;
}

/** Ejercicios que por defecto registran también segundos (isométrico) y repeticiones cortas. */
export const defaultExtras = (exerciseId: string): boolean => /^hip-thrust/.test(exerciseId);

/** Abdominales (también los personalizados): se pueden medir por repeticiones o por segundos. */
export const isCore = (ex?: Exercise): boolean => ex?.muscleGroup === 'Abdominales';
export const byTimeOf = (v: { byTime?: boolean }, ex?: Exercise): boolean => isCore(ex) && (v.byTime ?? /plancha|plank|isom[eé]tric|hollow|mantener/i.test(ex?.name ?? ''));

/** Rango de reps escrito como las notas («10-12 reps»), para que la progresión lo lea sin cambios. */
export const rangeNotes = (e: { repMin?: number; repMax?: number; notes?: string }): string | undefined =>
  e.repMin && e.repMax ? `${Math.min(e.repMin, e.repMax)}-${Math.max(e.repMin, e.repMax)} reps ${e.notes ?? ''}`.trim() : e.notes;

const box = 'h-10 w-full rounded-lg bg-slate-800 text-center text-base font-semibold text-white outline-none focus:ring-1 focus:ring-accent';

/** Descanso y rango de repeticiones del ejercicio en dos recuadros, más el interruptor de segundos y reps cortas. */
export function ExerciseTargets({ value, exerciseId, exercise, onChange }: { value: Targets; exerciseId: string; exercise?: Exercise; onChange: (p: Partial<Targets>) => void }) {
  const core = isCore(exercise);
  const byTime = byTimeOf(value, exercise);
  const extras = !core && (value.extras ?? defaultExtras(exerciseId));
  return (
    <div className="mt-2 space-y-2">
      {core && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-800 p-1 text-xs font-bold" role="group" aria-label="Cómo se mide la serie">
          {([[false, 'Por repeticiones'], [true, 'Por segundos']] as const).map(([v, l]) => <button key={l} type="button" aria-pressed={byTime === v} onClick={() => onChange({ byTime: v })} className={cx('rounded-lg py-2', byTime === v ? 'bg-slate-950 text-white ring-1 ring-slate-600' : 'text-slate-400')}>{l}</button>)}
        </div>
      )}
      <div className={cx('grid gap-2', byTime ? 'grid-cols-1' : 'grid-cols-2')}>
        <div className="rounded-xl bg-slate-800/50 p-2">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400"><Timer size={11} /> Descanso (seg)</div>
          <NumInput decimal={false} label="Descanso en segundos" placeholder="Auto" value={value.restSec ?? 0} className={box} onChange={(n) => onChange({ restSec: n > 0 ? n : undefined })} />
        </div>
        {!byTime && <div className="rounded-xl bg-slate-800/50 p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Reps (de – a)</div>
          <div className="flex items-center gap-1">
            <NumInput decimal={false} label="Repeticiones mínimas" placeholder="8" value={value.repMin ?? 0} className={box} onChange={(n) => onChange({ repMin: n > 0 ? n : undefined })} />
            <span className="text-slate-500">–</span>
            <NumInput decimal={false} label="Repeticiones máximas" placeholder="12" value={value.repMax ?? 0} className={box} onChange={(n) => onChange({ repMax: n > 0 ? n : undefined })} />
          </div>
        </div>}
      </div>
      {!core && <button type="button" className={cx('w-full rounded-lg px-3 py-2 text-xs font-semibold', extras ? 'bg-accent/15 text-accent' : 'bg-slate-800 text-slate-400')} aria-pressed={extras} onClick={() => onChange({ extras: !extras })}>
        {extras ? '✓ ' : ''}Registrar también segundos y reps cortas
      </button>}
    </div>
  );
}
