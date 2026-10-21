import { Flame } from 'lucide-react';
import type { DayBalance } from '../lib/metabolic';
import { cx } from '../lib/utils';
import { KcalBalance } from './KcalBalance';
import { Bar } from './ui';

export function Macro({ label, value, target, color, strong, min }: { label: string; value: number; target: number; color: string; strong?: boolean; min?: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className={cx(strong ? 'font-bold text-white' : 'text-slate-400')}>{label}</span>
        <span className="tabular-nums text-slate-400"><b className={cx(strong ? 'text-sm text-white' : 'text-slate-200')}>{value}</b> / {min !== undefined && min !== target ? `${min}–${target}` : target} g{min !== undefined && value >= min ? ' ✓' : ''}</span>
      </div>
      <div className="relative">
        <Bar value={value} max={Math.max(1, target)} color={min !== undefined && value >= min ? 'bg-emerald-500' : color} />
        {min !== undefined && min !== target && <span className="absolute -top-0.5 h-3 w-0.5 rounded bg-slate-400" style={{ left: `${Math.min(100, (min / Math.max(1, target)) * 100)}%` }} aria-hidden />}
      </div>
    </div>
  );
}

/** Tarjeta del día con kcal y barras de proteína, carbohidratos y grasas: la misma en Hoy y en Nutrición. */
export function DayBars({ b }: { b: DayBalance }) {
  return (
        <div className="card space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className={cx('rounded-full px-2.5 py-0.5 text-[11px] font-bold', b.trainingDay ? 'bg-accent/20 text-accent' : 'bg-slate-800 text-slate-300')}>{b.trainingDay ? 'Día de entreno' : 'Día de descanso'}</span>
              <span className="flex items-center gap-1 text-xs text-slate-400"><Flame size={12} /> Meta {String(b.kcalMin).replace(/\B(?=(\d{3})+$)/g, '.')}–{String(b.kcalMax).replace(/\B(?=(\d{3})+$)/g, '.')} kcal</span>
            </div>
            <KcalBalance b={b} />
            {b.burned > 0 && <div className="mt-1 text-xs text-slate-400">+{b.burned} kcal gastadas en el entreno</div>}
          </div>
          <div className="space-y-2.5">
            <Macro label="Proteína" value={b.proteinEaten} target={b.proteinMax} min={b.proteinTarget} color="bg-accent" strong />
            <Macro label="Carbohidratos" value={b.carbs} target={b.carbsTarget} min={b.carbsMin} color="bg-amber-400" />
            <Macro label="Grasas" value={b.fat} target={b.fatTarget} min={b.fatMin} color="bg-pink-400" />
          </div>
        </div>
  );
}
