import { Check, Loader2, RotateCcw, Search, Send, Sparkles, X } from 'lucide-react';
import { useKeyboardPin, useVisibleArea } from '../lib/viewport';
import { useScrollLock } from '../lib/scrollLock';
import { useEffect, useRef, useState } from 'react';
import { liveCoachContext } from '../lib/coachChat';
import { askLiveCoach, perfectRoutine, type LiveTurn, type PerfectReport } from '../lib/gemini';
import { feasibleAtHome } from '../lib/homeSwap';
import { avoidFilter, recentJoints } from '../lib/joints';
import { trainingContext } from '../lib/nutriWeek';
import { estimateMinutes, timeLimit } from '../lib/routineTime';
import { nextRoutine } from '../lib/routineToday';
import { useStore } from '../lib/store';
import type { ActiveWorkout, AppState, WorkoutExercise } from '../lib/types';
import { newSet, toggleUnilateral } from '../lib/workout';
import { cx, uid } from '../lib/utils';

const AUDIT_CHIP = '🔍 Auditar y perfeccionar mi rutina';
const CHIPS = ['¿Cómo coloco los pies aquí?', 'Noto molestia en la rodilla, ¿qué hago?', 'La máquina está ocupada, dame alternativa', '¿Qué peso debería poner hoy?'];

// La conversación se conserva mientras la app esté abierta, para poder cerrar el chat y volver sin perder el hilo.
let saved: LiveTurn[] = [];

/** Coach en vivo: hoja inferior estilo iOS. No toca el cronómetro ni el descanso de la sesión activa. */
export function LiveCoachSheet({ workout, initialQuestion, onClose }: { workout?: ActiveWorkout | null; initialQuestion?: string; onClose: () => void }) {
  const { state, update } = useStore();
  const [applied, setApplied] = useState<number | null>(null);
  const [turns, setTurns] = useState<LiveTurn[]>(saved);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useScrollLock();
  const { typing, handlers, justFocused } = useKeyboardPin();
  const area = useVisibleArea(typing); // zona real por encima del teclado: la hoja se ajusta a ella aunque iOS suba la página
  useEffect(() => {
    document.body.classList.add('chat-open');
    return () => document.body.classList.remove('chat-open');
  }, []);
  useEffect(() => {
    saved = turns;
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, busy]);

  // Lista de la rutina a auditar: el entreno activo o, si no hay, la rutina que toca hoy.
  const routineItems = () => {
    const home = (workout ?? state.active)?.location === 'home';
    const nm = (id: string) => state.exercises.find((e) => e.id === id);
    const act = workout ?? state.active;
    if (act) {
      const list = act.exercises.filter((e) => !e.skipped);
      return { title: act.title, home, items: list.map((e, i) => { const w = e.sets.filter((x) => x.type !== 'warmup'); return { i, eid: e.exerciseId, nombre: nm(e.exerciseId)?.name ?? 'Ejercicio', musculo: nm(e.exerciseId)?.muscleGroup ?? '', equipo: nm(e.exerciseId)?.equipment ?? '', series: Math.max(1, e.unilateral ? Math.ceil(w.length / 2) : w.length), reps: String(w.find((x) => x.reps > 0)?.reps || e.notes || '8-12'), descanso: e.restSec ?? state.settings.restDefault }; }), ids: list.map((e) => e.id), template: null as string | null };
    }
    const t = nextRoutine(state);
    if (!t) return null;
    return { title: t.title, home, items: t.exercises.map((e, i) => { const w = e.sets.filter((x) => x.type !== 'warmup'); return { i, eid: e.exerciseId, nombre: nm(e.exerciseId)?.name ?? 'Ejercicio', musculo: nm(e.exerciseId)?.muscleGroup ?? '', equipo: nm(e.exerciseId)?.equipment ?? '', series: Math.max(1, e.unilateral ? Math.ceil(w.length / 2) : w.length), reps: String(w.find((x) => x.reps > 0)?.reps || e.notes || '8-12'), descanso: e.restSec ?? state.settings.restDefault }; }), ids: t.exercises.map((e) => e.exerciseId), template: t.id };
  };

  const audit = async () => {
    if (busy) return;
    const r = routineItems();
    const base: LiveTurn[] = [...turns, { role: 'user', text: AUDIT_CHIP }];
    setTurns(base);
    setBusy(true);
    setErr('');
    if (!r) { setTurns([...base, { role: 'coach', text: 'No tienes ninguna rutina para auditar todavía. Crea una en Entreno o empieza una.' }]); setBusy(false); return; }
    try {
      const groups = new Set(r.items.map((x) => x.musculo));
      const catalogo = state.exercises
        .filter((e) => e.muscleGroup !== 'Rostro y Cuello' && !e.timed && (groups.has(e.muscleGroup) || e.muscleGroup === 'Abdominales') && (!r.home || feasibleAtHome(e, state.homeGear)) && avoidFilter(recentJoints(state.discomfort))(e.name))
        .slice(0, 90)
        .map((e) => ({ id: e.id, nombre: e.name, musculo: e.muscleGroup, equipo: e.equipment }));
      const limiteMin = timeLimit(r.title, r.items.map((x) => x.musculo));
      const report = await perfectRoutine(state.settings, r.items.map((x) => ({ i: x.i, nombre: x.nombre, musculo: x.musculo, equipo: x.equipo, series: x.series, reps: x.reps, descanso: x.descanso })), { datos: trainingContext(state, r.items.map((x) => ({ nombre: x.nombre, eid: x.eid }))), home: r.home, kneeSafe: state.settings.kneeSafe, titulo: r.title, limiteMin, minActuales: estimateMinutes(r.items), catalogo });
      setApplied(null);
      setTurns([...base, { role: 'coach', text: '', report }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo auditar la rutina.');
    } finally {
      setBusy(false);
    }
  };

  /** Aplica la propuesta a la rutina auditada: reordena, ajusta series y descansos y elimina lo descartado (nunca toca series ya hechas). */
  const apply = (rep: PerfectReport) => {
    const r = routineItems();
    if (!r) return;
    const finalOrder = rep.propuesta;
    update((s: AppState) => {
      if (r.template === null && s.active) {
        const list = s.active.exercises.filter((e) => !e.skipped);
        const skipped = s.active.exercises.filter((e) => e.skipped);
        // Cambios de ejercicio y ejercicios añadidos: se crean con series vacías (un ejercicio ya trabajado hoy no se sustituye).
        const fresh = (p: PerfectReport['propuesta'][number]): WorkoutExercise => {
          const base = { id: uid(), exerciseId: p.ejercicioId as string, sets: Array.from({ length: p.series }, () => newSet('normal', 0, parseInt(p.reps, 10) || 10)), restSec: p.descanso };
          return s.exercises.find((x) => x.id === p.ejercicioId)?.unilateral ? toggleUnilateral(base) : base;
        };
        const kept = finalOrder.map((p) => ({ p, e: p.i < 0 ? fresh(p) : p.ejercicioId && !list[p.i]?.sets.some((x) => x.completed) ? fresh(p) : list[p.i] })).filter((x) => x.e);
        const dropped = rep.eliminadas.map((i) => list[i]).filter((e) => e && e.sets.some((x) => x.completed)); // lo ya trabajado se conserva
        const exercises = [...kept.map(({ p, e }) => {
          if (p.i < 0 || (p.ejercicioId && e.exerciseId === p.ejercicioId)) return e;
          const w = e.sets.filter((x) => x.type !== 'warmup');
          const untouched = !e.sets.some((x) => x.completed);
          const want = e.unilateral ? p.series * 2 : p.series;
          let sets = e.sets;
          if (untouched && w.length > want) sets = [...e.sets.filter((x) => x.type === 'warmup'), ...w.slice(0, want)];
          if (untouched && w.length < want && w.length > 0) { const last = w[w.length - 1]; sets = [...e.sets, ...Array.from({ length: want - w.length }, () => ({ ...newSet(last.type, last.weight, last.reps), side: last.side }))]; }
          return { ...e, sets, restSec: p.descanso };
        }), ...dropped, ...skipped];
        return { ...s, active: { ...s.active, exercises } };
      }
      return { ...s, templates: s.templates.map((t) => (t.id !== r.template ? t : { ...t, exercises: finalOrder.map((p) => {
        if (p.i >= 0 && !p.ejercicioId) return { ...t.exercises[p.i], restSec: p.descanso };
        const uni = !!s.exercises.find((x) => x.id === p.ejercicioId)?.unilateral;
        const reps = parseInt(p.reps, 10) || 10;
        const sets = Array.from({ length: p.series }, () => (uni ? [{ type: 'normal' as const, weight: 0, reps, side: 'I' as const }, { type: 'normal' as const, weight: 0, reps, side: 'D' as const }] : [{ type: 'normal' as const, weight: 0, reps }])).flat();
        return { exerciseId: p.ejercicioId as string, sets, unilateral: uni || undefined, restSec: p.descanso };
      }).filter((x) => x.exerciseId) })) };
    });
    setApplied(finalOrder.length);
  };

  const send = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    const next: LiveTurn[] = [...turns, { role: 'user', text }];
    setTurns(next);
    setInput('');
    setBusy(true);
    setErr('');
    try {
      const a = await askLiveCoach(state.settings, text, liveCoachContext(state, workout ?? state.active), turns);
      setTurns([...next, { role: 'coach', text: a }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo consultar al Coach.');
    } finally {
      setBusy(false);
    }
  };

  const started = useRef(false);
  useEffect(() => {
    if (initialQuestion && !started.current) { started.current = true; void send(initialQuestion); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cx('fixed inset-0 z-[70] flex justify-center', typing ? 'items-start' : 'items-end')} style={typing && area ? { top: area.top, height: area.height, bottom: 'auto' } : undefined} onClick={() => { if (!justFocused()) onClose(); }} {...handlers}>
      <div className="modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className={cx('relative flex w-full max-w-xl flex-col border-slate-700 bg-slate-900', typing ? cx('rounded-b-3xl border-b', area ? 'h-[calc(100%-env(safe-area-inset-top))]' : 'h-[47%]') : 'h-[78%] rounded-t-3xl border-t')} style={typing ? { marginTop: 'env(safe-area-inset-top)' } : { paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <Sparkles size={18} className="text-accent" />
          <h3 className="flex-1 text-lg font-bold text-white">Coach en vivo</h3>
          {turns.length > 0 && <button className="rounded-full bg-slate-800 p-2 text-slate-300" onClick={() => { setTurns([]); setErr(''); }} aria-label="Nueva conversación"><RotateCcw size={16} /></button>}
          <button className="rounded-full bg-slate-800 p-2" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 pb-2">
          {turns.length === 0 && <p className="rounded-xl bg-slate-800/60 p-3 text-sm text-slate-300">Pregúntame lo que necesites mientras entrenas: técnica, molestias, alternativas o cargas. Tu cronómetro sigue corriendo.</p>}
          {turns.map((t, i) => t.report ? (
            <div key={i} className="space-y-2 rounded-2xl bg-slate-800 p-3 text-sm text-slate-100">
              <div><div className="mb-1 text-xs font-bold uppercase text-emerald-500">Lo que está perfecto</div><ul className="list-disc space-y-1 pl-4">{t.report.perfecto.map((x, k) => <li key={k}>{x}</li>)}</ul></div>
              <div><div className="mb-1 text-xs font-bold uppercase text-amber-500">Ajustes de cirujano recomendados</div><ul className="list-disc space-y-1 pl-4">{t.report.ajustes.map((x, k) => <li key={k}>{x}</li>)}</ul></div>
              <div>
                <div className="mb-1 text-xs font-bold uppercase text-accent">Propuesta final optimizada</div>
                <ol className="list-decimal space-y-0.5 pl-5 text-xs">{(() => { const r = routineItems(); return t.report.propuesta.map((p, k) => <li key={k}>{p.i < 0 ? <><span className="font-bold text-emerald-400">NUEVO · </span>{p.nombre}</> : p.ejercicioId ? <>{p.nombre} <span className="text-amber-400">(en lugar de {r?.items[p.i]?.nombre})</span></> : (r?.items[p.i]?.nombre ?? `Ejercicio ${p.i + 1}`)} · {p.series}×{p.reps} · {p.descanso} s</li>); })()}</ol>
                {(() => { const r = routineItems(); const lim = r ? timeLimit(r.title, r.items.map((x) => x.musculo)) : null; const min = estimateMinutes(t.report.propuesta.map((p) => ({ series: p.series, descanso: p.descanso }))); return <div className="mt-1 text-xs text-slate-400">Duración estimada: ~{min} min{lim ? ` (máx. ${lim} min)` : ''}</div>; })()}
                {t.report.eliminadas.length > 0 && <div className="mt-1 text-xs text-slate-400">Se eliminan: {(() => { const r = routineItems(); return t.report.eliminadas.map((i) => r?.items[i]?.nombre ?? `Ejercicio ${i + 1}`).join(', '); })()}</div>}
                <button className="btn btn-blue mt-2 w-full !py-2.5" disabled={applied !== null} onClick={() => apply(t.report!)}>{applied !== null ? <><Check size={16} /> Rutina aplicada</> : 'Aplicar esta rutina perfeccionada'}</button>
              </div>
            </div>
          ) : (
            <div key={i} className={cx('max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm', t.role === 'user' ? 'ml-auto bg-accent text-white' : 'bg-slate-800 text-slate-100')}>{t.text}</div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> El Coach está pensando…</div>}
          {err && <div className="rounded-xl bg-red-500/10 p-2 text-xs text-red-400">{err}</div>}
          <div ref={endRef} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-2">
          <button className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent active:scale-95" disabled={busy} onClick={() => void audit()}><Search size={12} /> {AUDIT_CHIP.replace('🔍 ', '')}</button>
          {CHIPS.map((c) => <button key={c} className="shrink-0 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 active:scale-95" disabled={busy} onClick={() => void send(c)}>{c}</button>)}
        </div>
        <form className="flex gap-2 px-4 pb-3" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
          <input className="field !py-2.5" placeholder="Pregunta al Coach…" value={input} enterKeyHint="send" onChange={(e) => setInput(e.target.value)} />
          <button type="submit" className="btn btn-blue shrink-0 !px-4" disabled={busy || !input.trim()} aria-label="Enviar"><Send size={16} /></button>
        </form>
      </div>
    </div>
  );
}
