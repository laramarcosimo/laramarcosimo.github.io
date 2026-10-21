import { Palmtree, Play } from 'lucide-react';
import { useStore } from '../lib/store';
import { MenuPhoto } from './MenuPhoto';
import { QuickMealPhoto } from './QuickMealPhoto';
import { buildVacationTemplate, circuitIndex, CIRCUITS, VACATION_MINUTES } from '../lib/vacation';
import { cx, dayKey } from '../lib/utils';

/** Modo vacaciones: en vez de tu rutina, un circuito de mantenimiento de 10-15 min sin material, según el tiempo que tengas hoy. */
export function VacationCard({ onStart }: { onStart: (templateId?: string) => void }) {
  const { state, update } = useStore();
  const min = state.settings.vacationMin ?? 12;
  const doneToday = state.workouts.some((w) => dayKey(Date.parse(w.startTime)) === dayKey() && w.title.startsWith('Vacaciones'));
  const ci = circuitIndex(state.settings.vacationShift);
  const tpl = buildVacationTemplate(min, state.settings.kneeSafe, state.exercises, ci);
  const names = tpl.exercises.map((e) => state.exercises.find((x) => x.id === e.exerciseId)?.name ?? '').filter(Boolean);

  const go = () => {
    update((s) => ({ ...s, templates: [...s.templates.filter((t) => t.id !== tpl.id), tpl] }));
    onStart(state.active ? undefined : tpl.id);
  };

  return (
    <div className="card space-y-3 !p-3">
      <div className="flex items-center gap-2">
        <Palmtree size={18} strokeWidth={1.5} className="shrink-0 text-accent" />
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase text-slate-400">Modo vacaciones · mantenimiento</div>
          <div className="font-bold text-white">{doneToday ? 'Mantenimiento de hoy hecho' : `Hoy ≈ ${min} minutos`}</div>
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-slate-400">Comida rápida: cuenta las calorías con una foto</div>
        <QuickMealPhoto />
        <div className="mt-3 border-t border-slate-800 pt-3"><MenuPhoto /></div>
      </div>
      <div className="border-t border-slate-800 pt-3">
        <div className="mb-1 text-xs text-slate-400">¿Cuánto tiempo tienes hoy?</div>
        <div className="grid grid-cols-4 gap-2">
          {VACATION_MINUTES.map((m) => (
            <button key={m} aria-pressed={min === m} onClick={() => update((s) => ({ ...s, settings: { ...s.settings, vacationMin: m } }))} className={cx('btn !py-2', min === m ? 'btn-blue' : 'btn-ghost')}>{m} min</button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-white">Circuito: {CIRCUITS[ci].name}</span><button className="font-semibold text-accent" onClick={() => update((s) => ({ ...s, settings: { ...s.settings, vacationShift: (s.settings.vacationShift ?? 0) + 1 } }))}>Otro circuito</button></div>
      <p className="text-xs text-slate-300">{tpl.exercises.length} ejercicios sin material, {tpl.exercises[0]?.sets.length ?? 0} ronda{(tpl.exercises[0]?.sets.length ?? 0) === 1 ? "" : "s"}: {names.join(' · ')}.</p>
      <button className="btn btn-blue w-full" onClick={go}><Play size={16} /> {state.active ? 'Continuar entreno' : doneToday ? 'Repetir' : 'Empezar'}</button>
    </div>
  );
}
