import { Clock } from 'lucide-react';
import { MODE_NOTE, TIME_MODES, type TimeMode } from '../lib/timeOptimizer';
import { cx } from '../lib/utils';
import { Hint } from './Hint';

/** Selector de tiempo disponible (Time Optimizer) con la duración calculada en tiempo real. */
export function TimeChips({ mode, minutes, onPick, optimalRest, onToggleRest }: { mode: TimeMode; minutes: number; onPick: (m: TimeMode) => void; optimalRest: boolean; onToggleRest: () => void }) {
  return (
    <div className="card space-y-2.5 !p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-white"><Clock size={15} strokeWidth={1.75} className="text-accent" /> ¿Cuánto tiempo tienes?</span>
        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">Duración calculada: ~{minutes} min</span>
      </div>
      <div className="-mx-1 flex flex-wrap gap-1.5 px-1" role="radiogroup" aria-label="Tiempo disponible">
        {TIME_MODES.map((m) => (
          <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => onPick(m.id)} className={cx('rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95', mode === m.id ? 'bg-accent text-white' : m.id === 'std' ? 'bg-accent/15 text-accent' : 'bg-slate-800 text-slate-300')}>
            {m.label}
          </button>
        ))}
      </div>
      <button role="switch" aria-checked={optimalRest} onClick={onToggleRest} className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-800 px-3 py-2 text-left text-xs">
        <span><b className="text-slate-200">Usar descansos óptimos</b><span className="block text-slate-400">2,5 min en compuestos y 90 s en accesorios (en vez de los de tu rutina)</span></span>
        <span className={cx('relative h-6 w-11 shrink-0 rounded-full transition', optimalRest ? 'bg-accent' : 'bg-slate-600')}><span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', optimalRest ? 'left-[22px]' : 'left-0.5')} /></span>
      </button>
      {MODE_NOTE[mode] && <Hint className="text-xs text-slate-400">{MODE_NOTE[mode]}</Hint>}
      <Hint className="text-[11px] text-slate-500">Siempre 3 series efectivas en lo que haces: el tiempo se ajusta posponiendo accesorios, nunca recortando series. Incluye 3 min de calentamiento y tus descansos configurados.</Hint>
    </div>
  );
}
