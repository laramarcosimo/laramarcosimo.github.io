import { Disc3, Layers, Check, ChevronDown, Droplet, Dumbbell, Flame, Home, Info, Lightbulb, Link2, Minus, MoreVertical, Video, Plus, PlayCircle, RefreshCw, Repeat, Sparkles, Split, Timer, Trash2, Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { vibrate } from '../lib/feedback';
import { useSoundAlert } from '../lib/useSoundAlert';
import { workoutKcal } from '../lib/metabolic';
import { useStore } from '../lib/store';
import type { ActiveWorkout, Exercise, LogExercise, Set as SetLog, SetType, WorkoutExercise, WorkoutLog } from '../lib/types';
import { cx, dayKey, fmtDuration, fmtKg, limbOf, num, sideLetter, sideName, uid } from '../lib/utils';
import { isPaired, normalizePairs, SET_BADGE, SET_LABEL, SET_TYPES, isPR, logVolume, newSet, autoRest, deloadActive, previousFor, roundOf, roundSets, suggestNext, supersetStatus, toggleUnilateral, updateRecords, withPrevious } from '../lib/workout';
import { ExerciseDetail } from './ExerciseDetail';
import { AltExercise } from './AltExercise';
import { FaceTimer } from './FaceTimer';
import { CardioBlock } from './CardioBlock';
import { PlateCalc } from './PlateCalc';
import { analyzeProgression, LOWER_TEXT, lowerTo, repRange, struggledSets } from '../lib/progression';
import { LiveCoachSheet } from './LiveCoachSheet';
import { isCardio } from '../lib/exercises';
import { flatKcal } from '../lib/cardio';
import { WarmupModal } from './WarmupModal';
import { TimeChips } from './TimeChips';
import { CompleteSession } from './CompleteSession';
import { FaceYogaNight } from './FaceYogaNight';
import { HIP_THRUST_ID, SoloHipThrust } from './SoloHipThrust';
import { fillPeriodGaps, perHandOf, volumeOf, weightStep } from '../lib/workout';
import { applyTimeMode, estimateMinutes, restFor, targetOf, type TimeMode } from '../lib/timeOptimizer';
import { TechniqueModal } from './TechniqueModal';
import { techniqueTips } from '../lib/techniques';
import { targetsFor } from '../lib/muscles';
import { VideoFormCheck } from './VideoFormCheck';
import { homeCap, liveTip, type Tip } from '../lib/liveCoach';
import { loadsJoint, recentJoints } from '../lib/joints';
import { ExerciseImage } from './ExerciseImage';
import { NotifyBanner } from './NotifyControl';
import { ExercisePicker } from './ExercisePicker';
import { ExerciseTargets, byTimeOf, defaultExtras, isCore, rangeNotes } from './ExerciseTargets';
import { BADGE_STYLE } from './RoutineEditor';
import { Modal, NumInput, Stat } from './ui';
import { useResume } from '../lib/resume';
import { Hint } from './Hint';

/** Cronómetro de la sesión con su propio temporizador: el resto del logger no se vuelve a pintar cada segundo. */
function Clock({ startedAt }: { startedAt: number }) {
  const [t, setT] = useState(() => Date.now());
  useResume(() => setT(Date.now()));
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  return <>{fmtClock(Math.floor((t - startedAt) / 1000))}</>;
}

const fmtRest = (s: number): string => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`);

const fmtClock = (sec: number): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':');
};

const toLogSets = (sets: SetLog[]) => sets.filter((s) => s.completed).map((s) => ({ side: s.side, type: s.type, weight: s.weight, reps: s.reps, rpe: s.rpe, ...(s.secs ? { secs: s.secs } : {}), ...(s.partials ? { partials: s.partials } : {}), ...(s.min !== undefined || s.km !== undefined ? { min: s.min, km: s.km, kcal: s.kcal } : {}) }));

export function Logger({ workout, onRest, onBack }: { workout: ActiveWorkout; onRest: (seconds?: number) => void; onBack: () => void }) {
  const { state, update } = useStore();
  const sound = useSoundAlert();
  const [coachOpen, setCoachOpen] = useState(false);
  const [plates, setPlates] = useState<{ weId: string; kg: number } | null>(null);
  const [unlockQ, setUnlockQ] = useState<string | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [picker, setPicker] = useState<{ replace: string | null } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [alt, setAlt] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState<string[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [warmup, setWarmup] = useState(false);
  const [soloFor, setSoloFor] = useState<string | null>(null);
  const [demoFor, setDemoFor] = useState<string | null>(null);
  const [tip, setTip] = useState<{ id: string; tip: Tip } | null>(null);
  const [rpeFor, setRpeFor] = useState<string | null>(null);
  const tipTimer = useRef<number>(0);
  const [menu, setMenu] = useState<string | null>(null);
  const [typeMenu, setTypeMenu] = useState<string | null>(null);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 15000); // el reloj en pantalla tiene su propio temporizador (Clock)
    return () => clearInterval(i);
  }, []);
  useResume(() => setNow(Date.now()));

  const patch = (fn: (w: ActiveWorkout) => ActiveWorkout) => update((s) => (s.active ? { ...s, active: fn(s.active) } : s));
  // Red de seguridad: un unilateral con series desparejadas se rehace en parejas I, D.
  useEffect(() => {
    if (workout.exercises.some((e) => e.unilateral && !isPaired(e.sets))) update((st) => (st.active ? { ...st, active: { ...st.active, exercises: st.active.exercises.map((e) => (e.unilateral ? { ...e, sets: normalizePairs(e.sets) } : e)) } } : st));
  }, [workout.exercises, update]);
  const patchEx = (id: string, fn: (e: WorkoutExercise) => WorkoutExercise) => patch((w) => ({ ...w, exercises: w.exercises.map((e) => (e.id === id ? fn(e) : e)) }));
  const patchSet = (exId: string, setId: string, p: Partial<SetLog>) => patchEx(exId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...p } : s)) }));
  const exOf = (id: string) => state.exercises.find((e) => e.id === id);
  const period = !!workout.isPeriodSession;
  /** Series con su referencia «Anterior» según el modo periodo (misma clase de sesión). */
  const wp = (sets: SetLog[], exerciseId: string, p: boolean = period): SetLog[] => {
    const r = previousFor(state.workouts, exerciseId, p, workout.templateId);
    return withPrevious(sets, r.sets, r.mark, !!exOf(exerciseId)?.timed);
  };
  /** Series iniciales: por tiempo (30 s) en los ejercicios de rostro y cuello. */
  const initialSets = (id: string): SetLog[] => (isCardio(exOf(id)) ? [newSet()] : exOf(id)?.timed ? (exOf(id)?.muscleGroup === 'Estiramientos' ? [newSet('normal', 0, 30), newSet('normal', 0, 30)] : [newSet('normal', 0, 30), newSet('normal', 0, 30), newSet('normal', 0, 30)]) : [newSet(), newSet(), newSet()]);
  const setPeriod = (v: boolean) => patch((w) => ({ ...w, isPeriodSession: v, exercises: w.exercises.map((e) => ({ ...e, sets: wp(e.sets, e.exerciseId, v) })) }));
  const liveKcal = useMemo(() => {
    const exs: LogExercise[] = workout.exercises.map((we) => {
      const ex = state.exercises.find((e) => e.id === we.exerciseId);
      return { exerciseId: we.exerciseId, name: ex?.name ?? '', muscleGroup: ex?.muscleGroup ?? 'Abdominales', sets: toLogSets(we.sets) };
    });
    return workoutKcal(state.profile.weight, Math.floor((now - workout.startedAt) / 1000), exs, (id) => state.exercises.find((e) => e.id === id)).total;
  }, [workout.exercises, workout.startedAt, now, state.exercises, state.profile.weight]);

  const showTip = (we: WorkoutExercise, set: { type: string; weight: number; reps: number; rpe?: number }) => {
    const loc = workout.location ?? 'gym';
    const base = state.settings.restDefault;
    const tip = liveTip({ ex: exOf(we.exerciseId), machine: exOf(we.exerciseId)?.equipment === 'Máquina', set, prev: previousFor(state.workouts, we.exerciseId, period, workout.templateId).sets, step: weightStep(exOf(we.exerciseId)), location: loc, period, cap: homeCap(exOf(we.exerciseId), loc, state.homeSpecs), restNow: restFor(we, exOf(we.exerciseId), base, state.settings.restAuto !== false, workout.restPlan === 'optimal') });
    window.clearTimeout(tipTimer.current);
    setTip(tip ? { id: we.id, tip } : null);
    if (tip) tipTimer.current = window.setTimeout(() => setTip(null), 20000);
  };
  const setRpe = (we: WorkoutExercise, s: SetLog, rpe: number) => {
    patchSet(we.id, s.id, { rpe });
    setRpeFor(null);
    showTip(we, { type: s.type, weight: s.weight, reps: s.reps, rpe });
  };

  const toggleDone = (we: WorkoutExercise, s: SetLog) => {
    sound.unlock();
    if (state.settings.restVibrate) vibrate(40);
    if (s.completed) { setRpeFor(null); return patchSet(we.id, s.id, { completed: false, pr: false, rpe: undefined }); }
    // Fila vacía: se rellena con la referencia anterior, como en Hevy.
    if (byTimeOf(we, exOf(we.exerciseId))) {
      const sw = s.weight || num(s.previous?.match(/^([\d.,]+) kg/)?.[1] ?? '0');
      const ss = s.secs || num(s.previous?.match(/(\d+) s$/)?.[1] ?? '0');
      return patchSet(we.id, s.id, { completed: true, weight: sw, secs: ss || undefined });
    }
    const m = s.previous?.match(/([\d.,]+) kg x (\d+)/);
    const mt = s.previous?.match(/^(\d+) s/);
    const weight = s.weight || (m ? num(m[1]) : 0);
    const reps = s.reps || (m ? num(m[2]) : mt ? num(mt[1]) : 0);
    const others = toLogSets(we.sets.filter((x) => x.id !== s.id));
    const pr = isPR(exOf(we.exerciseId), { type: s.type, weight, reps }, others, workout.location ?? 'gym');
    patchSet(we.id, s.id, { completed: true, weight, reps, pr });
    // Sin referencia de la última vez, las series siguientes del mismo ejercicio (y mismo lado) se rellenan con esta.
    if (weight > 0 && s.type !== 'warmup') patchEx(we.id, (e) => ({ ...e, sets: e.sets.map((x) => (x.id !== s.id && !x.completed && x.type !== 'warmup' && x.weight === 0 && x.reps === 0 && !x.previous && x.side === s.side ? { ...x, weight, reps } : x)) }));
    showTip(we, { type: s.type, weight, reps, rpe: s.rpe });
    setRpeFor(s.type === 'warmup' ? null : s.id);
    // Descanso: tras la ronda completa (pareja D/I y/o todos los ejercicios de la superserie).
    const done: WorkoutExercise = { ...we, sets: we.sets.map((x) => (x.id === s.id ? { ...x, completed: true } : x)) };
    const k = roundOf(done, s.id);
    const members = we.superset ? workout.exercises.map((e) => (e.id === we.id ? done : e)).filter((e) => e.superset === we.superset) : [done];
    const roundDone = s.type === 'warmup' || members.every((m) => roundSets(m, k).every((x) => x.completed));
    if (roundDone) {
      const base = state.settings.restDefault;
      onRest(s.type === 'warmup' ? autoRest(exOf(we.exerciseId), s.type, base) : restFor(we, exOf(we.exerciseId), base, state.settings.restAuto !== false, workout.restPlan === 'optimal'));
    }
  };

  const linkSuperset = (we: WorkoutExercise) => {
    const i = workout.exercises.findIndex((e) => e.id === we.id);
    const next = workout.exercises[i + 1];
    patch((w) => {
      if (we.superset) {
        const g = we.superset;
        const left = w.exercises.filter((e) => e.superset === g && e.id !== we.id);
        return { ...w, exercises: w.exercises.map((e) => (e.id === we.id || (left.length === 1 && e.superset === g) ? { ...e, superset: undefined } : e)) };
      }
      if (!next) return w;
      const g = next.superset ?? uid();
      return { ...w, exercises: w.exercises.map((e) => (e.id === we.id || e.id === next.id ? { ...e, superset: g } : e)) };
    });
  };
  const REST_CYCLE: (number | undefined)[] = [undefined, 60, 90, 120, 180, 240];
  const cycleRest = (we: WorkoutExercise) => patchEx(we.id, (e) => ({ ...e, restSec: REST_CYCLE[(REST_CYCLE.indexOf(e.restSec) + 1) % REST_CYCLE.length] }));

  const addSet = (we: WorkoutExercise) =>
    patchEx(we.id, (e) => {
      const last = e.sets[e.sets.length - 1];
      const t = last && last.type !== 'warmup' ? last.type : 'normal';
      const add = e.unilateral ? [{ ...newSet(t, last?.weight ?? 0, last?.reps ?? 0), side: 'I' as const }, { ...newSet(t, last?.weight ?? 0, last?.reps ?? 0), side: 'D' as const }] : [newSet(t, last?.weight ?? 0, last?.reps ?? 0)];
      return { ...e, sets: wp([...e.sets, ...add], e.exerciseId) };
    });

  const setType = (we: WorkoutExercise, setId: string, type: SetType) => {
    // En unilaterales el tipo se aplica a la pareja entera (I + D): un solo lado distinto rompería las parejas.
    patchEx(we.id, (e) => {
      const work = e.sets.filter((x) => x.type !== 'warmup');
      const wi = work.findIndex((x) => x.id === setId);
      const ids = new Set(e.unilateral && wi >= 0 && type !== 'warmup' ? [work[wi - (wi % 2)]?.id, work[wi - (wi % 2) + 1]?.id] : [setId]);
      const sets = e.sets.map((x) => (ids.has(x.id) ? { ...x, type } : x));
      return { ...e, sets: wp(e.unilateral ? normalizePairs(sets) : sets, e.exerciseId) };
    });
    setTypeMenu(null);
  };

  const elapsed = Math.floor((now - workout.startedAt) / 1000);
  const mode: TimeMode = workout.timeMode ?? 'std';
  const target = targetOf(mode);
  const estimate = estimateMinutes(workout.exercises, exOf, state.settings.restDefault, state.settings.restAuto !== false, workout.restPlan === 'optimal');
  const setMode = (m: TimeMode) => patch((w) => ({ ...w, timeMode: m, exercises: applyTimeMode(w.exercises, m, (id) => state.exercises.find((e) => e.id === id)) }));
  const skippedList = workout.exercises.filter((e) => e.skipped);
  const liveVolume = workout.exercises.reduce((a, e) => a + volumeOf(e.sets.filter((x) => x.completed), perHandOf(e, exOf(e.exerciseId))), 0);
  const liveSets = workout.exercises.reduce((a, e) => a + e.sets.filter((x) => x.completed && x.type !== 'warmup').length, 0);
  const plannedSets = workout.exercises.filter((e) => !e.skipped).reduce((a, e) => a + e.sets.filter((s) => s.type !== 'warmup').length, 0);
  const doneSets = workout.exercises.filter((e) => !e.skipped).reduce((a, e) => a + e.sets.filter((s) => s.type !== 'warmup' && s.completed).length, 0);

  // Memoria contextual: extras que añadiste la última vez a esta misma rutina (y que hoy aún no están).
  const lastLog = workout.templateId ? state.workouts.filter((w) => w.templateId === workout.templateId && w.exercises.some((e) => e.extra)).sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))[0] : undefined;
  const lastExtras = lastLog ? lastLog.exercises.filter((e) => e.extra && !workout.exercises.some((we) => we.exerciseId === e.exerciseId)) : [];
  const lastExtrasDay = lastLog ? new Date(lastLog.startTime).toLocaleDateString('es-ES', { weekday: 'long' }) : '';

  return (
    <div className="space-y-4 pb-28" onClick={() => { setMenu(null); }}>
      <div className="sticky z-30 -mx-4 border-b border-slate-800 bg-slate-950/95 px-4 pb-3 backdrop-blur" style={{ top: 'var(--nav-h, 0px)', paddingTop: 8 }}>
        <div className="flex items-center justify-between gap-2">
          <button onClick={onBack} aria-label="Contraer" className="-ml-2 rounded-full p-1.5 text-slate-300 active:scale-90"><ChevronDown size={26} /></button>
          <div className="flex min-w-0 items-center gap-1.5 truncate text-base font-bold text-white"><Timer size={16} strokeWidth={1.75} className="shrink-0 text-accent" /> Entreno</div>
          <div className="flex items-center gap-1">
            <button className="rounded-full bg-accent/15 p-2 text-accent active:scale-90" onClick={() => setCoachOpen(true)} aria-label="Preguntar al Coach"><Sparkles size={18} /></button>
            <button className="rounded-xl px-1.5 py-2 text-xs font-semibold text-red-400 active:scale-95" onClick={() => { if (confirm('¿Descartar este entrenamiento?')) { onRest(0); update((s) => ({ ...s, active: null })); } }}>Descartar</button>
            <button className="rounded-xl px-3 py-2 text-sm font-bold text-white active:scale-95" style={{ background: '#007AFF' }} onClick={() => { onRest(0); setFinishing(true); }}>Terminar</button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 divide-x divide-slate-800 text-center">
          <div><div className="text-[10px] font-semibold uppercase text-slate-400">Duración</div><div className="text-base font-bold tabular-nums text-accent"><Clock startedAt={workout.startedAt} /></div></div>
          <div><div className="text-[10px] font-semibold uppercase text-slate-400">Volumen</div><div className="text-base font-bold tabular-nums text-white">{fmtKg(liveVolume)} kg</div></div>
          <div><div className="text-[10px] font-semibold uppercase text-slate-400">Series</div><div className="text-base font-bold tabular-nums text-white">{liveSets}</div></div>
        </div>
        {target && (
          <div className="mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(target, Math.floor(elapsed / 60))} aria-label="Tiempo transcurrido respecto al objetivo">
            <div className="mb-0.5 flex justify-between text-[10px] font-semibold tabular-nums text-slate-400"><span>{Math.floor(elapsed / 60)} / {target} min</span>{elapsed / 60 > target && <span className="text-amber-500">Pasado del objetivo</span>}</div>
            <div className="h-1 overflow-hidden rounded-full bg-slate-800"><div className={cx('h-full rounded-full transition-all', elapsed / 60 > target ? 'bg-amber-500' : 'bg-accent')} style={{ width: `${Math.min(100, (elapsed / 60 / target) * 100)}%` }} /></div>
          </div>
        )}
      </div>

      <div>
        <input className="w-full bg-transparent text-2xl font-extrabold text-white outline-none" value={workout.title} onChange={(e) => patch((w) => ({ ...w, title: e.target.value }))} aria-label="Nombre del entreno" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-bold text-white', workout.location === 'home' ? 'bg-emerald-500' : 'bg-accent')}>{workout.location === 'home' ? <><Home size={12} strokeWidth={2} /> Casa</> : <><Dumbbell size={12} strokeWidth={2} /> Gym</>}</span>
          <button onClick={() => setPeriod(!period)} aria-pressed={period} className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold active:scale-95', period ? 'bg-pink-500 text-white' : 'bg-slate-800 text-slate-400')}>
            <Droplet size={13} strokeWidth={2} /> Modo periodo: {period ? 'activado' : 'desactivado'}
          </button>
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-3 py-1.5 text-xs font-bold tabular-nums text-orange-500" aria-label="Calorías quemadas"><Flame size={13} strokeWidth={2} /> {liveKcal} kcal</span>
        </div>
      </div>

      <NotifyBanner />
      {deloadActive(state.settings.deloadUntil) && <div className="rounded-xl bg-violet-500/15 px-3 py-2 text-xs text-violet-300"><b>Semana de descarga:</b> series reducidas y carga sugerida −10 %. Sin llegar al fallo.</div>}

      {!workout.exercises.some((e) => e.sets.some((s) => s.completed)) && workout.exercises.length > 0 && (
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-500/40 bg-orange-500/10 py-3 text-sm font-bold text-orange-500 active:scale-[0.99]" onClick={() => setWarmup(true)}><Flame size={18} strokeWidth={1.75} /> Sugerir calentamiento para esta rutina</button>
      )}
      {workout.exercises.length > 0 && !workout.exercises.some((e) => e.sets.some((x) => x.completed)) && <TimeChips mode={mode} minutes={estimate} onPick={setMode} optimalRest={workout.restPlan === 'optimal'} onToggleRest={() => patch((w) => ({ ...w, restPlan: w.restPlan === 'optimal' ? undefined : 'optimal' }))} />}

      {workout.exercises.map((we) => {
        const ex = exOf(we.exerciseId);
        if (we.skipped)
          return (
            <div key={we.id} className="card flex items-center gap-3 !p-3 opacity-80">
              <ExerciseImage exerciseId={we.exerciseId} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-slate-300">{ex?.name ?? 'Ejercicio'}</div>
                <span className="mt-0.5 inline-block rounded-md bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-300">Opcional / Omitido</span>
              </div>
              <button className="btn btn-ghost shrink-0 !px-3 !py-1.5 text-xs" onClick={() => patchEx(we.id, (e) => ({ ...e, skipped: undefined }))}><Plus size={14} /> Recuperar</button>
            </div>
          );
        let n = 0;
        const ss = we.superset ? supersetStatus(workout.exercises.filter((e) => e.superset === we.superset), we.id) : null;
        const nextSet = we.unilateral ? we.sets.find((x) => x.type !== 'warmup' && !x.completed) : undefined;
        const hurting = loadsJoint(ex?.name ?? '', recentJoints(state.discomfort));
        return (
          <div key={we.id} className={cx('card !p-3', we.superset && 'border-l-4 !border-l-accent')}>
            <div className="flex items-center gap-3">
              <button onClick={() => setDetail(we.exerciseId)} aria-label="Ver ejercicio" className="shrink-0"><ExerciseImage exerciseId={we.exerciseId} size={60} /></button>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[15px] font-bold leading-snug text-accent">{ex?.name ?? 'Ejercicio'}</div>
                <div className="mt-0.5 text-xs text-slate-500">{ex?.muscleGroup} · {ex?.equipment}</div>
              </div>
              <div className="relative">
                <button className="p-2 text-slate-500" onClick={(e) => { e.stopPropagation(); setMenu(menu === we.id ? null : we.id); }} aria-label="Menú"><MoreVertical size={18} /></button>
                {menu === we.id && (
                  <div className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200" onClick={() => { setMenu(null); setPicker({ replace: we.id }); }}><Repeat size={15} /> Reemplazar</button>
                    <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200" onClick={() => { setMenu(null); patchEx(we.id, (e) => toggleUnilateral(e)); }}><Split size={15} /> {we.unilateral ? 'Quitar una pierna' : 'Una pierna (D / I)'}</button>
                    <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200 disabled:opacity-40" disabled={!we.superset && workout.exercises.findIndex((e) => e.id === we.id) === workout.exercises.length - 1} onClick={() => { setMenu(null); linkSuperset(we); }}><Link2 size={15} /> {we.superset ? 'Quitar superserie' : 'Superserie con el siguiente'}</button>
                    <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200" onClick={() => cycleRest(we)}><Timer size={15} /> Descanso: {we.restSec ? `${we.restSec} s` : 'auto'}</button>
                    <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-red-400" onClick={() => { setMenu(null); patch((w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== we.id) })); }}><Trash2 size={15} /> Eliminar</button>
                  </div>
                )}
              </div>
            </div>
            {(ss || we.unilateral || hurting || we.extra) && (
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold uppercase">
                {ss && <span className={cx('rounded-md px-1.5 py-0.5', ss.done ? 'bg-slate-700 text-slate-400' : ss.next ? 'bg-emerald-500 text-white' : 'bg-accent/20 text-accent')}>Superserie · {ss.done ? 'completada' : `ronda ${ss.round}/${ss.rounds}${ss.next ? ' · te toca' : ''}`}</span>}
                {we.extra && <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-emerald-500">Extra de hoy</span>}
                {we.unilateral && <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-amber-500"><span className="uppercase">{limbOf(ex?.muscleGroup) === 'pierna' ? 'Una pierna' : 'Un brazo'}</span></span>}
                {we.unilateral && nextSet?.side && <span className="rounded-md bg-accent px-1.5 py-0.5 text-white">Toca {limbOf(ex?.muscleGroup) === 'pierna' ? (nextSet.side === 'D' ? 'pierna derecha (D)' : 'pierna izquierda (I)') : (nextSet.side === 'D' ? 'brazo derecho (D)' : 'brazo izquierdo (I)')}</span>}
                {hurting && <button className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-red-400" onClick={() => setAlt(we.id)}>Molestia: {hurting.toLowerCase()} · cambiar</button>}
              </div>
            )}
            {we.exerciseId === HIP_THRUST_ID && (
              <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-accent active:scale-95" onClick={() => setSoloFor(we.id)}><RefreshCw size={14} strokeWidth={1.75} /> Si entreno sola</button>
            )}
            {['hip-thrust-machine', 'hip-thrust-smith', 'hip-thrust-single'].includes(we.exerciseId) && (
              <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 active:scale-95" onClick={() => patchEx(we.id, (e) => { const back = { ...e, exerciseId: HIP_THRUST_ID, unilateral: undefined, sets: e.sets.filter((x) => x.side !== 'I').map((x) => ({ ...x, side: undefined, completed: false, pr: false })) }; return { ...back, sets: wp(back.sets, HIP_THRUST_ID) }; })}><RefreshCw size={14} strokeWidth={1.75} /> Volver al Hip Thrust</button>
            )}
            <ExerciseTargets exerciseId={we.exerciseId} exercise={ex} value={we} onChange={(p) => patchEx(we.id, (x) => (p.byTime === undefined || p.byTime === byTimeOf(x, ex) ? { ...x, ...p } : { ...x, ...p, sets: x.sets.map((q) => (q.completed ? q : p.byTime ? { ...q, secs: q.reps || q.secs, reps: 0 } : { ...q, reps: q.secs || q.reps, secs: undefined })) }))} />
            <div className="mt-2 flex items-center gap-2">
              <input className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-2 text-xs text-slate-400 outline-none placeholder:text-slate-500" placeholder="Agregar notas aquí..." value={we.notes ?? ''} onChange={(e) => patchEx(we.id, (x) => ({ ...x, notes: e.target.value }))} aria-label="Notas del ejercicio" />
              <div className="flex shrink-0 gap-1.5">
                {ex?.instructions && <button className={cx('flex h-9 w-9 items-center justify-center rounded-lg active:scale-95', howOpen.includes(we.id) ? 'bg-accent text-white' : 'bg-slate-800 text-slate-300')} onClick={() => setHowOpen((l) => (l.includes(we.id) ? l.filter((x) => x !== we.id) : [...l, we.id]))} aria-label="Cómo hacerlo" title="Cómo hacerlo"><Info size={17} /></button>}
                <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 active:scale-95" onClick={() => setDemoFor(we.exerciseId)} aria-label="Ver técnica" title="Ver técnica"><PlayCircle size={17} /></button>
                <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 active:scale-95" onClick={() => setVideo(we.id)} aria-label="Revisar técnica con vídeo" title="Revisar técnica con vídeo"><Video size={17} /></button>
                <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-accent active:scale-95" onClick={() => setAlt(we.id)} aria-label="Pedir alternativa al Coach" title="Pedir alternativa al Coach"><Sparkles size={17} /></button>
              </div>
            </div>
            {we.unilateral && <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-500">{limbOf(ex?.muscleGroup) === 'pierna' ? 'Empieza con la pierna izquierda para marcar el número de repeticiones objetivo y luego iguala con la derecha.' : 'Empieza con el brazo izquierdo para marcar el número de repeticiones objetivo y luego iguala con el derecho.'}</p>}
            {tip?.id === we.id && (
              <button className="mt-2 flex w-full items-start gap-2 rounded-lg bg-amber-500/15 px-3 py-2 text-left text-xs text-amber-500" onClick={() => setTip(null)}>
                <Lightbulb size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" /> <span>{tip.tip.text}</span>
              </button>
            )}
            {tip?.id === we.id && tip.tip.restTo !== undefined && (
              <button className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-accent active:scale-95" onClick={() => { patchEx(we.id, (e) => ({ ...e, restSec: tip.tip.restTo })); setTip(null); }}>Aplicar descanso de {tip.tip.restTo} s a este ejercicio</button>
            )}
            {ex?.equipment === 'Barra' && !ex.timed && <button className="mt-1 flex items-center gap-1 px-1 text-xs font-semibold text-accent" onClick={() => setPlates({ weId: we.id, kg: we.sets.find((s) => s.type !== 'warmup' && s.weight > 0)?.weight ?? (num(we.sets.find((s) => s.type !== 'warmup')?.previous?.match(/^([\d.,]+) kg/)?.[1] ?? '0') || 0) })} aria-label="Calculadora de discos"><Disc3 size={12} strokeWidth={1.75} /> Calculadora de discos</button>}
            {ex?.equipment === 'Máquina' && !ex.timed && (() => {
              const setStep = (n: number) => update((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === ex.id ? { ...e, stackStep: Math.min(25, Math.max(0.25, Math.round(n * 100) / 100)) } : e)) }));
              const cur = weightStep(ex);
              return (
                <div className="mt-1 flex items-center gap-1.5 px-1 text-xs font-semibold text-accent">
                  <Layers size={12} strokeWidth={1.75} /> <span>Escalón de la máquina:</span>
                  <button className="rounded-lg bg-slate-700 p-1.5 text-slate-200 active:scale-95" onClick={() => setStep(cur - 0.25)} aria-label="Menos escalón"><Minus size={12} /></button>
                  <NumInput value={cur} label="Escalón de la máquina (kg)" className="field !w-16 !px-1 !py-1 text-center text-xs" onChange={(n) => { if (n > 0) setStep(n); }} />
                  <button className="rounded-lg bg-slate-700 p-1.5 text-slate-200 active:scale-95" onClick={() => setStep(cur + 0.25)} aria-label="Más escalón"><Plus size={12} /></button>
                  <span className="text-slate-400">kg</span>
                </div>
              );
            })()}
            {!ex?.timed && !isCardio(ex) && <button className="mt-1 flex items-center gap-1 px-1 text-xs font-semibold text-accent" onClick={() => cycleRest(we)} aria-label="Cambiar descanso"><Timer size={12} strokeWidth={1.75} /> Descanso: {fmtRest(restFor(we, ex, state.settings.restDefault, state.settings.restAuto !== false, workout.restPlan === 'optimal'))}</button>}
            {ex?.instructions && howOpen.includes(we.id) && <p className="mt-2 rounded-lg bg-slate-800/60 p-2.5 text-xs leading-relaxed text-slate-300">{ex.instructions}</p>}

            {isCardio(ex) ? (
              <CardioBlock
                sets={we.sets}
                onPatch={(id, p) => patchSet(we.id, id, p)}
                onAdd={() => patchEx(we.id, (e) => ({ ...e, sets: [...e.sets, newSet()] }))}
                onRemoveLast={() => patchEx(we.id, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}
                onApplyScan={(r) => patchEx(we.id, (e) => {
                  const idx = e.sets.findIndex((x) => !x.completed);
                  const filled = { min: r.min, km: r.km, kcal: r.kcal, completed: true };
                  return idx >= 0 ? { ...e, sets: e.sets.map((x, i) => (i === idx ? { ...x, ...filled } : x)) } : { ...e, sets: [...e.sets, { ...newSet(), ...filled }] };
                })}
              />
            ) : ex?.timed ? (
              <FaceTimer
                ex={ex}
                sets={we.sets}
                restSec={we.restSec ?? 15}
                soundDone={sound.done}
                soundTick={sound.tick}
                soundUnlock={sound.unlock}
                onSetDone={(setId, seconds) => patchSet(we.id, setId, { completed: true, reps: seconds, weight: 0 })}
                onSetSeconds={(setId, seconds) => patchSet(we.id, setId, { reps: seconds })}
                onAddSet={() => addSet(we)}
                onRemoveLast={() => patchEx(we.id, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}
                onRest={(sec) => onRest(sec)}
              />
            ) : (
              <>
            {(() => {
              const tplNotes = workout.templateId ? state.templates.find((t) => t.id === workout.templateId)?.exercises.find((x) => x.exerciseId === we.exerciseId)?.notes : undefined;
              const pg = analyzeProgression(state.workouts, we.exerciseId, ex?.name ?? 'Ejercicio', rangeNotes({ repMin: we.repMin, repMax: we.repMax, notes: we.notes || tplNotes }), weightStep(ex), workout.templateId, deloadActive(state.settings.deloadUntil), ex?.equipment === 'Máquina');
              if (!pg || we.sets.some((x) => x.completed)) return null;
              const empty = we.sets.filter((s) => s.type !== 'warmup' && !s.completed && s.weight === 0 && s.reps === 0);
              if (pg.kind === 'lower') return (
                <div className="mt-2 rounded-xl bg-sky-500/15 p-3 text-xs text-sky-300">
                  <div className="font-semibold">{pg.text}</div>
                  {empty.length > 0 && <button className="mt-2 w-full rounded-lg bg-sky-500 py-2 text-xs font-bold text-white active:scale-95" onClick={() => patchEx(we.id, (e) => ({ ...e, sets: e.sets.map((s) => (s.type !== 'warmup' && !s.completed && s.weight === 0 && s.reps === 0 ? { ...s, weight: pg.weight!, reps: pg.reps! } : s)) }))}>Empezar con {pg.weight} kg × {pg.reps}</button>}
                </div>
              );
              return pg.kind === 'raise' ? (
                <div className="mt-2 rounded-xl bg-emerald-500/15 p-3 text-xs text-emerald-500">
                  <div className="font-semibold">{pg.text}</div>
                  {empty.length > 0 && <button className="mt-2 w-full rounded-lg bg-emerald-500 py-2 text-xs font-bold text-white active:scale-95" onClick={() => patchEx(we.id, (e) => ({ ...e, sets: e.sets.map((s) => (s.type !== 'warmup' && !s.completed && s.weight === 0 && s.reps === 0 ? { ...s, weight: pg.weight!, reps: pg.reps! } : s)) }))}>Rellenar con {pg.weight} kg × {pg.reps}</button>}
                </div>
              ) : (
                <div className="mt-2 rounded-xl bg-amber-500/15 p-3 text-xs text-amber-500">
                  <div className="font-semibold">{pg.text}</div>
                  <button className="mt-2 w-full rounded-lg bg-amber-500 py-2 text-xs font-bold text-slate-950 active:scale-95" onClick={() => { setUnlockQ(`Plan de desbloqueo con el Coach para ${ex?.name ?? 'este ejercicio'}. Estancamiento detectado. ${pg.history} Analiza el caso y dame una estrategia concreta con las 3 opciones.`); setCoachOpen(true); }}>💡 Plan de desbloqueo con el Coach</button>
                </div>
              );
            })()}
            {(() => {
              const sg = suggestNext(state.workouts, we.exerciseId, period, ['Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos'].includes(ex?.muscleGroup ?? ''), deloadActive(state.settings.deloadUntil), homeCap(ex, workout.location ?? 'gym', state.homeSpecs), weightStep(ex), workout.templateId);
              const empty = we.sets.filter((s) => s.type !== 'warmup' && !s.completed && s.weight === 0 && s.reps === 0);
              if (!sg || empty.length === 0) return null;
              const pk = analyzeProgression(state.workouts, we.exerciseId, ex?.name ?? 'Ejercicio', we.notes, weightStep(ex), workout.templateId, deloadActive(state.settings.deloadUntil))?.kind;
              if (pk === 'raise' || pk === 'lower') return null;
              return (
                <button className="mt-2 flex w-full items-center justify-between rounded-lg bg-accent/15 px-3 py-2 text-xs font-semibold text-accent active:scale-95" onClick={() => patchEx(we.id, (e) => ({ ...e, sets: e.sets.map((s) => (s.type !== 'warmup' && !s.completed && s.weight === 0 && s.reps === 0 ? { ...s, weight: sg.weight, reps: sg.reps } : s)) }))}>
                  <span>{sg.text}</span><span>Aplicar</span>
                </button>
              );
            })()}
            {(() => {
              // Durante la sesión: si las series ya hechas no se sostuvieron (menos reps que el mínimo o «al límite»), se sugiere bajar para las que faltan.
              const tplNotes = workout.templateId ? state.templates.find((t) => t.id === workout.templateId)?.exercises.find((x) => x.exerciseId === we.exerciseId)?.notes : undefined;
              const [lo] = repRange(rangeNotes({ repMin: we.repMin, repMax: we.repMax, notes: we.notes || tplNotes }));
              const doneSets = we.sets.filter((x) => x.completed && x.type !== 'warmup');
              const bad = struggledSets(doneSets, lo);
              const remaining = we.sets.filter((s) => s.type !== 'warmup' && !s.completed);
              if (bad.length === 0 || remaining.length === 0 || deloadActive(state.settings.deloadUntil)) return null;
              const target = lowerTo(Math.max(...bad.map((s) => s.weight)), weightStep(ex), ex?.equipment === 'Máquina');
              return (
                <div className="mt-2 rounded-xl bg-sky-500/15 p-3 text-xs text-sky-300">
                  <div className="font-semibold">{LOWER_TEXT}</div>
                  <button className="mt-2 w-full rounded-lg bg-sky-500 py-2 text-xs font-bold text-white active:scale-95" onClick={() => patchEx(we.id, (e) => ({ ...e, sets: e.sets.map((s) => (s.type !== 'warmup' && !s.completed ? { ...s, weight: target } : s)) }))}>Poner {target} kg en las {remaining.length} serie{remaining.length === 1 ? '' : 's'} que faltan</button>
                </div>
              );
            })()}
            {ex?.equipment === 'Mancuernas' && (
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-800 p-1 text-xs font-bold" role="group" aria-label="El peso es por mancuerna o total">
                {([[true, 'Por mancuerna'], [false, 'Peso total combinado']] as const).map(([v, label]) => (
                  <button key={label} aria-pressed={perHandOf(we, ex) === v} onClick={() => patchEx(we.id, (x) => ({ ...x, perHand: v }))} className={cx('rounded-lg py-2', perHandOf(we, ex) === v ? 'bg-slate-950 text-white ring-1 ring-slate-600' : 'text-slate-400')}>{label}</button>
                ))}
              </div>
            )}
            <div className={`mt-3 grid ${(!isCore(ex) && (we.extras ?? defaultExtras(we.exerciseId))) ? 'grid-cols-[32px_1fr_1fr_1fr_1fr_38px]' : 'grid-cols-[38px_1fr_62px_54px_42px]'} items-center gap-1.5 px-1 pb-1 text-[10px] font-semibold uppercase text-slate-500`}>
              <span className="text-center">Set</span>{!(!isCore(ex) && (we.extras ?? defaultExtras(we.exerciseId))) && <span className="text-center">Anterior</span>}<span className="text-center">{ex?.timed ? '' : 'kg'}</span><span className="text-center">{ex?.timed || byTimeOf(we, ex) ? 'Seg' : 'Reps'}</span>{(!isCore(ex) && (we.extras ?? defaultExtras(we.exerciseId))) && <><span className="text-center">Seg</span><span className="text-center">Cortas</span></>}<span className="flex justify-center"><Check size={12} strokeWidth={2} /></span>
            </div>
            {we.sets.map((s) => {
              if (s.type !== 'warmup' && s.side !== 'D') n++;
              return (
                <div key={s.id}>
                  {we.unilateral && s.type !== 'warmup' && s.side === 'I' && <div className="mb-0.5 mt-1 pl-1 text-[10px] font-semibold text-slate-400">Serie {n} · {sideName('I', limbOf(ex?.muscleGroup))} → {sideName('D', limbOf(ex?.muscleGroup))}</div>}
                  <div className={cx('grid items-center gap-1.5 rounded-lg p-1', (!isCore(ex) && (we.extras ?? defaultExtras(we.exerciseId))) ? 'grid-cols-[32px_1fr_1fr_1fr_1fr_38px]' : 'grid-cols-[38px_1fr_62px_54px_42px]', we.unilateral && s.side === 'I' ? 'mb-0.5' : 'mb-1.5', s.completed && 'bg-emerald-500/15')}>
                    <button className={cx('h-9 rounded-md text-sm font-bold', BADGE_STYLE[s.type])} onClick={() => setTypeMenu(typeMenu === s.id ? null : s.id)} aria-label="Tipo de serie">
                      {s.type === 'normal' ? n : SET_BADGE[s.type]}{s.side && <span className={cx('ml-0.5 text-[10px]', s.side === 'D' ? 'text-sky-400' : 'text-amber-500')}>{sideLetter(s.side)}</span>}
                    </button>
                    {!(!isCore(ex) && (we.extras ?? defaultExtras(we.exerciseId))) && <button className="truncate text-center text-xs text-slate-500" onClick={() => { const m = s.previous?.match(/([\d.,]+) kg x (\d+)/); const mt = s.previous?.match(/^(\d+) s/); const ms = s.previous?.match(/(\d+) s$/); if (byTimeOf(we, ex) && ms) patchSet(we.id, s.id, { weight: num(s.previous?.match(/^([\d.,]+) kg/)?.[1] ?? '0'), secs: num(ms[1]) }); else if (m) patchSet(we.id, s.id, { weight: num(m[1]), reps: num(m[2]) }); else if (mt) patchSet(we.id, s.id, { reps: num(mt[1]) }); }}>{s.previous ?? '–'}</button>}
                    {ex?.timed ? <span className="text-center text-slate-600">–</span> : <div className="min-w-0"><NumInput value={s.weight} placeholder={s.previous?.match(/^([\d.,]+) kg/)?.[1] ?? '0.0'} className="h-9 w-full rounded-md bg-slate-800 text-center text-base font-semibold text-white outline-none focus:ring-1 focus:ring-accent" onChange={(v) => patchSet(we.id, s.id, { weight: v })} />{perHandOf(we, ex) && s.weight > 0 && <div className="text-center text-[10px] leading-tight text-slate-400">Total {fmtKg(s.weight * 2)} kg</div>}</div>}
                    {byTimeOf(we, ex) ? <NumInput decimal={false} value={s.secs ?? 0} placeholder={s.previous?.match(/(\d+) s$/)?.[1] ?? 'seg'} className="h-9 w-full rounded-md bg-slate-800 text-center text-base font-semibold text-white outline-none focus:ring-1 focus:ring-accent" onChange={(v) => patchSet(we.id, s.id, { secs: v > 0 ? v : undefined })} /> : <NumInput decimal={false} value={s.reps} placeholder={s.previous?.match(/x (\d+)/)?.[1] ?? s.previous?.match(/^(\d+) s/)?.[1]} className="h-9 w-full rounded-md bg-slate-800 text-center text-base font-semibold text-white outline-none focus:ring-1 focus:ring-accent" onChange={(v) => patchSet(we.id, s.id, { reps: v })} />}
                    {(!isCore(ex) && (we.extras ?? defaultExtras(we.exerciseId))) && <>
                      <NumInput decimal={false} label="Segundos de mantenimiento" placeholder="Seg" value={s.secs ?? 0} className="h-9 w-full rounded-md bg-slate-800 text-center text-base font-semibold text-white outline-none focus:ring-1 focus:ring-accent" onChange={(v) => patchSet(we.id, s.id, { secs: v > 0 ? v : undefined })} />
                      <NumInput decimal={false} label="Repeticiones cortas" placeholder="Cortas" value={s.partials ?? 0} className="h-9 w-full rounded-md bg-slate-800 text-center text-base font-semibold text-white outline-none focus:ring-1 focus:ring-accent" onChange={(v) => patchSet(we.id, s.id, { partials: v > 0 ? v : undefined })} />
                    </>}
                    <button className={cx('flex h-9 items-center justify-center rounded-md', s.completed ? 'bg-fuel text-slate-950' : 'bg-slate-800 text-slate-500')} onClick={() => toggleDone(we, s)} aria-label="Completar serie">
                      <Check size={20} />
                    </button>
                  </div>
                  {rpeFor === s.id && s.completed && (
                    <div className="mb-1 flex items-center gap-1.5 pl-1 text-[11px] text-slate-400">
                      <span>¿Cómo de dura?</span>
                      {([['Fácil', 6], ['Justo', 8], ['Al límite', 10]] as const).map(([l, v]) => <button key={l} className="rounded-full bg-slate-800 px-2.5 py-1 font-semibold text-slate-200 active:scale-95" onClick={() => setRpe(we, s, v)}>{l}</button>)}
                      <button className="ml-auto px-1 text-slate-500" onClick={() => setRpeFor(null)} aria-label="Omitir">✕</button>
                    </div>
                  )}
                  {s.rpe !== undefined && s.completed && rpeFor !== s.id && <div className="mb-1 pl-2 text-[10px] text-slate-500">RPE {s.rpe}</div>}
                  {typeMenu === s.id && (
                    <div className="mb-1 grid grid-cols-2 gap-1">
                      {SET_TYPES.map((t) => (
                        <button key={t} onClick={() => setType(we, s.id, t)} className={cx('rounded-lg py-2 text-[11px] font-bold', BADGE_STYLE[t], s.type === t && 'ring-1 ring-accent')}>{t === 'normal' ? 'Normal' : `${SET_BADGE[t]} · ${SET_LABEL[t].split(' ')[0]}`}</button>
                      ))}
                    </div>
                  )}
                  {s.pr && s.completed && <div className="mb-1 flex items-center gap-1 pl-2 text-xs font-bold text-amber-500"><Trophy size={12} /> PR</div>}
                </div>
              );
            })}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button className="btn btn-ghost !py-2" onClick={() => addSet(we)}><Plus size={16} /> Añadir serie</button>
              <button className="btn btn-ghost !py-2" disabled={we.sets.length === 0} onClick={() => patchEx(we.id, (e) => ({ ...e, sets: e.sets.slice(0, e.unilateral ? -2 : -1) }))}>Eliminar última</button>
            </div>
              </>
            )}
          </div>
        );
      })}

      {(mode === 'std' || mode === 'x75') && target !== null && plannedSets > 0 && doneSets >= plannedSets && elapsed / 60 < target && (
        <CompleteSession list={workout.exercises} exOf={exOf} onAdd={(ids) => patch((w) => ({ ...w, exercises: [...w.exercises, ...ids.map((id) => { const base = { id: uid(), exerciseId: id, extra: true as const, sets: initialSets(id) }; const x = exOf(id)?.unilateral ? toggleUnilateral(base) : base; return { ...x, sets: wp(x.sets, id) }; })] }))} />
      )}

      {skippedList.length > 0 && (
        <button className="btn btn-ghost w-full" onClick={() => patchEx(skippedList[0].id, (e) => ({ ...e, skipped: undefined }))}><Plus size={16} /> Recuperar accesorio si me sobra tiempo</button>
      )}

      <button className="btn btn-ghost w-full" onClick={() => setCoachOpen(true)}><Sparkles size={16} /> ¿Dudas con la sesión? Pregúntale al Coach</button>
      {plates && <PlateCalc initial={plates.kg || 0} onClose={() => setPlates(null)} onUse={(kg) => patchEx(plates.weId, (e) => ({ ...e, sets: e.sets.map((s) => (s.type !== 'warmup' && !s.completed ? { ...s, weight: kg } : s)) }))} />}
      {coachOpen && <LiveCoachSheet workout={workout} initialQuestion={unlockQ} onClose={() => { setCoachOpen(false); setUnlockQ(undefined); }} />}

      {workout.templateId ? (
        <button className="btn btn-ghost w-full !border !border-dashed !border-slate-600" onClick={() => setPicker({ replace: null })}><Plus size={18} /> Añadir ejercicio extra hoy</button>
      ) : (
        <button className="btn btn-blue w-full" onClick={() => setPicker({ replace: null })}><Dumbbell size={18} /> Añadir ejercicios</button>
      )}

      {lastExtras.length > 0 && (
        <div className="rounded-xl bg-slate-800/60 p-3 text-xs text-slate-300">
          <div className="flex items-start gap-2">
            <Lightbulb size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-amber-500" />
            <span>El {lastExtrasDay} pasado añadiste de extra: <b className="text-slate-100">{lastExtras.map((e) => `${exOf(e.exerciseId)?.name ?? e.name} (${e.sets.length}×${e.sets[0]?.reps ?? 0}${exOf(e.exerciseId)?.timed ? ' s' : ''})`).join(', ')}</b>. ¿Quieres incluirlo hoy también?</span>
          </div>
          <button className="btn btn-blue mt-2 w-full !py-2 text-xs" onClick={() => patch((w) => ({ ...w, exercises: [...w.exercises, ...lastExtras.map((e) => ({ id: uid(), exerciseId: e.exerciseId, extra: true, sets: wp(e.sets.map((x) => ({ ...newSet(x.type, x.weight, x.reps), side: x.side })), e.exerciseId) }))] }))}>+ Incluir hoy</button>
        </div>
      )}

      {picker && (
        <ExercisePicker
          workout={workout}
          single={picker.replace !== null}
          onClose={() => setPicker(null)}
          onPick={(ids) => {
            if (picker.replace) {
              const target = picker.replace;
              patchEx(target, (e) => ({ ...e, exerciseId: ids[0], sets: wp(e.sets.map((s) => ({ ...s })), ids[0]) })); // mantiene las series
            } else
              patch((w) => ({ ...w, exercises: [...w.exercises, ...ids.map((id) => { const base = { id: uid(), exerciseId: id, extra: w.templateId ? true : undefined, sets: initialSets(id) }; const x = exOf(id)?.unilateral ? toggleUnilateral(base) : base; return { ...x, sets: wp(x.sets, id) }; })] }));
            setPicker(null);
          }}
        />
      )}
      {alt && (() => {
        const target = workout.exercises.find((e) => e.id === alt);
        const cur = target && exOf(target.exerciseId);
        if (!target || !cur) return null;
        return <AltExercise exercise={cur} location={workout.location ?? 'gym'} onClose={() => setAlt(null)} onPick={(id) => { patchEx(target.id, (e) => ({ ...e, exerciseId: id, sets: wp(e.sets.map((s) => ({ ...s })), id) })); setAlt(null); }} />;
      })()}
      {soloFor && (() => {
        const target = workout.exercises.find((e) => e.id === soloFor);
        if (!target) return null;
        return <SoloHipThrust onClose={() => setSoloFor(null)} onPick={(id) => { patchEx(target.id, (e) => { const swapped = { ...e, exerciseId: id, sets: e.sets.map((x) => ({ ...x, completed: false, pr: false })) }; const x = exOf(id)?.unilateral ? toggleUnilateral(swapped) : swapped; return { ...x, sets: wp(x.sets, id) }; }); setSoloFor(null); }} />;
      })()}
      {warmup && <WarmupModal exercises={workout.exercises.map((e) => exOf(e.exerciseId)).filter((e): e is Exercise => !!e)} onClose={() => setWarmup(false)} />}
      {demoFor && exOf(demoFor) && (() => {
        const d = exOf(demoFor)!;
        const tg = targetsFor(d);
        return <TechniqueModal title={d.name} imageUrl={d.imageUrl} muscles={[d.muscleGroup]} bm={tg.primary} bmSecondary={tg.secondary} equipment={d.equipment} tips={techniqueTips(d)} demoKey={d.id} onClose={() => setDemoFor(null)} />;
      })()}
      {video && (() => {
        const target = workout.exercises.find((e) => e.id === video);
        const cur = target && exOf(target.exerciseId);
        if (!target || !cur) return null;
        return <VideoFormCheck exercise={cur} location={workout.location ?? 'gym'} onClose={() => setVideo(null)} onApply={(cue) => { window.clearTimeout(tipTimer.current); if (cue) setTip({ id: target.id, tip: { text: `Cue para tu próxima serie: “${cue}”` } }); }} />;
      })()}
      {detail && <ExerciseDetail exerciseId={detail} onClose={() => setDetail(null)} />}
      {finishing && <FinishModal workout={workout} onClose={() => setFinishing(false)} />}
    </div>
  );
}

function FinishModal({ workout, onClose }: { workout: ActiveWorkout; onClose: () => void }) {
  const { state, update } = useStore();
  const [saveTpl, setSaveTpl] = useState(false);
  const [night, setNight] = useState(false);
  const [endedAt] = useState(() => Date.now());

  const result = useMemo(() => {
    const exercises: LogExercise[] = workout.exercises
      .map((we) => {
        const ex = state.exercises.find((e) => e.id === we.exerciseId);
        return { exerciseId: we.exerciseId, name: ex?.name ?? 'Ejercicio', muscleGroup: ex?.muscleGroup ?? 'Abdominales', notes: we.notes || undefined, extra: we.extra || undefined, perHand: perHandOf(we, ex) || undefined, sets: toLogSets(we.sets) };
      })
      .filter((e) => e.sets.length > 0);
    const durationSeconds = Math.max(60, Math.round((endedAt - workout.startedAt) / 1000));
    const totalVolumeKg = logVolume(exercises);
    const kc = workoutKcal(state.profile.weight, durationSeconds, exercises, (id) => state.exercises.find((e) => e.id === id));
    // Cardio: kcal reales del escáner (ACSM) o, si no hay, una estimación plana con tiempo y distancia.
    const cardioKcal = exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.kcal ?? flatKcal(s.min ?? 0, s.km ?? 0, state.profile.weight)), 0), 0);
    return {
      exercises,
      durationSeconds,
      totalVolumeKg,
      totalSets: exercises.reduce((a, e) => a + e.sets.length, 0),
      prsAchieved: workout.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed && s.pr).length, 0),
      caloriesBurned: kc.total + cardioKcal,
      kcal: kc,
    };
  }, [workout, endedAt, state.profile.weight, state.exercises]);

  const save = () => {
    const log: WorkoutLog = {
      id: workout.id,
      templateId: workout.templateId,
      skipped: workout.exercises.filter((e) => e.skipped && !e.sets.some((x) => x.completed)).map((e) => e.exerciseId),
      isPeriodSession: workout.isPeriodSession || undefined,
      location: workout.location ?? 'gym',
      title: workout.title.trim() || 'Entrenamiento',
      startTime: new Date(workout.startedAt).toISOString(),
      endTime: new Date(endedAt).toISOString(),
      durationSeconds: result.durationSeconds,
      totalVolumeKg: result.totalVolumeKg,
      totalSets: result.totalSets,
      prsAchieved: result.prsAchieved,
      caloriesBurned: result.caloriesBurned,
      exercises: result.exercises,
      source: 'app',
    };
    update((s) => ({
      ...s,
      active: null,
      workouts: fillPeriodGaps([log, ...s.workouts]),
      exercises: (workout.location ?? 'gym') === 'home' ? s.exercises : s.exercises.map((e) => {
        const done = log.exercises.filter((x) => x.exerciseId === e.id).flatMap((x) => x.sets);
        return done.length ? { ...e, personalRecords: updateRecords(e.personalRecords, done) } : e;
      }),
      templates: saveTpl
        ? [...s.templates, { id: uid(), title: log.title, exercises: workout.exercises.filter((we) => !we.extra).map((we) => ({ exerciseId: we.exerciseId, unilateral: we.unilateral, superset: we.superset, restSec: we.restSec, repMin: we.repMin, repMax: we.repMax, extras: we.extras, byTime: byTimeOf(we, s.exercises.find((q) => q.id === we.exerciseId)) || undefined, perHand: we.perHand, notes: we.notes, sets: we.sets.map((x) => ({ type: x.type, weight: x.weight, reps: byTimeOf(we, s.exercises.find((q) => q.id === we.exerciseId)) ? x.secs ?? x.reps : x.reps, side: x.side, secs: x.secs, partials: x.partials })) })) }]
        : s.templates,
    }));
    onClose();
  };

  if (result.exercises.length === 0)
    return (
      <Modal title="Sin series completadas" onClose={onClose}>
        <p className="mb-4 text-sm text-slate-300">No hay series marcadas como completadas, así que no hay nada que guardar. Puedes seguir entrenando o salir sin guardar.</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Seguir</button>
          <button className="btn btn-red" onClick={() => { update((st) => ({ ...st, active: null })); onClose(); }}>Salir sin guardar</button>
        </div>
      </Modal>
    );

  return (
    <Modal title="¡Buen trabajo!" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Duración" value={fmtDuration(result.durationSeconds)} />
        <Stat label="Volumen" value={result.totalVolumeKg.toLocaleString('es-ES')} unit="kg" />
        <Stat label="Series" value={result.totalSets} />
        <Stat label="Calorías" value={result.caloriesBurned} unit="kcal" />
      </div>
      <div className="mt-2 rounded-xl bg-slate-800 p-3 text-xs text-slate-300">
        <div className="mb-1 font-semibold text-white">Desglose</div>
        Tiempo total {fmtDuration(result.durationSeconds)} · volumen {result.totalVolumeKg.toLocaleString('es-ES')} kg<br />
        Por el tiempo de sesión: <b className="text-white">{result.kcal.base} kcal</b> · por el trabajo de las series: <b className="text-white">{result.kcal.work} kcal</b>
        {workout.isPeriodSession && <div className="mt-1 flex items-center gap-1 font-semibold text-pink-500"><Droplet size={12} strokeWidth={2} /> Sesión con el periodo</div>}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 p-3 text-amber-500">
        {result.prsAchieved > 0 ? Array.from({ length: Math.min(result.prsAchieved, 6) }, (_, i) => <Trophy key={i} size={20} />) : <Trophy size={20} className="opacity-30" />}
        <b>{result.prsAchieved} PR{result.prsAchieved === 1 ? '' : 's'} batido{result.prsAchieved === 1 ? '' : 's'}</b>
      </div>
      <Hint className="mt-3 text-xs text-slate-500">Estimación: tiempo de sesión (MET) + trabajo mecánico de cada serie completada (peso × repeticiones × recorrido), ponderado por grupo muscular (piernas ×1,3-1,4, torso ×1,15, aislamiento ×1,0) y +5 % por consumo posterior. Es una aproximación, no una medición exacta.</Hint>
      {workout.timeMode === 'x75' && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-indigo-500/10 p-3">
          <span className="text-sm text-slate-200"><b>¿Tienes 5 min extra?</b> Completa tu sesión con el Face Yoga Nocturno.</span>
          <button className="btn btn-blue shrink-0 !px-3 !py-2 text-xs" onClick={() => setNight(true)}>Iniciar Face Yoga</button>
        </div>
      )}
      {night && <FaceYogaNight onComplete={() => update((st) => { const k = dayKey(); return { ...st, habits: { ...st.habits, [k]: { ...(st.habits[k] ?? { agua: 0 }), faceYoga: true } } }; })} onClose={() => setNight(false)} />}
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={saveTpl} onChange={(e) => setSaveTpl(e.target.checked)} className="h-4 w-4" /> Guardar como rutina
      </label>
      <button className="btn btn-green mt-4 w-full" onClick={save}>Guardar en Historial y Actualizar Calorías del Día</button>
    </Modal>
  );
}
