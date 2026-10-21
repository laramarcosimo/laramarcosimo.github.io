import { ChevronDown, ChevronLeft, Copy, MoreVertical, Pencil, Share, Timer, Trash2 } from 'lucide-react';
import { useScrollLock } from '../lib/scrollLock';
import { isCardio } from '../lib/exercises';
import { analyzeProgression } from '../lib/progression';
import { deloadActive, weightStep } from '../lib/workout';
import { useState } from 'react';
import { autoRest, formatSetsLine } from '../lib/workout';
import { useStore } from '../lib/store';
import type { LogSet, RoutineTemplate, WorkoutLog } from '../lib/types';
import { cx, fmtKg } from '../lib/utils';
import { ExerciseImage } from './ExerciseImage';
import { rangeNotes } from './ExerciseTargets';

type Metric = 'vol' | 'reps' | 'dur';
const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'vol', label: 'Volumen', unit: 'kg' },
  { id: 'reps', label: 'Repeticiones', unit: 'reps' },
  { id: 'dur', label: 'Duración', unit: 'min' },
];
const RANGES: { id: number; label: string }[] = [
  { id: 1, label: 'Último mes' },
  { id: 3, label: 'Últimos 3 meses' },
  { id: 6, label: 'Últimos 6 meses' },
  { id: 0, label: 'Todo el historial' },
];

const fmtRest = (s: number): string => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`);
const dayShort = (iso: string): string => new Date(iso).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
const repsOf = (w: WorkoutLog): number => w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.type !== 'warmup').reduce((b, s) => b + s.reps, 0), 0);
const value = (w: WorkoutLog, m: Metric): number => (m === 'vol' ? w.totalVolumeKg : m === 'reps' ? repsOf(w) : Math.round(w.durationSeconds / 60));

/** Vista «Ver rutina» (estilo Hevy): comenzar, evolución histórica y los ejercicios con lo que hiciste la última vez. */
export function RoutineView({ tpl, onClose, onStart, onEdit, onDuplicate, onDelete, disabled }: { tpl: RoutineTemplate; onClose: () => void; onStart: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void; disabled?: boolean }) {
  useScrollLock();
  const { state } = useStore();
  const [metric, setMetric] = useState<Metric>('vol');
  const [range, setRange] = useState(3);
  const [menu, setMenu] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [nowTs] = useState(() => Date.now());

  const all = state.workouts.filter((w) => w.templateId === tpl.id || w.title === tpl.title).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  const logs = range === 0 ? all : all.filter((w) => Date.parse(w.startTime) >= nowTs - range * 30 * 86400000);
  const last = all[all.length - 1];
  const pts = logs.map((w) => value(w, metric));
  const shown = sel !== null && logs[sel] ? logs[sel] : logs[logs.length - 1];
  const unit = METRICS.find((m) => m.id === metric)!.unit;

  const W = 320;
  const H = 110;
  const pad = 12;
  const min = Math.min(...pts, 0);
  const max = Math.max(...pts, 1);
  const x = (i: number) => pad + (pts.length <= 1 ? (W - 2 * pad) / 2 : (i / (pts.length - 1)) * (W - 2 * pad));
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad);

  const lastEx = (id: string): LogSet[] | undefined => last?.exercises.find((e) => e.exerciseId === id)?.sets;
  const share = async () => {
    const text = `${tpl.title}\n${tpl.exercises.map((e) => `• ${state.exercises.find((x) => x.id === e.exerciseId)?.name ?? 'Ejercicio'} (${e.sets.length} series)`).join('\n')}`;
    try {
      if (navigator.share) await navigator.share({ title: tpl.title, text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* cancelado */
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950" role="dialog" aria-label={`Rutina ${tpl.title}`} onClick={() => setMenu(false)}>
      <div className="flex items-center justify-between px-3 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
        <button onClick={onClose} className="rounded-full p-2 text-accent active:scale-90" aria-label="Atrás"><ChevronLeft size={26} /></button>
        <h2 className="font-bold text-white">Rutina</h2>
        <div className="relative flex gap-0.5">
          <button onClick={() => void share()} className="rounded-full p-2 text-accent active:scale-90" aria-label="Compartir"><Share size={20} /></button>
          <button onClick={(e) => { e.stopPropagation(); setMenu(!menu); }} className="rounded-full p-2 text-accent active:scale-90" aria-label="Opciones"><MoreVertical size={20} /></button>
          {menu && (
            <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200" onClick={onEdit}><Pencil size={15} /> Editar rutina</button>
              <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200" onClick={onDuplicate}><Copy size={15} /> Duplicar</button>
              <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-red-400" onClick={onDelete}><Trash2 size={15} /> Eliminar</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-12">
        <h1 className="text-3xl font-extrabold text-white">{tpl.title}</h1>
        <p className="text-sm text-slate-400">Creada por ti</p>
        <button className="mt-4 w-full rounded-2xl py-3.5 text-base font-bold text-white shadow-lg active:scale-[0.99] disabled:opacity-50" style={{ background: '#007AFF' }} disabled={disabled} onClick={onStart}>Comenzar Rutina</button>
        {disabled && <p className="mt-1 text-center text-xs text-slate-500">Ya tienes un entreno en curso.</p>}

        <div className="mt-6">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-xs text-slate-400">{metric === 'vol' ? 'Volumen' : metric === 'reps' ? 'Repeticiones' : 'Duración'}</div>
              <div className="text-xl font-extrabold text-white">{shown ? `${fmtKg(value(shown, metric))} ${unit}` : '—'}{shown && <span className="ml-1.5 text-sm font-medium capitalize text-slate-400">· {dayShort(shown.startTime)}</span>}</div>
            </div>
            <label className="relative">
              <select className="appearance-none rounded-lg bg-slate-800 py-1.5 pl-3 pr-7 text-xs font-semibold text-accent" value={range} onChange={(e) => { setRange(Number(e.target.value)); setSel(null); }} aria-label="Rango">
                {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-accent" />
            </label>
          </div>

          {pts.length === 0 ? (
            <div className="mt-3 flex h-28 items-center justify-center rounded-xl bg-slate-900 text-sm text-slate-500">Aún no hay sesiones de esta rutina en este periodo.</div>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Evolución de la rutina">
              {pts.length > 1 && <polyline points={pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
              {pts.map((v, i) => (
                <g key={i} onClick={() => setSel(i)} className="cursor-pointer">
                  <circle cx={x(i)} cy={y(v)} r="14" fill="transparent" />
                  <circle cx={x(i)} cy={y(v)} r={shown === logs[i] ? 5.5 : 3.5} fill={shown === logs[i] ? '#007AFF' : '#fff'} stroke="#007AFF" strokeWidth="2" />
                </g>
              ))}
            </svg>
          )}

          <div className="mt-2 flex gap-2">
            {METRICS.map((m) => (
              <button key={m.id} onClick={() => { setMetric(m.id); setSel(null); }} className={cx('rounded-full px-3.5 py-1.5 text-xs font-semibold active:scale-95', metric === m.id ? 'text-white' : 'bg-slate-800 text-slate-300')} style={metric === m.id ? { background: '#007AFF' } : undefined}>{m.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-3 mt-7 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Ejercicios</h2>
          <button className="text-sm font-semibold text-accent" onClick={onEdit}>Editar Rutina</button>
        </div>
        <div className="space-y-3">
          {tpl.exercises.map((e, i) => {
            const ex = state.exercises.find((x) => x.id === e.exerciseId);
            const rest = e.restSec ?? autoRest(ex, 'normal', state.settings.restDefault);
            const done = lastEx(e.exerciseId);
            const rows = (done ?? e.sets).filter((s) => s.type !== 'warmup');
            return (
              <div key={i} className="card !p-3">
                <div className="flex items-center gap-3">
                  <ExerciseImage exerciseId={e.exerciseId} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[15px] font-bold leading-snug text-accent">{ex?.name ?? 'Ejercicio'}</div>
                    {(e.repMin && e.repMax) ? <div className="text-[11px] text-slate-500">{Math.min(e.repMin, e.repMax)}–{Math.max(e.repMin, e.repMax)} reps{e.notes ? ' · ' + e.notes : ''}</div> : e.notes && <div className="text-[11px] text-slate-500">{e.notes}</div>}
                    {(() => { const pg = analyzeProgression(state.workouts, e.exerciseId, ex?.name ?? 'Ejercicio', rangeNotes(e), weightStep(ex), tpl.id, deloadActive(state.settings.deloadUntil), ex?.equipment === 'Máquina'); return pg ? <div className={cx('mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold', pg.kind === 'raise' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500')}>{pg.kind === 'raise' ? `🚀 Toca subir a ${pg.weight} kg` : pg.kind === 'lower' ? `🛡️ Baja a ${pg.weight} kg` : '⚠️ Estancamiento detectado'}</div> : null; })()}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent"><Timer size={12} strokeWidth={1.75} /> Temporizador de Descanso: {fmtRest(rest)}</div>
                <div className="mt-2 grid grid-cols-[48px_1fr_1fr] gap-y-1 text-center text-sm">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Serie</span><span className="text-[10px] font-semibold uppercase text-slate-500">{isCardio(ex) ? 'Min' : 'Kg'}</span><span className="text-[10px] font-semibold uppercase text-slate-500">{isCardio(ex) ? 'Km' : 'Reps'}</span>
                  {rows.map((s, k) => (
                    <div key={k} className="contents">
                      <span className="rounded-md bg-slate-800 py-1 font-bold text-slate-300">{e.unilateral ? Math.floor(k / 2) + 1 : k + 1}{s.side ? <span className={cx('ml-0.5 text-[10px]', s.side === 'D' ? 'text-sky-400' : 'text-amber-500')}>{s.side}</span> : null}</span>
                      <span className="py-1 text-slate-200">{isCardio(ex) ? (s.min ? fmtKg(s.min) : '—') : s.weight ? fmtKg(s.weight) : '—'}</span>
                      <span className="py-1 text-slate-200">{isCardio(ex) ? (s.km ? fmtKg(s.km) : '—') : s.reps || (s.secs ? `${s.secs} s` : '—')}</span>
                    </div>
                  ))}
                </div>
                {done && <div className="mt-1 text-[10px] text-slate-500">Última vez: {formatSetsLine(done)}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
