import { Search, TrendingUp, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { epley, isCardio } from '../lib/exercises';
import { useStore } from '../lib/store';
import type { WorkoutLog } from '../lib/types';
import { cx, norm } from '../lib/utils';

interface Point {
  ts: number;
  e1rm: number;
  maxWeight: number;
  pr: boolean;
}

export const exerciseSeries = (workouts: WorkoutLog[], exerciseId: string): Point[] => {
  const pts: Point[] = [];
  let best = 0;
  for (const w of [...workouts].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))) {
    const e = w.exercises.find((x) => x.exerciseId === exerciseId);
    if (!e) continue;
    const sets = e.sets.filter((s) => s.type !== 'warmup' && s.weight > 0 && s.reps > 0);
    if (sets.length === 0) continue;
    const e1rm = Math.max(...sets.map((s) => epley(s.weight, s.reps)));
    const maxWeight = Math.max(...sets.map((s) => s.weight));
    pts.push({ ts: Date.parse(w.startTime), e1rm, maxWeight, pr: e1rm > best && best > 0 });
    best = Math.max(best, e1rm);
  }
  return pts;
};

/** Volumen (kg × reps) por semana de un ejercicio, últimas 12 semanas, con las semanas de récord marcadas. */
function WeeklyBars({ exerciseId }: { exerciseId: string }) {
  const { state } = useStore();
  const weeks = useMemo(() => {
    const monday = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
    const m = new Map<number, number>();
    for (const w of state.workouts) {
      const e = w.exercises.find((x) => x.exerciseId === exerciseId);
      if (!e) continue;
      const kg = e.sets.filter((s) => s.type !== 'warmup').reduce((a, s) => a + s.weight * s.reps, 0);
      if (kg > 0) { const k = monday(Date.parse(w.startTime)); m.set(k, (m.get(k) ?? 0) + kg); }
    }
    const keys = [...m.keys()].sort((a, b) => a - b);
    if (keys.length === 0) return [];
    const out: { ts: number; kg: number }[] = [];
    for (let t = Math.max(keys[0], keys[keys.length - 1] - 11 * 7 * 86400000); t <= keys[keys.length - 1]; t += 7 * 86400000) out.push({ ts: t, kg: Math.round(m.get(monday(t)) ?? 0) });
    return out;
  }, [state.workouts, exerciseId]);
  if (weeks.length === 0) return <p className="text-sm text-slate-500">Sin volumen registrado todavía.</p>;
  const max = Math.max(...weeks.map((w) => w.kg));
  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {weeks.map((w) => (
          <div key={w.ts} className="flex flex-1 flex-col items-center justify-end gap-0.5" style={{ height: '100%' }}>
            <span className="text-[8px] text-slate-400">{w.kg > 0 ? (w.kg >= 1000 ? (w.kg / 1000).toFixed(1) + 'k' : w.kg) : ''}</span>
            <div className={cx('w-full rounded-t', w.kg === max ? 'bg-amber-500' : w.kg > 0 ? 'bg-accent' : 'bg-slate-800')} style={{ height: `${Math.max(4, (w.kg / max) * 70)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{new Date(weeks[0].ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
        <span className="flex items-center gap-1"><Trophy size={10} className="text-amber-500" /> mejor semana</span>
        <span>{new Date(weeks[weeks.length - 1].ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  );
}

/** Gráfica de evolución de la carga (1RM estimado) de un ejercicio con sus récords marcados. */
/** Cardio: últimas sesiones con tiempo, distancia, ritmo y kcal. */
function CardioList({ exerciseId }: { exerciseId: string }) {
  const { state } = useStore();
  const rows = state.workouts
    .filter((w) => w.exercises.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))
    .slice(0, 8)
    .map((w) => { const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets); const min = sets.reduce((a, s) => a + (s.min ?? 0), 0); const km = sets.reduce((a, s) => a + (s.km ?? 0), 0); const kcal = sets.reduce((a, s) => a + (s.kcal ?? 0), 0); return { ts: Date.parse(w.startTime), min, km, kcal }; });
  if (rows.length === 0) return <p className="text-sm text-slate-500">Aún no hay sesiones registradas de este ejercicio.</p>;
  const maxKm = Math.max(0.1, ...rows.map((r) => r.km));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.ts} className="flex items-center gap-2 text-xs">
          <span className="w-14 shrink-0 text-slate-400">{new Date(r.ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-accent" style={{ width: `${(r.km / maxKm) * 100}%` }} /></div>
          <span className="w-36 shrink-0 text-right text-slate-200">{r.min} min · {Math.round(r.km * 100) / 100} km{r.kcal ? ` · ${r.kcal} kcal` : ''}</span>
        </div>
      ))}
    </div>
  );
}

export function ProgressChart({ exerciseId }: { exerciseId: string }) {
  const { state } = useStore();
  const cardio = isCardio(state.exercises.find((e) => e.id === exerciseId));
  const [mode, setMode] = useState<'carga' | 'volumen'>('carga');
  const all = useMemo(() => exerciseSeries(state.workouts, exerciseId), [state.workouts, exerciseId]);
  const pts = useMemo(() => all.slice(-20), [all]);
  if (cardio) return <CardioList exerciseId={exerciseId} />;
  if (pts.length === 0) return <p className="text-sm text-slate-500">Aún no hay series registradas de este ejercicio.</p>;

  const W = 300;
  const H = 120;
  const pad = 14;
  const vals = pts.map((p) => p.e1rm);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => pad + (pts.length === 1 ? (W - 2 * pad) / 2 : (i / (pts.length - 1)) * (W - 2 * pad));
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const line = pts.map((p, i) => `${x(i)},${y(p.e1rm)}`).join(' ');
  // Tendencia (regresión lineal sobre el 1RM estimado) y ritmo mensual.
  const n = pts.length;
  const mx = (n - 1) / 2;
  const my = vals.reduce((a, b) => a + b, 0) / n;
  const den = pts.reduce((a, _, i) => a + (i - mx) ** 2, 0);
  const slope = den ? pts.reduce((a, p, i) => a + (i - mx) * (p.e1rm - my), 0) / den : 0;
  const trendY = (i: number) => my + slope * (i - mx);
  const spanDays = (pts[n - 1].ts - pts[0].ts) / 86400000;
  const perMonth = n > 1 && spanDays > 0 ? Math.round(((slope * (n - 1)) / spanDays) * 30 * 10) / 10 : 0;
  const first = pts[0].e1rm;
  const last = pts[pts.length - 1].e1rm;
  const change = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex gap-1 rounded-xl bg-slate-800 p-1 text-xs font-semibold">
        {([['carga', 'Carga (1RM)'], ['volumen', 'Volumen semanal']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} className={cx('flex-1 rounded-lg py-1.5', mode === k ? 'bg-accent text-white' : 'text-slate-400')}>{l}</button>
        ))}
      </div>
      {mode === 'volumen' && <WeeklyBars exerciseId={exerciseId} />}
      <div className="mb-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-800 p-2"><div className="text-sm font-bold text-white">{last} kg</div><div className="text-[10px] uppercase text-slate-400">1RM est. actual</div></div>
        <div className="rounded-xl bg-slate-800 p-2"><div className="text-sm font-bold text-white">{Math.max(...pts.map((p) => p.maxWeight))} kg</div><div className="text-[10px] uppercase text-slate-400">Peso máx.</div></div>
        <div className="rounded-xl bg-slate-800 p-2"><div className={cx('text-sm font-bold', change >= 0 ? 'text-emerald-500' : 'text-amber-500')}>{change > 0 ? '+' : ''}{change}%</div><div className="text-[10px] uppercase text-slate-400">Desde el inicio</div></div>
      </div>
      {mode === 'carga' && <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolución del 1RM estimado">
        {n > 2 && <line x1={x(0)} y1={y(trendY(0))} x2={x(n - 1)} y2={y(trendY(n - 1))} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />}
        <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.e1rm)} r={p.pr ? 4.5 : 3} fill={p.pr ? '#f59e0b' : '#2563eb'} />
            {p.pr && <text x={x(i)} y={y(p.e1rm) - 8} fontSize="8" fontWeight="700" textAnchor="middle" fill="#f59e0b">PR</text>}
          </g>
        ))}
        <text x={pad} y={10} fontSize="9" fill="#94a3b8">{max} kg</text>
        <text x={pad} y={H - 2} fontSize="9" fill="#94a3b8">{min} kg</text>
      </svg>}
      {mode === 'carga' && n > 2 && <div className="mt-1 text-center text-[11px] text-slate-400">Tendencia (línea discontinua): <b className={perMonth >= 0 ? 'text-emerald-500' : 'text-amber-500'}>{perMonth > 0 ? '+' : ''}{perMonth} kg/mes</b> de 1RM estimado</div>}
      <div className={cx('mt-1 flex items-center justify-between text-[10px] text-slate-500', mode === 'volumen' && 'hidden')}>
        <span>{new Date(pts[0].ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
        <span className="flex items-center gap-1"><Trophy size={10} className="text-amber-500" /> récord</span>
        <span>{new Date(pts[pts.length - 1].ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  );
}

/** Tarjeta con selector de ejercicio (Entreno). */
export function ExerciseProgress() {
  const { state } = useStore();
  const withHistory = (() => {
    const ids = new Map<string, number>();
    for (const w of state.workouts) for (const e of w.exercises) ids.set(e.exerciseId, Math.max(ids.get(e.exerciseId) ?? 0, Date.parse(w.startTime)));
    return [...ids.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => state.exercises.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e);
  })();
  const [sel, setSel] = useState('');
  const [q, setQ] = useState('');
  const nq = norm(q);
  const filtered = nq ? withHistory.filter((e) => norm(`${e.name} ${e.muscleGroup}`).includes(nq)) : withHistory;
  const current = filtered.find((e) => e.id === sel)?.id ?? filtered[0]?.id;

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2 font-bold text-white"><TrendingUp size={18} strokeWidth={1.5} className="text-accent" /> Progreso por ejercicio</div>
      {withHistory.length === 0 ? (
        <p className="text-sm text-slate-500">Cuando registres entrenos verás aquí la evolución de tus cargas.</p>
      ) : (
        <>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="field !pl-9" placeholder="Busca un ejercicio…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ejercicio" />
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">Ningún ejercicio con historial coincide con «{q}».</p>
          ) : (
            <>
              <select className="field" value={current} onChange={(e) => setSel(e.target.value)} aria-label="Ejercicio">
                {filtered.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              {current && <ProgressChart exerciseId={current} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
