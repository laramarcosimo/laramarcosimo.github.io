import { ChevronDown, History, Minus, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../lib/store';
import type { WorkoutLog } from '../lib/types';
import { cx, fmtDuration } from '../lib/utils';
import { formatSetsLine } from '../lib/workout';
import { ExerciseImage } from './ExerciseImage';

const when = (w: WorkoutLog) => new Date(w.startTime).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

const Delta = ({ now, before, unit, invert }: { now: number; before: number; unit: string; invert?: boolean }) => {
  const d = now - before;
  if (before <= 0 || d === 0) return <span className="inline-flex items-center gap-0.5 text-slate-400"><Minus size={11} /> igual</span>;
  const good = invert ? d < 0 : d > 0;
  const Icon = d > 0 ? TrendingUp : TrendingDown;
  return <span className={cx('inline-flex items-center gap-0.5 font-bold', good ? 'text-emerald-500' : 'text-amber-500')}><Icon size={11} /> {d > 0 ? '+' : ''}{unit === '%' ? Math.round((d / before) * 100) : d} {unit}</span>;
};

/** Historial de entrenos: series reales, tiempo, extras y comparación con la sesión anterior de la misma rutina. */
export function WorkoutHistory() {
  const { state } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const sorted = [...state.workouts].sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
  const list = more ? sorted.slice(0, 40) : sorted.slice(0, 6);
  const prevOf = (w: WorkoutLog): WorkoutLog | undefined => sorted.find((x) => Date.parse(x.startTime) < Date.parse(w.startTime) && (w.templateId ? x.templateId === w.templateId : x.title === w.title));

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2 font-bold text-white"><History size={18} strokeWidth={1.5} className="text-accent" /> Historial de entrenos</div>
      {sorted.length === 0 ? <p className="text-sm text-slate-500">Cuando guardes entrenos verás aquí cada sesión con sus series y la comparación con la anterior.</p> : (
        <div className="space-y-2">
          {list.map((w) => {
            const isOpen = open === w.id;
            const prev = prevOf(w);
            const extras = w.exercises.filter((e) => e.extra);
            return (
              <div key={w.id} className="rounded-xl bg-slate-800 p-3">
                <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen(isOpen ? null : w.id)} aria-expanded={isOpen}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-white">{w.title}</span>
                    <span className="block text-[11px] capitalize text-slate-400">{when(w)} · {fmtDuration(w.durationSeconds)} · {w.totalVolumeKg} kg · {w.totalSets} series</span>
                  </span>
                  <ChevronDown size={16} className={cx('shrink-0 text-slate-500 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <div className="mt-3 space-y-2.5">
                    {prev ? (
                      <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-slate-900 p-2 text-center text-[11px]">
                        <div><div className="text-[9px] uppercase text-slate-400">Volumen</div><Delta now={w.totalVolumeKg} before={prev.totalVolumeKg} unit="%" /></div>
                        <div><div className="text-[9px] uppercase text-slate-400">Series</div><Delta now={w.totalSets} before={prev.totalSets} unit="" /></div>
                        <div><div className="text-[9px] uppercase text-slate-400">Duración</div><Delta now={Math.round(w.durationSeconds / 60)} before={Math.round(prev.durationSeconds / 60)} unit="min" invert /></div>
                        <div className="col-span-3 text-[10px] text-slate-500">frente a la sesión anterior del {when(prev)}</div>
                      </div>
                    ) : <div className="text-[11px] text-slate-500">Primera vez que registras esta rutina: aún no hay con qué comparar.</div>}
                    {w.exercises.map((e, i) => (
                      <div key={i} className="flex gap-2">
                        <ExerciseImage exerciseId={e.exerciseId} size={40} />
                        <div className="min-w-0 text-xs">
                          <div className="flex flex-wrap items-center gap-1 font-semibold text-slate-200">{e.name}{e.extra && <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] font-bold uppercase text-emerald-500"><Plus size={9} /> Extra</span>}</div>
                          <div className="text-slate-400">{formatSetsLine(e.sets)}</div>
                        </div>
                      </div>
                    ))}
                    {extras.length > 0 && <div className="text-[11px] text-slate-500">{extras.length} ejercicio{extras.length === 1 ? '' : 's'} extra del día, sin cambiar la rutina.</div>}
                    {(w.skipped?.length ?? 0) > 0 && <div className="text-[11px] text-slate-500">Pospuestos: {w.skipped!.map((id) => state.exercises.find((x) => x.id === id)?.name ?? id).join(', ')}.</div>}
                  </div>
                )}
              </div>
            );
          })}
          {sorted.length > 6 && <button className="w-full text-center text-xs font-semibold text-accent" onClick={() => setMore(!more)}>{more ? 'Ver menos' : 'Ver más entrenos'}</button>}
        </div>
      )}
    </div>
  );
}
