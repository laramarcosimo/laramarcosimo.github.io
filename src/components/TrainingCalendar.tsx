import { isVacationWeek } from '../lib/vacation';
import { CalendarDays, Download, Droplet, Dumbbell, Home, ChevronDown, ChevronLeft, ChevronRight, Flame, Plus, Trash2, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { byDay, currentDayStreak, dayLocation, locationOf, weekStart, weeklyStreak } from '../lib/streaks';
import type { Location, LogExercise, LogSet, WorkoutLog } from '../lib/types';
import { cx, dayKey, fmtDuration, uid } from '../lib/utils';
import { workoutKcal } from '../lib/metabolic';
import { formatSetsLine, logVolume, updateRecords } from '../lib/workout';
import { ExerciseImage } from './ExerciseImage';
import { ExercisePicker } from './ExercisePicker';
import { Modal, NumInput } from './ui';
import { archiveReport } from '../lib/reports';

const LOC_STYLE: Record<Location, string> = { gym: 'bg-accent text-white', home: 'bg-emerald-500 text-white' };
const LOC_LABEL: Record<Location, string> = { gym: 'Gimnasio', home: 'Casa' };
const LocIcon = ({ l, size = 12 }: { l: Location; size?: number }) => (l === 'gym' ? <Dumbbell size={size} strokeWidth={1.75} className="mr-1 inline" /> : <Home size={size} strokeWidth={1.75} className="mr-1 inline" />);
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_FMT = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });

export function TrainingCalendar() {
  const { state } = useStore();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const days = useMemo(() => byDay(state.workouts), [state.workouts]);
  const goal = state.settings.weeklyGoal;
  const [nowTs] = useState(() => Date.now());
  const todayKey = dayKey(nowTs);

  const dayStreak = currentDayStreak(days);
  const weekStreak = weeklyStreak(days, goal, undefined, (w) => isVacationWeek(state.settings, w));

  const monday = weekStart(nowTs);
  const weekRow = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return { label: DOW[i], key: dayKey(d.getTime()), loc: dayLocation(days.get(dayKey(d.getTime()))), num: d.getDate() };
  });

  // Cuadrícula del mes (lunes primero)
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const keyOf = (n: number) => dayKey(new Date(cursor.getFullYear(), cursor.getMonth(), n, 12).getTime());
  const monthCount = cells.filter((n) => n && days.has(keyOf(n))).length;

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="card !p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-3xl font-black text-orange-500"><Flame size={26} /> {dayStreak}</div>
          <div className="text-[11px] uppercase text-slate-400">Racha actual (días)</div>
        </div>
        <div className="card !p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-3xl font-black text-fuel"><CalendarDays size={24} strokeWidth={1.5} /> {weekStreak}</div>
          <div className="text-[11px] uppercase text-slate-400">Semanas ≥ {goal} días</div>
        </div>
      </div>

      <div className="card !p-3">
        <div className="grid grid-cols-7 gap-1.5">
          {weekRow.map((d) => (
            <button key={d.key} onClick={() => setSelected(d.key)} className="flex min-w-0 flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-slate-500">{d.label}</span>
              <span className={cx('flex aspect-square w-full max-w-[2.25rem] items-center justify-center rounded-full text-sm font-bold', d.loc ? LOC_STYLE[d.loc] : 'bg-slate-800 text-slate-400', d.key === todayKey && 'ring-2 ring-slate-400')}>{d.num}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-center gap-3 text-[11px] text-slate-400">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-accent" />Gimnasio</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Casa</span>
        </div>
      </div>

      <div className="card !p-3">
        <div className="mb-2 flex items-center justify-between">
          <button className="rounded-full bg-slate-800 p-2" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
          <div className="text-center">
            <div className="font-bold text-white">{MONTH_FMT.format(cursor).replace(/^./, (c) => c.toUpperCase())}</div>
            <div className="text-[11px] text-slate-400">{monthCount} días entrenados</div>
          </div>
          <button className="rounded-full bg-slate-800 p-2" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((n, i) => {
            if (!n) return <span key={i} />;
            const k = keyOf(n);
            const loc = dayLocation(days.get(k));
            return (
              <button key={i} onClick={() => setSelected(k)} className={cx('flex h-10 items-center justify-center rounded-xl text-sm font-semibold', loc ? LOC_STYLE[loc] : 'text-slate-300', k === todayKey && 'ring-2 ring-slate-400')}>
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <ReportButton year={cursor.getFullYear()} month={cursor.getMonth()} />

      {selected && <DayModal dayKeyStr={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function ReportButton({ year, month }: { year: number; month: number }) {
  const { state } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div>
      <button
        className="btn btn-ghost w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr('');
          try {
            const { downloadMonthlyReport } = await import('../lib/report');
            await downloadMonthlyReport(state, year, month, (f) => archiveReport(f, { kind: 'mes', year, month, label: `Informe de ${MONTH_FMT.format(new Date(year, month, 1))}` }));
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'No se pudo generar el PDF');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={16} strokeWidth={1.75} /> {busy ? 'Generando PDF…' : `Informe de ${MONTH_FMT.format(new Date(year, month, 1))} (PDF)`}
      </button>
      <button
        className="btn btn-ghost mt-2 w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr('');
          try {
            const { downloadYearlyReport } = await import('../lib/report');
            await downloadYearlyReport(state, year, (f) => archiveReport(f, { kind: 'anio', year, label: `Informe del año ${year}` }));
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'No se pudo generar el PDF');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={16} strokeWidth={1.75} /> {busy ? 'Generando PDF…' : `Informe del año ${year} (PDF)`}
      </button>
      {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
    </div>
  );
}

function DayModal({ dayKeyStr, onClose }: { dayKeyStr: string; onClose: () => void }) {
  const { state, removeWithUndo } = useStore();
  const [retro, setRetro] = useState(false);
  const [open, setOpen] = useState<string[]>([]);
  const list = state.workouts.filter((w) => dayKey(Date.parse(w.startTime)) === dayKeyStr).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  const [y, m, d] = dayKeyStr.split('-').map(Number);
  const title = new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  if (retro) return <RetroModal dayKeyStr={dayKeyStr} onClose={() => { setRetro(false); onClose(); }} />;

  return (
    <Modal title={title} onClose={onClose}>
      {list.length === 0 && <p className="mb-4 text-sm text-slate-400">Día de descanso. ¿Se te olvidó registrar algo?</p>}
      <div className="space-y-3">
        {list.map((w) => {
          const loc = locationOf(w);
          const isOpen = open.includes(w.id);
          return (
            <div key={w.id} className="rounded-xl bg-slate-800 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-white">{w.title}</div>
                  <span className={cx('mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold', LOC_STYLE[loc])}><LocIcon l={loc} />{LOC_LABEL[loc]}</span>
                  {w.isPeriodSession && <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-pink-500/15 px-2 py-0.5 text-[11px] font-bold text-pink-500"><Droplet size={11} strokeWidth={2} /> Periodo{w.periodAuto ? ' (auto)' : ''}</span>}
                </div>
                <button className="p-1 text-slate-500" aria-label="Borrar" onClick={() => confirm('¿Borrar este entrenamiento?') && removeWithUndo('Entrenamiento borrado', (s) => ({ ...s, workouts: s.workouts.filter((x) => x.id !== w.id) }))}><Trash2 size={16} /></button>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                {([['Duración', fmtDuration(w.durationSeconds)], ['Volumen', `${w.totalVolumeKg} kg`], ['Series', w.totalSets], ['Kcal', w.caloriesBurned]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-slate-900 py-1.5"><div className="text-sm font-bold text-white">{v}</div><div className="text-[9px] uppercase text-slate-400">{l}</div></div>
                ))}
              </div>
              {w.prsAchieved > 0 && <div className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-500"><Trophy size={12} /> {w.prsAchieved} PR</div>}
              <button className="mt-2 flex w-full items-center justify-between text-xs font-semibold text-accent" onClick={() => setOpen(isOpen ? open.filter((x) => x !== w.id) : [...open, w.id])}>
                Ejercicios ({w.exercises.length}) <ChevronDown size={14} className={isOpen ? 'rotate-180' : ''} />
              </button>
              {isOpen && (
                <div className="mt-2 space-y-2">
                  {w.exercises.map((e, i) => (
                    <div key={i} className="flex gap-2">
                      <ExerciseImage exerciseId={e.exerciseId} size={40} />
                      <div className="min-w-0 text-xs">
                        <div className="font-semibold text-slate-200">{e.name}</div>
                        <div className="text-slate-400">{formatSetsLine(e.sets)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="btn btn-blue mt-4 w-full" onClick={() => setRetro(true)}><Plus size={16} /> Registrar entreno retroactivo</button>
    </Modal>
  );
}

function RetroModal({ dayKeyStr, onClose }: { dayKeyStr: string; onClose: () => void }) {
  const { state, update } = useStore();
  const [title, setTitle] = useState('Entrenamiento');
  const [location, setLocation] = useState<Location>('gym');
  const [minutes, setMinutes] = useState(60);
  const [rows, setRows] = useState<{ exerciseId: string; sets: { weight: number; reps: number }[] }[]>([]);
  const [picker, setPicker] = useState(false);
  const nameOf = (id: string) => state.exercises.find((e) => e.id === id)?.name ?? 'Ejercicio';

  const save = () => {
    const [y, m, d] = dayKeyStr.split('-').map(Number);
    const start = new Date(y, m - 1, d, 18, 0).getTime();
    const durationSeconds = Math.max(60, Math.round(minutes * 60));
    const exercises: LogExercise[] = rows
      .map((r) => {
        const ex = state.exercises.find((e) => e.id === r.exerciseId);
        const sets: LogSet[] = r.sets.filter((s) => s.reps > 0).map((s) => ({ type: 'normal', weight: s.weight, reps: s.reps }));
        return { exerciseId: r.exerciseId, name: ex?.name ?? 'Ejercicio', muscleGroup: ex?.muscleGroup ?? 'Abdominales', sets };
      })
      .filter((e) => e.sets.length > 0);
    if (exercises.length === 0) return;
    const totalVolumeKg = logVolume(exercises);
    const log: WorkoutLog = {
      id: uid(),
      location,
      title: title.trim() || 'Entrenamiento',
      startTime: new Date(start).toISOString(),
      endTime: new Date(start + durationSeconds * 1000).toISOString(),
      durationSeconds,
      totalVolumeKg,
      totalSets: exercises.reduce((a, e) => a + e.sets.length, 0),
      prsAchieved: 0,
      caloriesBurned: workoutKcal(state.profile.weight, durationSeconds, exercises, (id) => state.exercises.find((e) => e.id === id)).total,
      exercises,
      source: 'app',
    };
    update((s) => ({
      ...s,
      workouts: [log, ...s.workouts].sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime)),
      exercises: location === 'gym' ? s.exercises.map((e) => { const done = exercises.filter((x) => x.exerciseId === e.id).flatMap((x) => x.sets); return done.length ? { ...e, personalRecords: updateRecords(e.personalRecords, done) } : e; }) : s.exercises,
    }));
    onClose();
  };

  return (
    <Modal title="Entreno retroactivo" onClose={onClose}>
      <div className="space-y-3">
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
        <div className="grid grid-cols-2 gap-2">
          {(['gym', 'home'] as const).map((l) => <button key={l} onClick={() => setLocation(l)} className={cx('btn !py-2', location === l ? 'btn-blue' : 'btn-ghost')}><LocIcon l={l} size={14} />{LOC_LABEL[l]}</button>)}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300">Duración <NumInput decimal={false} value={minutes} className="field !w-20 text-center" onChange={setMinutes} /> min</div>
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl bg-slate-800 p-2">
            <div className="mb-1 flex items-center justify-between text-sm font-semibold text-accent">{nameOf(r.exerciseId)}<button onClick={() => setRows(rows.filter((_, k) => k !== i))} className="text-slate-500"><Trash2 size={14} /></button></div>
            {r.sets.map((s, k) => (
              <div key={k} className="mb-1 grid grid-cols-[24px_1fr_1fr] items-center gap-1.5">
                <span className="text-center text-xs text-slate-500">{k + 1}</span>
                <NumInput value={s.weight} placeholder="kg" className="field !py-1.5 text-center" onChange={(n) => setRows(rows.map((x, a) => (a === i ? { ...x, sets: x.sets.map((y, b) => (b === k ? { ...y, weight: n } : y)) } : x)))} />
                <NumInput decimal={false} value={s.reps} placeholder="reps" className="field !py-1.5 text-center" onChange={(n) => setRows(rows.map((x, a) => (a === i ? { ...x, sets: x.sets.map((y, b) => (b === k ? { ...y, reps: n } : y)) } : x)))} />
              </div>
            ))}
            <button className="text-xs font-semibold text-accent" onClick={() => setRows(rows.map((x, a) => (a === i ? { ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? { weight: 0, reps: 0 }) }] } : x)))}>+ serie</button>
          </div>
        ))}
        <button className="btn btn-ghost w-full" onClick={() => setPicker(true)}><Plus size={16} /> Añadir ejercicios</button>
        <button className="btn btn-green w-full" disabled={rows.length === 0} onClick={save}>Guardar entreno</button>
      </div>
      {picker && <ExercisePicker onClose={() => setPicker(false)} onPick={(ids) => { setRows([...rows, ...ids.map((id) => ({ exerciseId: id, sets: [{ weight: 0, reps: 0 }, { weight: 0, reps: 0 }, { weight: 0, reps: 0 }] }))]); setPicker(false); }} />}
    </Modal>
  );
}

