import { Blocks } from '../components/Blocks';
import { byTimeOf } from '../components/ExerciseTargets';
import { WorkoutHistory } from '../components/WorkoutHistory';
import { HabitSuggestions } from '../components/HabitSuggestions';
import { MuscleBalance } from '../components/MuscleBalance';
import { FormCheckCard } from '../components/FormCheckCard';
import { ExerciseProgress } from '../components/ExerciseProgress';
import { Copy, Dumbbell, Home, MoreVertical, Pencil, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import { LiveCoachSheet } from '../components/LiveCoachSheet';
import { useEffect, useRef, useState } from 'react';
import { HomePreview, type HomePlan } from '../components/HomePreview';
import { ImportPanel } from '../components/ImportPanel';
import { Logger } from '../components/Logger';
import { RoutineEditor } from '../components/RoutineEditor';
import { RoutineView } from '../components/RoutineView';
import { TrainingCalendar } from '../components/TrainingCalendar';
import { Title } from '../components/ui';
import { useStore } from '../lib/store';
import type { Location, RoutineTemplate } from '../lib/types';
import { cx, uid } from '../lib/utils';
import { GYM_KNEE_SAFE_ID, isKneeUnsafe } from '../lib/knee';
import { deloadActive, formatSetsLine, normalizePairs, newSet, previousFor, reduceForDeload, setsFromTemplate, toggleUnilateral, withPrevious } from '../lib/workout';

const LOC_KEY = 'apex-location';

/** «Última vez» de una rutina: lo que hiciste (peso y repeticiones) la última vez, visible en cualquier momento. */
function LastTime({ tplId, title }: { tplId: string; title: string }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const last = [...state.workouts].filter((w) => w.templateId === tplId || w.title === title).sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))[0];
  if (!last) return null;
  const day = new Date(last.startTime).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
  return (
    <div className="mt-2">
      <button className="flex w-full items-center justify-between rounded-lg bg-slate-800/60 px-2.5 py-1.5 text-left text-[11px] text-slate-300" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>Última vez: <b className="capitalize">{day}</b> · {last.totalVolumeKg} kg</span><span className="text-accent">{open ? 'Ocultar' : 'Ver pesos y reps'}</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 rounded-lg bg-slate-800/40 p-2 text-[11px]">
          {last.exercises.map((e, i) => <div key={i} className="flex justify-between gap-2"><span className="min-w-0 truncate text-slate-300">{e.name}</span><span className="shrink-0 text-slate-400">{formatSetsLine(e.sets)}</span></div>)}
        </div>
      )}
    </div>
  );
}

export default function Train({ onRest, autoStart, onAutoStarted }: { onRest: (seconds?: number) => void; autoStart?: string | null; onAutoStarted?: () => void }) {
  const { state, update, removeWithUndo } = useStore();
  const [editing, setEditing] = useState<RoutineTemplate | 'new' | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [preview, setPreview] = useState<RoutineTemplate | null>(null);
  const [location, setLocationState] = useState<Location>(() => {
    try {
      return localStorage.getItem(LOC_KEY) === 'home' ? 'home' : 'gym';
    } catch {
      return 'gym';
    }
  });
  const active = state.active;
  const nameOf = (id: string) => state.exercises.find((e) => e.id === id)?.name ?? 'Ejercicio';

  const setLocation = (l: Location) => {
    setLocationState(l);
    try {
      localStorage.setItem(LOC_KEY, l);
    } catch {
      /* noop */
    }
  };

  const start = (tpl: RoutineTemplate | undefined, loc: Location, plan?: HomePlan) => {
    const groups = new Map<string, string>();
    update((s) => ({
      ...s,
      exercises: plan && plan.created.length ? [...s.exercises, ...plan.created] : s.exercises,
      active: {
        id: uid(),
        templateId: tpl?.id,
        location: loc,
        title: tpl?.title ?? 'Entrenamiento',
        notes: tpl?.notes,
        startedAt: Date.now(),
        exercises: plan
          ? plan.items.map((it) => ({ id: uid(), exerciseId: it.sub.id, notes: it.note, sets: setsFromTemplate(it.sets, previousFor(s.workouts, it.sub.id, false).sets, previousFor(s.workouts, it.sub.id, false).mark) }))
          : (tpl?.exercises ?? []).map((e0) => {
              // Protección de rodilla: un ejercicio con saltos/rodilla en suelo se cambia por prensa inclinada.
              const unsafe = s.settings.kneeSafe && isKneeUnsafe(s.exercises.find((x) => x.id === e0.exerciseId)?.name ?? '');
              const e = unsafe ? { ...e0, exerciseId: GYM_KNEE_SAFE_ID } : e0;
              const prev = previousFor(s.workouts, e.exerciseId, false, tpl?.id);
              const tplSets = deloadActive(s.settings.deloadUntil) ? reduceForDeload(e.sets) : e.sets;
              const sets0 = tplSets.length ? setsFromTemplate(tplSets.some((x) => x.side) ? normalizePairs(tplSets) : tplSets, prev.sets, prev.mark) : withPrevious([newSet()], prev.sets, prev.mark);
              const sets = byTimeOf(e, s.exercises.find((x) => x.id === e.exerciseId)) ? sets0.map((x) => ({ ...x, secs: x.reps || undefined, reps: 0 })) : sets0;
              if (e.superset && !groups.has(e.superset)) groups.set(e.superset, uid());
              const we = { id: uid(), exerciseId: e.exerciseId, sets, notes: e.notes, restSec: e.restSec, repMin: e.repMin, repMax: e.repMax, extras: e.extras, byTime: e.byTime, perHand: e.perHand, superset: e.superset ? groups.get(e.superset) : undefined, unilateral: e.unilateral };
              // Unilateral guardado sin lados (rutina creada a mano): se convierte a parejas D/I.
              return e.unilateral && !sets.some((x) => x.side) ? toggleUnilateral({ ...we, unilateral: false }) : we;
            }),
      },
    }));
  };

  const startRoutine = (t: RoutineTemplate) => (location === 'home' ? setPreview(t) : start(t, 'gym'));
  const duplicate = (t: RoutineTemplate) => update((s) => ({ ...s, templates: [...s.templates, { ...t, id: uid(), title: `${t.title} (copia)`, exercises: t.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) })) }] }));

  // «Iniciar» desde Hoy: arranca la rutina elegida una sola vez.
  const autoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoStart) {
      autoRef.current = null;
      return;
    }
    if (autoRef.current === autoStart) return;
    autoRef.current = autoStart;
    const t = state.templates.find((x) => x.id === autoStart);
    if (t && !state.active) startRoutine(t);
    onAutoStarted?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  if (active && !browsing) return <Logger workout={active} onRest={onRest} onBack={() => setBrowsing(true)} />;

  return (
    <div className="space-y-5" onClick={() => setMenu(null)}>
      <Title sub="Registra tus series y descansos">Entreno</Title>

      <Blocks
        page="entreno"
        items={{
          inicio: (
            <>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-800 p-1">
            {([['gym', 'Gimnasio', Dumbbell], ['home', 'En casa', Home]] as const).map(([l, label, Icon]) => (
              <button key={l} onClick={() => setLocation(l)} className={cx('rounded-xl py-3 text-sm font-bold transition', location === l ? (l === 'gym' ? 'bg-accent text-white shadow' : 'bg-emerald-500 text-white shadow') : 'text-slate-400')}><Icon size={16} strokeWidth={1.75} className="mr-1.5 inline" />{label}</button>
            ))}
          </div>
    
          {active ? (
            <button className="btn btn-green w-full !py-4 text-base" onClick={() => setBrowsing(false)}>
              <Play size={18} /> Volver a «{active.title}» en curso
            </button>
          ) : (
            <button className="btn btn-blue w-full !py-4 text-base" onClick={() => start(undefined, location)}>
              <Play size={18} /> Iniciar entrenamiento vacío
            </button>
          )}
          <button className="btn btn-ghost w-full" onClick={() => setCoachOpen(true)}><Sparkles size={16} /> Preguntar al Coach</button>
          {coachOpen && <LiveCoachSheet workout={active} onClose={() => setCoachOpen(false)} />}
            </>
          ),
          rutinas: (
            <>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold text-white">Mis rutinas</h2>
              <button className="text-sm font-semibold text-accent" onClick={() => setEditing('new')}><Plus size={14} className="inline" /> Nueva rutina</button>
            </div>
            <div className="space-y-2">
              {state.templates.map((t) => (
                <div key={t.id} className="card !p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <button className="block w-full text-left" onClick={() => setViewing(t.id)} aria-label={`Ver rutina ${t.title}`}>
                        <div className="font-bold text-white">{t.title}</div>
                      <div className="text-[11px] text-slate-500">{t.exercises.length} ejercicios{t.folder ? ` · ${t.folder}` : ''}</div>
                      <div className="mt-1 truncate text-xs text-slate-400">{t.exercises.slice(0, 4).map((e) => nameOf(e.exerciseId)).join(' · ')}{t.exercises.length > 4 ? '…' : ''}</div>
                      </button>
                    </div>
                    <div className="relative">
                      <button className="p-1.5 text-slate-500" onClick={(e) => { e.stopPropagation(); setMenu(menu === t.id ? null : t.id); }} aria-label="Menú"><MoreVertical size={18} /></button>
                      {menu === t.id && (
                        <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
                          <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200" onClick={() => { setMenu(null); setEditing(t); }}><Pencil size={15} /> Editar plantilla</button>
                          <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200" onClick={() => { setMenu(null); duplicate(t); }}><Copy size={15} /> Duplicar</button>
                          <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-red-400" onClick={() => { setMenu(null); if (confirm(`¿Eliminar la rutina ${t.title}?`)) removeWithUndo(`Rutina «${t.title}» eliminada`, (s) => ({ ...s, templates: s.templates.filter((x) => x.id !== t.id) })); }}><Trash2 size={15} /> Eliminar</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <LastTime tplId={t.id} title={t.title} />
                  <button className={cx('btn mt-2 w-full !py-2', location === 'home' ? 'bg-emerald-500 text-white' : 'btn-blue')} disabled={!!active} onClick={() => startRoutine(t)}>
                    {location === 'home' ? 'Adaptar e iniciar en casa' : 'Iniciar rutina'}
                  </button>
                </div>
              ))}
            </div>
          </section>
            </>
          ),
          sugerencias: <HabitSuggestions />,
          historial: <WorkoutHistory />,
          balance: <MuscleBalance />,
          progreso: <ExerciseProgress />,
          calendario: (
            <>
          <TrainingCalendar />
            </>
          ),
          importar: (
            <>
          <ImportPanel />
            </>
          ),
          tecnica: <FormCheckCard location={location} />,
        }}
      />

      {viewing && (() => {
        const t = state.templates.find((x) => x.id === viewing);
        if (!t) return null;
        return (
          <RoutineView
            tpl={t}
            disabled={!!active}
            onClose={() => setViewing(null)}
            onStart={() => { setViewing(null); startRoutine(t); }}
            onEdit={() => { setViewing(null); setEditing(t); }}
            onDuplicate={() => { duplicate(t); setViewing(null); }}
            onDelete={() => { if (confirm(`¿Eliminar la rutina ${t.title}?`)) { setViewing(null); removeWithUndo(`Rutina «${t.title}» eliminada`, (s) => ({ ...s, templates: s.templates.filter((x) => x.id !== t.id) })); } }}
          />
        );
      })()}
      {editing && <RoutineEditor initial={editing === 'new' ? undefined : editing} location={location} onClose={() => setEditing(null)} />}
      {preview && <HomePreview tpl={preview} onClose={() => setPreview(null)} onStart={(plan) => { start(preview, 'home', plan); setPreview(null); }} />}
    </div>
  );
}
